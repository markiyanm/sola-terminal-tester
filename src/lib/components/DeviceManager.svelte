<script lang="ts">
	import { config } from '$lib/stores/config';
	import { devices, selectedDeviceId, selectedDevice, type Device } from '$lib/stores/devices';
	import { registerDevice, listDevices, getDeviceStatus, updateDevice, deleteDevice } from '$lib/api/client';
	
	let showRegisterModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteConfirm = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let copiedField = $state<string | null>(null);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastRefreshTime = $state<Date | null>(null);
	
	// Track API key changes to clear errors
	let lastApiKey = $state<string | null>(null);
	$effect(() => {
		if ($config.apiKey !== lastApiKey) {
			lastApiKey = $config.apiKey;
			error = null;
		}
	});
	
	// Track device selection changes to clear errors
	let lastSelectedDeviceId = $state<string | null>(null);
	$effect(() => {
		if ($selectedDeviceId !== lastSelectedDeviceId) {
			lastSelectedDeviceId = $selectedDeviceId;
			error = null;
		}
	});
	
	function formatRefreshTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
	
	// Register form fields
	let serialNumber = $state('');
	let deviceMake = $state('pax');
	let friendlyName = $state('');
	
	// Edit form fields
	let editDeviceId = $state('');
	let editFriendlyName = $state('');
	
	async function handleRegister() {
		if (!$config.apiKey) {
			error = 'Please configure your API key first';
			return;
		}
		
		if (!serialNumber.trim() || !friendlyName.trim()) {
			error = 'Serial number and friendly name are required';
			return;
		}
		
		isLoading = true;
		error = null;
		
		try {
			const result = await registerDevice(
				$config.apiKey,
				serialNumber.trim(),
				deviceMake,
				friendlyName.trim(),
				$config.selectedEnvironment
			);
			
			if (result.xResult === 'S' && result.xDeviceId) {
				devices.addDevice({
					xDeviceId: result.xDeviceId,
					xDeviceSerialNumber: serialNumber.trim(),
					xDeviceMake: deviceMake,
					xDeviceFriendlyName: friendlyName.trim(),
					xDeviceStatus: 'UNKNOWN'
				});
				
				// Auto-select the new device
				selectedDeviceId.select(result.xDeviceId);
				
				// Reset form and close modal
				serialNumber = '';
				friendlyName = '';
				showRegisterModal = false;
				
				// Fetch status for the new device
				await refreshDeviceStatus(result.xDeviceId);
			} else {
				error = result.xError || 'Failed to register device';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to register device';
		} finally {
			isLoading = false;
		}
	}
	
	export async function refreshDevices() {
		if (!$config.apiKey) {
			error = 'Please configure your API key first';
			return;
		}
		
		isLoading = true;
		error = null;
		// Clear devices immediately to avoid showing stale data during refresh
		devices.setDevices([]);
		
		try {
			const result = await listDevices($config.apiKey, $config.selectedEnvironment);
			
			if (result.xResult === 'S' && result.xDevices) {
				devices.setDevices(result.xDevices);
				lastRefreshTime = new Date();
			} else if (result.error || result.xError) {
				error = result.error || result.xError || 'Failed to list devices';
				lastRefreshTime = null;
			}
			// If no devices found, list stays empty (already cleared above)
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to list devices';
			lastRefreshTime = null;
		} finally {
			isLoading = false;
		}
	}
	
	async function refreshDeviceStatus(deviceId: string) {
		if (!$config.apiKey) return;
		
		try {
			const result = await getDeviceStatus($config.apiKey, deviceId, $config.selectedEnvironment);
			if (result.xDeviceStatus) {
				devices.updateDeviceStatus(deviceId, result.xDeviceStatus);
			}
		} catch (e) {
			console.error('Failed to get device status:', e);
		}
	}
	
	async function refreshSelectedDeviceStatus() {
		if ($selectedDeviceId) {
			isLoading = true;
			await refreshDeviceStatus($selectedDeviceId);
			isLoading = false;
		}
	}
	
	function selectDevice(deviceId: string) {
		selectedDeviceId.select(deviceId);
	}
	
	function openEditModal(device: Device, event: Event) {
		event.stopPropagation();
		editDeviceId = device.xDeviceId;
		editFriendlyName = device.xDeviceFriendlyName || '';
		error = null;
		showDeleteConfirm = false;
		showEditModal = true;
	}
	
	function truncateDeviceId(deviceId: string, startChars: number = 6, endChars: number = 4): string {
		if (!deviceId || deviceId.length <= startChars + endChars) {
			return deviceId;
		}
		return `${deviceId.slice(0, startChars)}....${deviceId.slice(-endChars)}`;
	}
	
	async function copyToClipboard(text: string, fieldKey: string, event?: Event) {
		if (event) {
			event.stopPropagation();
		}
		try {
			await navigator.clipboard.writeText(text);
			copiedField = fieldKey;
			if (copyTimeout) {
				clearTimeout(copyTimeout);
			}
			copyTimeout = setTimeout(() => {
				copiedField = null;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}
	
	async function handleUpdateDevice() {
		if (!$config.apiKey || !editDeviceId) return;
		
		if (!editFriendlyName.trim()) {
			error = 'Friendly name is required';
			return;
		}
		
		isLoading = true;
		error = null;
		
		try {
			const result = await updateDevice($config.apiKey, editDeviceId, editFriendlyName.trim(), $config.selectedEnvironment);
			
			if (result.xResult === 'S') {
				devices.addDevice({
					xDeviceId: editDeviceId,
					xDeviceFriendlyName: editFriendlyName.trim()
				});
				showEditModal = false;
			} else {
				error = result.xError || result.error || 'Failed to update device';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update device';
		} finally {
			isLoading = false;
		}
	}
	
	function confirmDelete() {
		showDeleteConfirm = true;
	}
	
	async function handleDeleteDevice() {
		if (!$config.apiKey || !editDeviceId) {
			error = 'Please configure your API key first';
			return;
		}
		
		isLoading = true;
		error = null;
		showDeleteConfirm = false;
		
		try {
			const result = await deleteDevice($config.apiKey, editDeviceId, $config.selectedEnvironment);
			
			if (result.xResult === 'S') {
				devices.removeDevice(editDeviceId);
				if ($selectedDeviceId === editDeviceId) {
					selectedDeviceId.select(null);
				}
				showEditModal = false;
				showDeleteConfirm = false;
			} else {
				error = result.xError || result.error || 'Failed to delete device';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete device';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-5">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold text-gray-100">Devices</h2>
		<div class="flex items-center gap-2">
			{#if lastRefreshTime}
				<span class="text-xs text-gray-500">
					Last updated: {formatRefreshTime(lastRefreshTime)}
				</span>
			{/if}
			<button
				onclick={refreshDevices}
				disabled={isLoading || !$config.apiKey}
				class="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg disabled:opacity-50 transition-colors"
				title="Refresh device list"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 {isLoading ? 'animate-spin' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
					<path d="M21 3v5h-5"/>
				</svg>
			</button>
			<button
				onclick={() => showRegisterModal = true}
				disabled={!$config.apiKey}
				class="flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Register
			</button>
		</div>
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
		<p class="text-sm text-gray-500 italic">Configure your API key to manage devices</p>
	{:else if $devices.length === 0}
		<p class="text-sm text-gray-500 italic">No devices registered</p>
	{:else}
		<div class="overflow-x-auto -mx-5">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-700 bg-gray-800">
						<th class="w-10 px-3 py-2"></th>
						<th class="px-3 py-2 text-left font-medium text-gray-400">Status</th>
						<th class="px-3 py-2 text-left font-medium text-gray-400">Name</th>
						<th class="px-3 py-2 text-left font-medium text-gray-400">Device ID</th>
						<th class="px-3 py-2 text-left font-medium text-gray-400">Serial #</th>
						<th class="px-3 py-2 text-left font-medium text-gray-400">Model</th>
						<th class="px-3 py-2 text-left font-medium text-gray-400">IP Address</th>
						<th class="px-3 py-2 text-left font-medium text-gray-400">App Ver</th>
						<th class="w-10 px-3 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each $devices as device}
						<tr 
							onclick={() => selectDevice(device.xDeviceId)}
							class="border-b border-gray-800 cursor-pointer transition-colors
								{$selectedDeviceId === device.xDeviceId 
									? 'bg-blue-900/30 hover:bg-blue-900/50' 
									: 'hover:bg-gray-800'}"
						>
							<td class="px-3 py-3 text-center">
								{#if $selectedDeviceId === device.xDeviceId}
									<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-400 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<path d="M20 6L9 17l-5-5"/>
									</svg>
								{/if}
							</td>
							<td class="px-3 py-3">
								<span class="flex items-center gap-1.5">
									<span class="w-2.5 h-2.5 rounded-full flex-shrink-0
										{device.xDeviceStatus === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}">
									</span>
									<span class="text-xs font-medium
										{device.xDeviceStatus === 'CONNECTED' ? 'text-green-400' : 'text-red-400'}">
										{device.xDeviceStatus || 'Unknown'}
									</span>
								</span>
							</td>
							<td class="px-3 py-3">
								<span class="font-medium text-gray-100">{device.xDeviceFriendlyName || '-'}</span>
							</td>
							<td class="px-3 py-3">
								<div class="flex items-center gap-1">
									<span class="font-mono text-gray-400" title={device.xDeviceId}>
										{device.xDeviceId ? truncateDeviceId(device.xDeviceId) : '-'}
									</span>
									{#if device.xDeviceId}
										<button
											onclick={(e) => copyToClipboard(device.xDeviceId, `deviceId-${device.xDeviceId}`, e)}
											class="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
											title="Copy Device ID"
										>
											{#if copiedField === `deviceId-${device.xDeviceId}`}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M20 6L9 17l-5-5"/>
												</svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
													<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
												</svg>
											{/if}
										</button>
									{/if}
								</div>
							</td>
							<td class="px-3 py-3">
								<div class="flex items-center gap-1">
									<span class="font-mono text-gray-400">{device.xDeviceSerialNumber || '-'}</span>
									{#if device.xDeviceSerialNumber}
										<button
											onclick={(e) => copyToClipboard(device.xDeviceSerialNumber!, `serial-${device.xDeviceId}`, e)}
											class="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
											title="Copy Serial Number"
										>
											{#if copiedField === `serial-${device.xDeviceId}`}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M20 6L9 17l-5-5"/>
												</svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
													<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
												</svg>
											{/if}
										</button>
									{/if}
								</div>
							</td>
							<td class="px-3 py-3 text-gray-400">
								{#if device.xDeviceMake || device.xDeviceModel}
									{device.xDeviceMake?.toUpperCase() || ''} {device.xDeviceModel || ''}
								{:else}
									-
								{/if}
							</td>
							<td class="px-3 py-3 font-mono text-gray-400">{device.xDeviceLocalIpAddress || '-'}</td>
							<td class="px-3 py-3 text-gray-400">{device.xDeviceCardknoxApplicationVersion || '-'}</td>
							<td class="px-3 py-3">
								<button
									onclick={(e) => openEditModal(device, e)}
									class="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
									title="Edit device"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
										<path d="m15 5 4 4"/>
									</svg>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if showRegisterModal}
	<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
		<div class="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-700">
			<h2 class="text-xl font-semibold text-gray-100 mb-4">Register New Device</h2>
			
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
			
			<div class="space-y-4">
				<div>
					<label for="serial-number" class="block text-sm font-medium text-gray-300 mb-1">
						Serial Number *
					</label>
					<input
						id="serial-number"
						type="text"
						bind:value={serialNumber}
						placeholder="e.g., 1234567890"
						class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
					/>
				</div>
				
				<div>
					<label for="device-make" class="block text-sm font-medium text-gray-300 mb-1">
						Device Make
					</label>
					<select
						id="device-make"
						bind:value={deviceMake}
						class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="pax">PAX</option>
					</select>
					<p class="text-xs text-gray-500 mt-1">Currently only PAX A-series devices are supported</p>
				</div>
				
				<div>
					<label for="friendly-name" class="block text-sm font-medium text-gray-300 mb-1">
						Friendly Name *
					</label>
					<input
						id="friendly-name"
						type="text"
						bind:value={friendlyName}
						placeholder="e.g., Terminal 1"
						class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
					/>
				</div>
			</div>
			
			<div class="flex gap-3 mt-6">
				<button
					onclick={handleRegister}
					disabled={isLoading || !serialNumber.trim() || !friendlyName.trim()}
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{isLoading ? 'Registering...' : 'Register Device'}
				</button>
				<button
					onclick={() => { showRegisterModal = false; error = null; }}
					class="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 border border-gray-600 transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showEditModal}
	<div 
		class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" 
		role="dialog" 
		aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget) { showEditModal = false; showDeleteConfirm = false; error = null; } }}
		onkeydown={(e) => { if (e.key === 'Escape') { showEditModal = false; showDeleteConfirm = false; error = null; } }}
	>
		<div class="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-700" onclick={(e) => e.stopPropagation()}>
			<h2 class="text-xl font-semibold text-gray-100 mb-4">Edit Device</h2>
			
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
			
			<div>
				<label for="edit-friendly-name" class="block text-sm font-medium text-gray-300 mb-1">
					Friendly Name *
				</label>
				<input
					id="edit-friendly-name"
					type="text"
					bind:value={editFriendlyName}
					placeholder="e.g., Terminal 1"
					class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
				/>
			</div>
			
			<div class="flex gap-3 mt-6">
				<button
					onclick={handleUpdateDevice}
					disabled={isLoading || !editFriendlyName.trim()}
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{isLoading ? 'Saving...' : 'Save Changes'}
				</button>
				<button
					onclick={() => { showEditModal = false; showDeleteConfirm = false; error = null; }}
					class="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 border border-gray-600 transition-colors"
				>
					Cancel
				</button>
			</div>
			
			<div class="mt-4 pt-4 border-t border-gray-700 text-center">
				<button
					onclick={confirmDelete}
					disabled={isLoading}
					class="text-sm text-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 6h18"/>
						<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
					</svg>
					Delete Device
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteConfirm}
	<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true">
		<div class="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-700">
			<h2 class="text-xl font-semibold text-gray-100 mb-4">Confirm Deletion</h2>
			
			<p class="text-sm text-gray-400 mb-6">
				Are you sure you want to delete this device? This action cannot be undone.
			</p>
			
			<div class="flex gap-3">
				<button
					onclick={handleDeleteDevice}
					disabled={isLoading}
					class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{isLoading ? 'Deleting...' : 'Delete'}
				</button>
				<button
					onclick={() => { showDeleteConfirm = false; }}
					disabled={isLoading}
					class="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 border border-gray-600 transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
