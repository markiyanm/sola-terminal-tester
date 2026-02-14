<script lang="ts">
	import { config } from '$lib/stores/config';
	import { selectedDevice, selectedDeviceId } from '$lib/stores/devices';
	import { v2session } from '$lib/stores/v2session';
	import { initiateV2Session, cancelV2Session, getV2SessionEndpointUrl, getCancelEndpointUrl } from '$lib/api/v2client';
	import type { DebugInfo } from '$lib/stores/session';

	const TRANSACTION_TYPES = [
		{ value: 'cc:sale', label: 'CC Sale', requiresAmount: true },
		{ value: 'cc:authonly', label: 'CC Auth Only', requiresAmount: true },
		{ value: 'cc:credit', label: 'CC Credit (Refund)', requiresAmount: true },
		{ value: 'gift:balance', label: 'Gift Balance', requiresAmount: false },
		{ value: 'gift:issue', label: 'Gift Issue', requiresAmount: true },
		{ value: 'gift:redeem', label: 'Gift Redeem', requiresAmount: true },
		{ value: 'gift:activate', label: 'Gift Activate', requiresAmount: true }
	];

	let command = $state('cc:sale');
	let amount = $state('');
	let invoice = $state('');
	let tip = $state('');
	let enableTipPrompt = $state(false);
	let error = $state<string | null>(null);
	let bypassStatusCheck = $state(false);
	let isCancelling = $state(false);

	// Elapsed time tracking
	let elapsedSeconds = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// Track device changes to reset bypass and clear errors
	let lastDeviceId = $state<string | null>(null);
	$effect(() => {
		if ($selectedDeviceId !== lastDeviceId) {
			lastDeviceId = $selectedDeviceId;
			bypassStatusCheck = false;
			error = null;
		}
	});

	// Track API key changes to clear errors
	let lastApiKey = $state<string | null>(null);
	$effect(() => {
		if ($config.apiKey !== lastApiKey) {
			lastApiKey = $config.apiKey;
			error = null;
		}
	});

	let selectedType = $derived(TRANSACTION_TYPES.find(t => t.value === command));
	let isDeviceConnected = $derived($selectedDevice?.xDeviceStatus === 'CONNECTED');
	let isPending = $derived($v2session.status === 'pending');
	let isIdle = $derived($v2session.status === 'idle' || $v2session.status === 'completed' || $v2session.status === 'error' || $v2session.status === 'cancelled');
	let canSubmit = $derived(
		$config.apiKey &&
		$selectedDeviceId &&
		(isDeviceConnected || bypassStatusCheck) &&
		(!selectedType?.requiresAmount || (amount && parseFloat(amount) > 0))
	);

	function startTimer() {
		elapsedSeconds = 0;
		timerInterval = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function formatElapsed(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function extractDebugInfo(result: Record<string, unknown>): DebugInfo | null {
		if (result._debug && typeof result._debug === 'object') {
			return result._debug as DebugInfo;
		}
		return null;
	}

	function stripDebugFromResponse(result: Record<string, unknown>): Record<string, unknown> {
		const { _debug, ...rest } = result;
		return rest;
	}

	async function handleRunTransaction() {
		if (!$config.apiKey || !$selectedDeviceId) return;

		error = null;
		v2session.clear();
		v2session.startRequest();
		startTimer();

		// Build and set request debug info immediately (before fetch)
		const endpointUrl = getV2SessionEndpointUrl($config.selectedEnvironment, $config.customBaseUrl);
		const requestDebugBody: Record<string, unknown> = {
			xKey: '[REDACTED]',
			xDeviceId: $selectedDeviceId,
			xCommand: command,
			xSoftwareName: 'SolaTerminalTester',
			xSoftwareVersion: '1.0.0',
			xExternalRequestId: `test-${Date.now()}`
		};
		if (amount) requestDebugBody.xAmount = amount;
		if (enableTipPrompt) requestDebugBody.xEnableTipPrompt = enableTipPrompt;
		if (invoice) requestDebugBody.xInvoice = invoice;
		if (tip) requestDebugBody.xTip = tip;

		v2session.setDebugRequest({
			request: {
				method: 'POST',
				url: endpointUrl,
				headers: { 'Content-Type': 'application/json' },
				body: requestDebugBody
			},
			response: {
				status: 0,
				statusText: 'Pending...',
				headers: {},
				body: null
			}
		});

		try {
			const result = await initiateV2Session({
				apiKey: $config.apiKey,
				deviceId: $selectedDeviceId,
				command,
				amount: amount || undefined,
				enableTipPrompt,
				invoice: invoice || undefined,
				tip: tip || undefined,
				environment: $config.selectedEnvironment,
				customBaseUrl: $config.customBaseUrl
			});

			stopTimer();
			const debug = extractDebugInfo(result);
			const cleanResponse = stripDebugFromResponse(result);

			// Fill in the response side of the debug panel
			if (debug) {
				v2session.setDebugResponse(debug.response);
			}

			if (result.xResult === 'E' || result.error) {
				error = (result.xError as string) || (result.error as string) || 'Transaction failed';
				v2session.setError(error, undefined, result.xError as string);
			} else {
				v2session.setCompleted({
					refnum: result.xRefnum as string,
					result: result.xResult as string,
					xStatus: result.xStatus as string,
					xError: result.xError as string,
					maskedCardNumber: result.xMaskedCardNumber as string,
					authCode: result.xAuthCode as string,
					batch: result.xBatch as string,
					cardType: result.xCardType as string,
					exp: result.xExp as string,
					token: result.xToken as string,
					aid: result.xAID as string,
					currency: result.xCurrency as string,
					date: result.xDate as string,
					isEMV: result.xIsEMV as boolean,
					isVoid: result.xVoid as boolean,
					isVoidable: result.xVoidable as boolean,
					remainingBalance: result.xRemainingBalance as string,
					responseData: cleanResponse
				});
			}
		} catch (e) {
			stopTimer();
			// Fill in the response debug with error info
			v2session.setDebugResponse({
				status: 0,
				statusText: 'Error',
				headers: {},
				body: { error: e instanceof Error ? e.message : String(e) }
			});

			if (e instanceof DOMException && e.name === 'AbortError') {
				v2session.setCancelled();
			} else {
				error = e instanceof Error ? e.message : 'Failed to process transaction';
				v2session.setError(error);
			}
		}
	}

	async function handleCancel() {
		if (!$config.apiKey || !$selectedDeviceId) return;

		isCancelling = true;

		// Set cancel request debug immediately (before fetch)
		const cancelUrl = getCancelEndpointUrl($config.selectedEnvironment, $config.customBaseUrl);
		v2session.setCancelDebugRequest({
			request: {
				method: 'POST',
				url: cancelUrl,
				headers: { 'Content-Type': 'application/json', 'Authorization': '[REDACTED]' },
				body: { xDeviceId: $selectedDeviceId }
			},
			response: {
				status: 0,
				statusText: 'Pending...',
				headers: {},
				body: null
			}
		});

		try {
			const result = await cancelV2Session(
				$config.apiKey,
				$selectedDeviceId,
				undefined,
				$config.selectedEnvironment,
				$config.customBaseUrl
			);
			const debug = extractDebugInfo(result);
			if (debug) {
				v2session.setCancelDebugResponse(debug.response);
			}
		} catch (e) {
			// Fill cancel response debug with error info
			v2session.setCancelDebugResponse({
				status: 0,
				statusText: 'Error',
				headers: {},
				body: { error: e instanceof Error ? e.message : String(e) }
			});
			error = e instanceof Error ? e.message : 'Failed to send cancel request';
		} finally {
			isCancelling = false;
		}
	}

	function clearForm() {
		stopTimer();
		amount = '';
		invoice = '';
		tip = '';
		enableTipPrompt = false;
		error = null;
		isCancelling = false;
		v2session.clear();
	}
</script>

<div class="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-5">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold text-gray-100">Transaction (V2 Sync)</h2>
		{#if !isIdle || $v2session.status !== 'idle'}
			<button
				onclick={clearForm}
				class="text-sm text-gray-400 hover:text-gray-200"
			>
				Clear
			</button>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-400 flex items-center justify-between">
			<span>{error}</span>
			<button
				onclick={() => error = null}
				class="p-1 text-red-400 hover:text-red-200 hover:bg-red-800/50 rounded transition-colors flex-shrink-0 ml-2"
				title="Dismiss"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"/>
					<line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		</div>
	{/if}

	{#if !$config.apiKey}
		<p class="text-sm text-gray-500 italic">Configure your API key to process transactions</p>
	{:else if !$selectedDevice}
		<p class="text-sm text-gray-500 italic">Select a device to process transactions</p>
	{:else if !isDeviceConnected && !bypassStatusCheck}
		<div class="flex items-center justify-between p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
			<div class="flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
					<line x1="12" y1="9" x2="12" y2="13"/>
					<line x1="12" y1="17" x2="12.01" y2="17"/>
				</svg>
				<span class="text-sm text-yellow-400">Device reports as disconnected (Status: {$selectedDevice.xDeviceStatus || 'Unknown'})</span>
			</div>
			<button
				onclick={() => bypassStatusCheck = true}
				class="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
			>
				Try Anyway
			</button>
		</div>
	{:else}
		<div class="space-y-4">
			{#if bypassStatusCheck && !isDeviceConnected}
				<div class="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm text-yellow-400">
					<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
						<line x1="12" y1="9" x2="12" y2="13"/>
						<line x1="12" y1="17" x2="12.01" y2="17"/>
					</svg>
					<span>Bypassing status check - device reports as {$selectedDevice?.xDeviceStatus || 'Unknown'}</span>
				</div>
			{/if}

			<!-- First Row: Transaction Type and Amount -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="v2-command" class="block text-sm font-medium text-gray-300 mb-1">
						Transaction Type
					</label>
					<select
						id="v2-command"
						bind:value={command}
						disabled={isPending}
						class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400"
					>
						{#each TRANSACTION_TYPES as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>

				{#if selectedType?.requiresAmount}
					<div>
						<label for="v2-amount" class="block text-sm font-medium text-gray-300 mb-1">
							Amount *
						</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
							<input
								id="v2-amount"
								type="number"
								step="0.01"
								min="0"
								bind:value={amount}
								disabled={isPending}
								placeholder="0.00"
								class="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400 placeholder-gray-500"
							/>
						</div>
					</div>
				{/if}
			</div>

			<!-- Second Row: Invoice and Tip -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="v2-invoice" class="block text-sm font-medium text-gray-300 mb-1">
						Invoice (optional)
					</label>
					<input
						id="v2-invoice"
						type="text"
						maxlength="20"
						bind:value={invoice}
						disabled={isPending}
						placeholder="Invoice number"
						class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400 placeholder-gray-500"
					/>
				</div>

				{#if command.startsWith('cc:')}
					<div>
						<label for="v2-tip" class="block text-sm font-medium text-gray-300 mb-1">
							Tip (optional)
						</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
							<input
								id="v2-tip"
								type="number"
								step="0.01"
								min="0"
								bind:value={tip}
								disabled={isPending}
								placeholder="0.00"
								class="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400 placeholder-gray-500"
							/>
						</div>
					</div>
				{/if}
			</div>

			<!-- Third Row: Tip Prompt Checkbox -->
			{#if command.startsWith('cc:')}
				<div>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={enableTipPrompt}
							disabled={isPending}
							class="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-300">Enable tip prompt on device</span>
					</label>
				</div>
			{/if}

			<!-- Button Row -->
			<div class="flex gap-3 pt-2">
				{#if isPending}
					<!-- Waiting state with elapsed timer and cancel -->
					<div class="flex items-center gap-4 w-full">
						<div class="flex items-center gap-3 flex-1">
							<div class="flex items-center gap-2">
								<svg class="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span class="text-sm text-blue-400">Waiting for device response...</span>
							</div>
							<span class="text-sm font-mono text-gray-400">{formatElapsed(elapsedSeconds)}</span>
						</div>
						<button
							onclick={handleCancel}
							disabled={isCancelling}
							class="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isCancelling ? 'Cancelling...' : 'Cancel Transaction'}
						</button>
					</div>
				{:else}
					<button
						onclick={handleRunTransaction}
						disabled={!canSubmit || !isIdle}
						class="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						Run Transaction
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
