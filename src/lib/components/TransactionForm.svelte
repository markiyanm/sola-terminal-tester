<script lang="ts">
	import { config } from '$lib/stores/config';
	import { selectedDevice, selectedDeviceId } from '$lib/stores/devices';
	import { session, type DebugInfo } from '$lib/stores/session';
	import { initiateSession, cancelSession } from '$lib/api/client';
	
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
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let bypassStatusCheck = $state(false);
	
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
	let canSubmit = $derived(
		$config.apiKey && 
		$selectedDeviceId && 
		(isDeviceConnected || bypassStatusCheck) &&
		(!selectedType?.requiresAmount || (amount && parseFloat(amount) > 0))
	);
	
	// Terminal states where the session is done and user can start a new transaction
	const TERMINAL_STATES = ['COMPLETED', 'ERROR', 'TIMEOUT', 'USER_CANCELLED', 'API_CANCELLED'];
	let isSessionTerminal = $derived(
		!$session.sessionId || TERMINAL_STATES.includes($session.status || '')
	);
	let canCancel = $derived(
		$session.sessionId && !TERMINAL_STATES.includes($session.status || '')
	);
	
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
	
	async function handleInitiate() {
		if (!$config.apiKey || !$selectedDeviceId) return;
		
		isLoading = true;
		error = null;
		session.clear();
		session.setLoading(true);
		
		try {
			const result = await initiateSession({
				apiKey: $config.apiKey,
				deviceId: $selectedDeviceId,
				command,
				amount: amount || undefined,
				enableTipPrompt,
				invoice: invoice || undefined,
				tip: tip || undefined,
				environment: $config.selectedEnvironment
			});
			
			const debug = extractDebugInfo(result);
			if (debug) {
				session.setInitiateDebug(debug);
			}
			session.setLastResponse(stripDebugFromResponse(result));
			
			if (result.xResult === 'S' && result.xSessionId && result.xRefnum) {
				session.setSession(result.xSessionId as string, result.xRefnum as string);
			} else {
				error = (result.xError as string) || 'Failed to initiate transaction';
				session.setError(error);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to initiate transaction';
			session.setError(error);
		} finally {
			isLoading = false;
			session.setLoading(false);
		}
	}
	
	async function handleCancel() {
		const sessionId = $session.sessionId;
		const deviceId = $selectedDeviceId;
		if (!$config.apiKey || !sessionId || !deviceId) return;
		
		isLoading = true;
		error = null;
		
		try {
			const result = await cancelSession($config.apiKey, sessionId, deviceId, $config.selectedEnvironment);
			const debug = extractDebugInfo(result);
			if (debug) {
				session.setSessionStatusDebug(debug);
			}
			session.setLastResponse(stripDebugFromResponse(result));
			
			if (result.xResult === 'S') {
				session.setStatus('API_CANCELLED');
			} else {
				// Cancel failed - clear session so user can start a new transaction
				error = (result.xError as string) || 'Failed to cancel session';
				session.clear();
			}
		} catch (e) {
			// Cancel failed - clear session so user can start a new transaction
			error = e instanceof Error ? e.message : 'Failed to cancel session';
			session.clear();
		} finally {
			isLoading = false;
		}
	}
	
	function clearForm() {
		amount = '';
		invoice = '';
		tip = '';
		enableTipPrompt = false;
		error = null;
		session.clear();
	}
</script>

<div class="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-5">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold text-gray-100">Transaction</h2>
		{#if $session.sessionId}
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
					<label for="command" class="block text-sm font-medium text-gray-300 mb-1">
						Transaction Type
					</label>
					<select
						id="command"
						bind:value={command}
						disabled={!isSessionTerminal}
						class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400"
					>
						{#each TRANSACTION_TYPES as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>
				
				{#if selectedType?.requiresAmount}
					<div>
						<label for="amount" class="block text-sm font-medium text-gray-300 mb-1">
							Amount *
						</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
							<input
								id="amount"
								type="number"
								step="0.01"
								min="0"
								bind:value={amount}
								disabled={!isSessionTerminal}
								placeholder="0.00"
								class="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400 placeholder-gray-500"
							/>
						</div>
					</div>
				{/if}
			</div>
			
			<!-- Second Row: Invoice and Tip (if CC transaction) -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="invoice" class="block text-sm font-medium text-gray-300 mb-1">
						Invoice (optional)
					</label>
					<input
						id="invoice"
						type="text"
						maxlength="20"
						bind:value={invoice}
						disabled={!isSessionTerminal}
						placeholder="Invoice number"
						class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400 placeholder-gray-500"
					/>
				</div>
				
				{#if command.startsWith('cc:')}
					<div>
						<label for="tip" class="block text-sm font-medium text-gray-300 mb-1">
							Tip (optional)
						</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
							<input
								id="tip"
								type="number"
								step="0.01"
								min="0"
								bind:value={tip}
								disabled={!isSessionTerminal}
								placeholder="0.00"
								class="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:text-gray-400 placeholder-gray-500"
							/>
						</div>
					</div>
				{/if}
			</div>
			
			<!-- Third Row: Tip Prompt Checkbox (if CC transaction) -->
			{#if command.startsWith('cc:')}
				<div>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={enableTipPrompt}
							disabled={!isSessionTerminal}
							class="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-300">Enable tip prompt on device</span>
					</label>
				</div>
			{/if}
			
			<!-- Button Row -->
			<div class="flex gap-3 pt-2">
				{#if isSessionTerminal}
					<button
						onclick={handleInitiate}
						disabled={!canSubmit || isLoading}
						class="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{isLoading ? 'Initiating...' : 'Initiate Transaction'}
					</button>
				{:else}
					<button
						onclick={handleCancel}
						disabled={isLoading || !canCancel}
						class="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{isLoading ? 'Canceling...' : 'Cancel Transaction'}
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
