<script lang="ts">
	import { config } from '$lib/stores/config';
	import { session, type DebugInfo } from '$lib/stores/session';
	import { getSessionStatus, getTransactionReport } from '$lib/api/client';
	
	let isCheckingSession = $state(false);
	let isCheckingReport = $state(false);
	let error = $state<string | null>(null);
	
	// Determine which refnum to use for the report
	let reportRefNum = $derived($session.gatewayRefNum || $session.refNum);
	
	let statusColor = $derived(() => {
		switch ($session.status) {
			case 'COMPLETED': return 'text-green-400';
			case 'PROCESSING':
			case 'INITIATING': return 'text-blue-400';
			case 'TIMEOUT':
			case 'ERROR': return 'text-red-400';
			case 'USER_CANCELLED':
			case 'API_CANCELLED': return 'text-yellow-400';
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
	
	async function checkSessionStatus() {
		if (!$config.apiKey || !$session.sessionId) return;
		
		isCheckingSession = true;
		error = null;
		
		try {
			const result = await getSessionStatus($config.apiKey, $session.sessionId, $config.selectedEnvironment, $config.customBaseUrl);
			const debug = extractDebugInfo(result);
			if (debug) {
				session.setSessionStatusDebug(debug);
			}
			session.setLastResponse(stripDebugFromResponse(result));
			
			if (result.xSessionStatus) {
				session.setStatus(result.xSessionStatus as string, result.xGatewayRefnum as string);
			}
			if (result.xError) {
				error = result.xError as string;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to check session status';
		} finally {
			isCheckingSession = false;
		}
	}
	
	async function checkTransactionResult() {
		if (!$config.apiKey || !reportRefNum) return;
		
		isCheckingReport = true;
		error = null;
		
		try {
			const result = await getTransactionReport($config.apiKey, reportRefNum);
			const debug = extractDebugInfo(result);
			if (debug) {
				session.setReportDebug(debug);
			}
			session.setLastReportResponse(stripDebugFromResponse(result));
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
	
	{#if !$session.sessionId}
		<p class="text-sm text-gray-500 italic">Initiate a transaction to see results</p>
	{:else}
		<div class="space-y-6">
			<!-- Session Info -->
			<div class="grid grid-cols-2 gap-4 p-4 bg-gray-800 rounded-lg">
				<div>
					<p class="text-xs text-gray-500 uppercase tracking-wide">Session ID</p>
					<p class="text-sm font-mono text-gray-100 break-all">{$session.sessionId}</p>
				</div>
				<div>
					<p class="text-xs text-gray-500 uppercase tracking-wide">CloudIM Ref#</p>
					<p class="text-sm font-mono text-gray-100 break-all">{$session.refNum || '-'}</p>
				</div>
				{#if $session.gatewayRefNum}
					<div>
						<p class="text-xs text-gray-500 uppercase tracking-wide">Gateway Ref#</p>
						<p class="text-sm font-mono text-gray-100 break-all">{$session.gatewayRefNum}</p>
					</div>
				{/if}
				<div>
					<p class="text-xs text-gray-500 uppercase tracking-wide">Status</p>
					<p class="text-sm font-semibold {statusColor()}">{$session.status || 'Unknown'}</p>
				</div>
			</div>
			
			<!-- ==================== SECTION 1: Initiate Session ==================== -->
			<div class="border-t-2 border-gray-700 pt-6">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">1</div>
					<h3 class="text-md font-semibold text-gray-200">Initiate Session</h3>
				</div>
				
				{#if $session.initiateDebug}
					<div class="grid grid-cols-2 gap-2">
						<!-- Request Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-green-400">REQUEST</span>
								<span class="text-xs text-gray-400 ml-2">
									{$session.initiateDebug.request.method} {$session.initiateDebug.request.url}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($session.initiateDebug.request.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($session.initiateDebug.request.body)}</pre>
						</div>
						
						<!-- Response Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-blue-400">RESPONSE</span>
								<span class="text-xs ml-2 {$session.initiateDebug.response.status >= 200 && $session.initiateDebug.response.status < 300 ? 'text-green-400' : 'text-red-400'}">
									{$session.initiateDebug.response.status} {$session.initiateDebug.response.statusText}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($session.initiateDebug.response.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($session.initiateDebug.response.body)}</pre>
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-500 italic">No initiate request data available</p>
				{/if}
			</div>
			
			<!-- ==================== SECTION 2: Check Session Status ==================== -->
			<div class="border-t-2 border-gray-700 pt-6">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">2</div>
					<h3 class="text-md font-semibold text-gray-200">Check Session Status</h3>
				</div>
				
				<div class="flex gap-3 mb-3">
					<button
						onclick={checkSessionStatus}
						disabled={isCheckingSession}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
					>
						{isCheckingSession ? 'Checking...' : 'Check Session Status'}
					</button>
				</div>
				
				{#if $session.sessionStatusDebug}
					<div class="grid grid-cols-2 gap-2">
						<!-- Request Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-green-400">REQUEST</span>
								<span class="text-xs text-gray-400 ml-2">
									{$session.sessionStatusDebug.request.method} {$session.sessionStatusDebug.request.url}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($session.sessionStatusDebug.request.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($session.sessionStatusDebug.request.body)}</pre>
						</div>
						
						<!-- Response Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-blue-400">RESPONSE</span>
								<span class="text-xs ml-2 {$session.sessionStatusDebug.response.status >= 200 && $session.sessionStatusDebug.response.status < 300 ? 'text-green-400' : 'text-red-400'}">
									{$session.sessionStatusDebug.response.status} {$session.sessionStatusDebug.response.statusText}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($session.sessionStatusDebug.response.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($session.sessionStatusDebug.response.body)}</pre>
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-500 italic">Click the button to check session status</p>
				{/if}
			</div>
			
			<!-- ==================== SECTION 3: Reporting API ==================== -->
			<div class="border-t-2 border-gray-700 pt-6">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">3</div>
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
				
				{#if $session.reportDebug}
					<div class="grid grid-cols-2 gap-2">
						<!-- Request Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-green-400">REQUEST</span>
								<span class="text-xs text-gray-400 ml-2">
									{$session.reportDebug.request.method} {$session.reportDebug.request.url}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($session.reportDebug.request.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($session.reportDebug.request.body)}</pre>
						</div>
						
						<!-- Response Panel -->
						<div class="bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
							<div class="bg-gray-800 px-3 py-2 border-b border-gray-700">
								<span class="text-xs font-semibold text-blue-400">RESPONSE</span>
								<span class="text-xs ml-2 {$session.reportDebug.response.status >= 200 && $session.reportDebug.response.status < 300 ? 'text-green-400' : 'text-red-400'}">
									{$session.reportDebug.response.status} {$session.reportDebug.response.statusText}
								</span>
							</div>
							<pre class="p-3 text-xs text-gray-100 overflow-x-auto max-h-64 overflow-y-auto"><span class="text-gray-500">// Headers</span>
{formatJson($session.reportDebug.response.headers)}

<span class="text-gray-500">// Body</span>
{formatJson($session.reportDebug.response.body)}</pre>
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-500 italic">Click the button to check transaction result</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
