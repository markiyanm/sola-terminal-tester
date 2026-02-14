<script lang="ts">
	import { config } from '$lib/stores/config';
	import { v2session } from '$lib/stores/v2session';
	import { getTransactionReport } from '$lib/api/client';
	import type { DebugInfo } from '$lib/stores/session';

	let isCheckingReport = $state(false);
	let error = $state<string | null>(null);

	let reportRefNum = $derived($v2session.refnum);

	let statusColor = $derived(() => {
		const s = $v2session.xStatus || $v2session.status;
		switch (s) {
			case 'Approved':
			case 'Success':
			case 'completed': return 'text-green-400';
			case 'InProgress':
			case 'pending': return 'text-blue-400';
			case 'Error':
			case 'Declined':
			case 'error': return 'text-red-400';
			case 'cancelled': return 'text-yellow-400';
			default: return 'text-gray-400';
		}
	});

	let resultColor = $derived(() => {
		switch ($v2session.result) {
			case 'A': return 'text-green-400';  // Approved
			case 'S': return 'text-green-400';  // Success
			case 'E': return 'text-red-400';    // Error
			case 'D': return 'text-red-400';    // Declined
			case 'I': return 'text-blue-400';   // InProgress
			default: return 'text-gray-400';
		}
	});

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

	async function checkTransactionResult() {
		if (!$config.apiKey || !reportRefNum) return;

		isCheckingReport = true;
		error = null;

		try {
			const result = await getTransactionReport($config.apiKey, reportRefNum);
			const debug = extractDebugInfo(result as Record<string, unknown>);
			v2session.setReportData(
				stripDebugFromResponse(result as Record<string, unknown>),
				debug
			);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to get transaction report';
		} finally {
			isCheckingReport = false;
		}
	}

	function formatJson(obj: unknown): string {
		return JSON.stringify(obj, null, 2);
	}
</script>

<div class="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-5">
	<h2 class="text-lg font-semibold text-gray-100 mb-4">Results</h2>

	{#if error}
		<div class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-400">
			{error}
		</div>
	{/if}

	{#if $v2session.status === 'idle'}
		<p class="text-sm text-gray-500 italic">Run a transaction to see results</p>
	{:else}
		<div class="space-y-6">
			<!-- Session Info (only shown after response arrives) -->
			{#if $v2session.status !== 'pending'}
				<div class="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-800 rounded-lg">
					{#if $v2session.refnum}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Ref#</p>
							<p class="text-sm font-mono text-gray-100 break-all">{$v2session.refnum}</p>
						</div>
					{/if}
					{#if $v2session.result}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Result</p>
							<p class="text-sm font-semibold {resultColor()}">{$v2session.result}</p>
						</div>
					{/if}
					{#if $v2session.xStatus}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Status</p>
							<p class="text-sm font-semibold {statusColor()}">{$v2session.xStatus}</p>
						</div>
					{:else if $v2session.status === 'error'}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Status</p>
							<p class="text-sm font-semibold text-red-400">Error</p>
						</div>
					{:else if $v2session.status === 'cancelled'}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Status</p>
							<p class="text-sm font-semibold text-yellow-400">Cancelled</p>
						</div>
					{:else}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Status</p>
							<p class="text-sm font-semibold {statusColor()}">{$v2session.status}</p>
						</div>
					{/if}
					{#if $v2session.status === 'error' || $v2session.status === 'cancelled'}
						<div class="col-span-2 md:col-span-3">
							<p class="text-xs text-gray-500 uppercase tracking-wide">
								{$v2session.status === 'cancelled' ? 'Info' : 'Error'}
							</p>
							<p class="text-sm font-mono {$v2session.status === 'cancelled' ? 'text-yellow-400' : 'text-red-400'} break-all">
								{$v2session.error}
							</p>
							{#if $v2session.xError && $v2session.xError !== $v2session.error}
								<p class="text-xs font-mono text-red-400/70 mt-1 break-all">
									xError: {$v2session.xError}
								</p>
							{/if}
						</div>
					{:else if $v2session.xError}
						<div class="col-span-2 md:col-span-3">
							<p class="text-xs text-gray-500 uppercase tracking-wide">Error</p>
							<p class="text-sm font-mono text-red-400 break-all">{$v2session.xError}</p>
						</div>
					{/if}
					{#if $v2session.maskedCardNumber}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Card</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.maskedCardNumber}</p>
						</div>
					{/if}
					{#if $v2session.cardType}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Card Type</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.cardType}</p>
						</div>
					{/if}
					{#if $v2session.authCode}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Auth Code</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.authCode}</p>
						</div>
					{/if}
					{#if $v2session.batch}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Batch</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.batch}</p>
						</div>
					{/if}
					{#if $v2session.exp}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Exp</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.exp}</p>
						</div>
					{/if}
					{#if $v2session.token}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Token</p>
							<p class="text-sm font-mono text-gray-100 break-all">{$v2session.token}</p>
						</div>
					{/if}
					{#if $v2session.aid}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">AID</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.aid}</p>
						</div>
					{/if}
					{#if $v2session.isEMV !== null}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">EMV</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.isEMV ? 'Yes' : 'No'}</p>
						</div>
					{/if}
					{#if $v2session.remainingBalance}
						<div>
							<p class="text-xs text-gray-500 uppercase tracking-wide">Remaining Balance</p>
							<p class="text-sm font-mono text-gray-100">{$v2session.remainingBalance}</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- ==================== SECTION 1: V2 Session ==================== -->
			<div class="border-t-2 border-gray-700 pt-6">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">1</div>
					<h3 class="text-md font-semibold text-gray-200">V2 Session (Synchronous)</h3>
				</div>

				{#if $v2session.debug}
					<div class="grid grid-cols-2 gap-2">
						<!-- Request Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-green-400">REQUEST</span>
								<span class="text-xs text-gray-400 ml-2">
									{$v2session.debug.request.method} {$v2session.debug.request.url}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($v2session.debug.request.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($v2session.debug.request.body)}</pre>
						</div>

						<!-- Response Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-blue-400">RESPONSE</span>
								{#if $v2session.debugResponsePending}
									<span class="text-xs text-yellow-400 ml-2">Pending...</span>
								{:else}
									<span class="text-xs ml-2 {$v2session.debug.response.status >= 200 && $v2session.debug.response.status < 300 ? 'text-green-400' : 'text-red-400'}">
										{$v2session.debug.response.status} {$v2session.debug.response.statusText}
									</span>
								{/if}
							</div>
							{#if $v2session.debugResponsePending}
								<div class="p-3 flex items-center gap-2">
									<svg class="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span class="text-xs text-gray-400">Waiting for response...</span>
								</div>
							{:else}
								<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($v2session.debug.response.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($v2session.debug.response.body)}</pre>
							{/if}
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-500 italic">No request data available</p>
				{/if}
			</div>

			<!-- ==================== SECTION 2: Cancel (if used) ==================== -->
			{#if $v2session.cancelDebug}
				<div class="border-t-2 border-gray-700 pt-6">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">
							<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="18" y1="6" x2="6" y2="18"/>
								<line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</div>
						<h3 class="text-md font-semibold text-gray-200">Cancel Request</h3>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<!-- Request Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-green-400">REQUEST</span>
								<span class="text-xs text-gray-400 ml-2">
									{$v2session.cancelDebug.request.method} {$v2session.cancelDebug.request.url}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($v2session.cancelDebug.request.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($v2session.cancelDebug.request.body)}</pre>
						</div>

						<!-- Response Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-blue-400">RESPONSE</span>
								{#if $v2session.cancelDebugResponsePending}
									<span class="text-xs text-yellow-400 ml-2">Pending...</span>
								{:else}
									<span class="text-xs ml-2 {$v2session.cancelDebug.response.status >= 200 && $v2session.cancelDebug.response.status < 300 ? 'text-green-400' : 'text-red-400'}">
										{$v2session.cancelDebug.response.status} {$v2session.cancelDebug.response.statusText}
									</span>
								{/if}
							</div>
							{#if $v2session.cancelDebugResponsePending}
								<div class="p-3 flex items-center gap-2">
									<svg class="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span class="text-xs text-gray-400">Waiting for response...</span>
								</div>
							{:else}
								<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($v2session.cancelDebug.response.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($v2session.cancelDebug.response.body)}</pre>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- ==================== SECTION 3: Reporting API ==================== -->
			{#if $v2session.status !== 'pending'}
				<div class="border-t-2 border-gray-700 pt-6">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">2</div>
						<h3 class="text-md font-semibold text-gray-200">Reporting API</h3>
					</div>

					<div class="flex gap-3 mb-3">
						<button
							onclick={checkTransactionResult}
							disabled={isCheckingReport || !reportRefNum}
							class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
							title={!reportRefNum ? 'No reference number available yet' : ''}
						>
							{isCheckingReport ? 'Checking...' : 'Check Transaction Result'}
						</button>
					</div>

					{#if $v2session.reportDebug}
						<div class="grid grid-cols-2 gap-2">
							<!-- Request Panel -->
							<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
								<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
									<span class="text-xs font-semibold text-green-400">REQUEST</span>
									<span class="text-xs text-gray-400 ml-2">
										{$v2session.reportDebug.request.method} {$v2session.reportDebug.request.url}
									</span>
								</div>
								<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($v2session.reportDebug.request.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($v2session.reportDebug.request.body)}</pre>
							</div>

							<!-- Response Panel -->
							<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
								<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
									<span class="text-xs font-semibold text-blue-400">RESPONSE</span>
									<span class="text-xs ml-2 {$v2session.reportDebug.response.status >= 200 && $v2session.reportDebug.response.status < 300 ? 'text-green-400' : 'text-red-400'}">
										{$v2session.reportDebug.response.status} {$v2session.reportDebug.response.statusText}
									</span>
								</div>
								<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($v2session.reportDebug.response.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($v2session.reportDebug.response.body)}</pre>
							</div>
						</div>
					{:else}
						<p class="text-sm text-gray-500 italic">Click the button to check transaction result</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
