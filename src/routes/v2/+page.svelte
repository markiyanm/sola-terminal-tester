<script lang="ts">
	import { onMount } from 'svelte';
	import { config } from '$lib/stores/config';
	import { devices, selectedDeviceId } from '$lib/stores/devices';
	import ApiKeyConfig from '$lib/components/ApiKeyConfig.svelte';
	import DeviceManager from '$lib/components/DeviceManager.svelte';
	import V2TransactionForm from '$lib/components/V2TransactionForm.svelte';
	import V2ResultDisplay from '$lib/components/V2ResultDisplay.svelte';
	import PageNav from '$lib/components/PageNav.svelte';

	let deviceManager: DeviceManager;

	onMount(() => {
		config.init();
		devices.init();
		selectedDeviceId.init();
	});

	function handleApiKeyChanged() {
		selectedDeviceId.select(null);
		deviceManager?.refreshDevices();
	}
</script>

<svelte:head>
	<title>Sola Terminal Tester - V2 Sync</title>
	<meta name="description" content="Test Sola Terminals via V2 Synchronous API" />
</svelte:head>

<div class="min-h-screen bg-gray-950">
	<!-- Header -->
	<header class="bg-gray-900 shadow-lg border-b border-gray-800">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between h-14">
				<div class="flex items-center gap-3">
					<a href="/">
						<img src="/logo.svg" alt="Sola" class="h-6" />
					</a>
					<span class="text-gray-500">|</span>
					<span class="text-sm text-gray-400">CloudIM / Sola Terminal Test Utility</span>
					<PageNav />
				</div>
				<div class="flex items-center gap-3">
					{#if $config.apiKey}
						{#if $config.selectedEnvironment === 'custom'}
							<span class="px-2 py-1 text-xs font-semibold uppercase rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700">
								CUSTOM
							</span>
						{:else if $config.selectedEnvironment === 'test'}
							<span class="px-2 py-1 text-xs font-semibold uppercase rounded bg-red-900/50 text-red-400 border border-red-700">
								DEV
							</span>
						{:else}
							<span class="px-2 py-1 text-xs font-semibold uppercase rounded bg-green-900/50 text-green-400 border border-green-700">
								PROD
							</span>
						{/if}
					{/if}
					<ApiKeyConfig onKeyChanged={handleApiKeyChanged} />
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Device Table - Full Width -->
		<div class="mb-6">
			<DeviceManager bind:this={deviceManager} />
		</div>

		<!-- Transaction Form - Full Width -->
		<div class="mb-6">
			<V2TransactionForm />
		</div>

		<!-- Results - Full Width -->
		<div class="mb-6">
			<V2ResultDisplay />
		</div>

		<!-- Help Section -->
		<div class="mt-8 p-6 bg-gray-900 rounded-xl shadow-lg border border-gray-800">
			<h2 class="text-lg font-semibold text-gray-100 mb-3">V2 API Quick Reference</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
				<div>
					<h3 class="font-medium text-gray-300 mb-1">How V2 Differs from V1</h3>
					<ul class="text-gray-400 space-y-0.5">
						<li>Single synchronous POST (no polling)</li>
						<li>API key in request body (<code class="text-xs bg-gray-800 text-gray-300 px-1 rounded">xKey</code>), not header</li>
						<li>Flat payload (no <code class="text-xs bg-gray-800 text-gray-300 px-1 rounded">xPayload</code> wrapper)</li>
						<li>Response includes full transaction result</li>
					</ul>
				</div>
				<div>
					<h3 class="font-medium text-gray-300 mb-1">Result Values (xResult)</h3>
					<ul class="text-gray-400 space-y-0.5">
						<li><span class="text-green-400">A</span> - Approved</li>
						<li><span class="text-green-400">S</span> - Success</li>
						<li><span class="text-red-400">E</span> - Error</li>
						<li><span class="text-blue-400">I</span> - In Progress</li>
						<li><span class="text-red-400">D</span> - Declined</li>
					</ul>
				</div>
				<div>
					<h3 class="font-medium text-gray-300 mb-1">Transaction Types</h3>
					<ul class="text-gray-400 space-y-0.5">
						<li><code class="text-xs bg-gray-800 text-gray-300 px-1 rounded">cc:sale</code> - Credit card sale</li>
						<li><code class="text-xs bg-gray-800 text-gray-300 px-1 rounded">cc:authonly</code> - Authorization only</li>
						<li><code class="text-xs bg-gray-800 text-gray-300 px-1 rounded">cc:credit</code> - Refund</li>
						<li><code class="text-xs bg-gray-800 text-gray-300 px-1 rounded">gift:balance</code> - Check balance</li>
					</ul>
				</div>
			</div>
			<div class="mt-4 pt-4 border-t border-gray-800">
				<p class="text-xs text-gray-500">
					For more information, see the
					<a href="https://docs.solapayments.com/products/cloudim-developer-guide" target="_blank" class="text-blue-400 hover:underline">CloudIM Developer Guide</a>
					and
					<a href="https://device.cardknox.com/api/v1/swagger/index.html" target="_blank" class="text-blue-400 hover:underline">Swagger API Docs</a>.
				</p>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="mt-auto py-6 text-center text-sm text-gray-600">
		<p>Internal use only | v1.0.2</p>
	</footer>
</div>
