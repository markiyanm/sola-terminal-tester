<script lang="ts">
	import { config, type ApiKeyEntry, type Environment } from '$lib/stores/config';
	
	interface Props {
		onKeyChanged?: () => void;
	}
	
	let { onKeyChanged }: Props = $props();
	
	let showModal = $state(false);
	let showAddForm = $state(false);
	let editingKey = $state<ApiKeyEntry | null>(null);
	let initialKeyId = $state<string | null>(null);
	
	// Add/Edit form fields
	let keyName = $state('');
	let keyValue = $state('');
	let keyEnvironment = $state<Environment>('prod');
	let customBaseUrl = $state('');
	let showKeyValue = $state(false);
	
	let hasKey = $derived(!!$config.apiKey);
	let selectedKeyName = $derived(() => {
		const selected = $config.apiKeys.find(k => k.id === $config.selectedKeyId);
		return selected?.name || '';
	});
	let selectedKeyPreview = $derived(() => {
		if (!$config.apiKey || $config.apiKey.length < 12) return '';
		return $config.apiKey.slice(0, 4) + '...' + $config.apiKey.slice(-4);
	});
	
	function openModal() {
		initialKeyId = $config.selectedKeyId;
		showModal = true;
		showAddForm = false;
		editingKey = null;
		resetForm();
	}
	
	function closeModal() {
		const keyChanged = $config.selectedKeyId !== initialKeyId;
		showModal = false;
		showAddForm = false;
		editingKey = null;
		resetForm();
		
		// Notify parent if the selected key changed
		if (keyChanged && onKeyChanged) {
			onKeyChanged();
		}
	}
	
	function resetForm() {
		keyName = '';
		keyValue = '';
		keyEnvironment = 'prod';
		customBaseUrl = '';
		showKeyValue = false;
	}
	
	function startAddKey() {
		showAddForm = true;
		editingKey = null;
		resetForm();
	}
	
	function startEditKey(entry: ApiKeyEntry) {
		editingKey = entry;
		keyName = entry.name;
		keyValue = entry.key;
		keyEnvironment = entry.environment;
		customBaseUrl = entry.customBaseUrl || '';
		showAddForm = true;
	}
	
	function cancelAddEdit() {
		showAddForm = false;
		editingKey = null;
		resetForm();
	}
	
	function saveKey() {
		if (!keyName.trim() || !keyValue.trim()) return;
		// Require custom base URL when environment is 'custom'
		if (keyEnvironment === 'custom' && !customBaseUrl.trim()) return;
		
		const trimmedCustomBaseUrl = keyEnvironment === 'custom' ? customBaseUrl.trim() : undefined;
		const isNewKey = !editingKey;
		const isEditingSelectedKey = editingKey && editingKey.id === $config.selectedKeyId;
		
		if (editingKey) {
			config.updateApiKey(editingKey.id, keyName.trim(), keyValue.trim(), keyEnvironment, trimmedCustomBaseUrl);
		} else {
			config.addApiKey(keyName.trim(), keyValue.trim(), keyEnvironment, trimmedCustomBaseUrl);
		}
		
		showAddForm = false;
		editingKey = null;
		resetForm();
		
		// Close modal and trigger refresh for new keys or when editing the currently selected key
		if (isNewKey || isEditingSelectedKey) {
			showModal = false;
			if (onKeyChanged) {
				onKeyChanged();
			}
		}
	}
	
	function deleteKey(id: string) {
		config.deleteApiKey(id);
	}
	
	function selectKey(id: string) {
		if (id === $config.selectedKeyId) {
			// Same key, just close the modal
			showModal = false;
			return;
		}
		
		config.selectApiKey(id);
		showModal = false;
		showAddForm = false;
		editingKey = null;
		resetForm();
		
		// Notify parent that the key changed
		if (onKeyChanged) {
			onKeyChanged();
		}
	}
	
	function maskKey(key: string): string {
		if (!key || key.length < 12) return '••••••••';
		return key.slice(0, 6) + '••••' + key.slice(-4);
	}
</script>

<button
	onclick={openModal}
	class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors
		{hasKey 
			? 'bg-yellow-900/20 text-yellow-500 hover:bg-yellow-900/30 border border-yellow-800/50' 
			: 'bg-red-900/50 text-red-400 hover:bg-red-900/70 border border-red-700'}"
>
	<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
		<circle cx="12" cy="12" r="3"/>
	</svg>
	{#if hasKey}
		<span class="hidden sm:inline">{selectedKeyName()} <span class="text-yellow-300/50 font-mono text-xs">({selectedKeyPreview()})</span></span>
		<span class="sm:hidden">Key Set</span>
	{:else}
		<span>Configure API Key</span>
	{/if}
</button>

{#if showModal}
	<div 
		class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" 
		role="dialog" 
		aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}
	>
		<div class="bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-700" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-gray-100">API Keys</h2>
				<button
					onclick={closeModal}
					class="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
			
			<p class="text-sm text-gray-400 mb-4">
				Manage your Sola API keys. Find keys in your 
				<a href="https://portal.solapayments.com/" target="_blank" class="text-blue-400 hover:underline">
					Sola Portal
				</a> under Account Settings &gt; Keys.
			</p>
			
			{#if !showAddForm}
				<!-- Key List -->
				{#if $config.apiKeys.length > 0}
					<div class="space-y-2 mb-4 max-h-64 overflow-y-auto">
						{#each $config.apiKeys as entry}
							<div 
								class="flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
									{$config.selectedKeyId === entry.id 
										? 'bg-blue-900/30 border-blue-700' 
										: 'bg-gray-800 border-gray-700 hover:bg-gray-750'}"
								onclick={() => selectKey(entry.id)}
							>
								<div class="flex-shrink-0">
									{#if $config.selectedKeyId === entry.id}
										<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
											<path d="M20 6L9 17l-5-5"/>
										</svg>
									{:else}
										<div class="w-5 h-5"></div>
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium text-gray-100 truncate">{entry.name}</span>
										{#if entry.environment === 'custom'}
											<span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700">
												CUSTOM
											</span>
										{:else if entry.environment === 'test'}
											<span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-red-900/50 text-red-400 border border-red-700">
												DEV
											</span>
										{:else}
											<span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-green-900/50 text-green-400 border border-green-700">
												PROD
											</span>
										{/if}
									</div>
									<div class="text-xs text-gray-500 font-mono">{maskKey(entry.key)}</div>
								</div>
								<div class="flex items-center gap-1">
									<button
										onclick={(e) => { e.stopPropagation(); startEditKey(entry); }}
										class="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
										title="Edit"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
											<path d="m15 5 4 4"/>
										</svg>
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); deleteKey(entry.id); }}
										class="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
										title="Delete"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M3 6h18"/>
											<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
											<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
										</svg>
									</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center py-8 text-gray-500">
						<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
						</svg>
						<p>No API keys configured</p>
					</div>
				{/if}
				
				<button
					onclick={startAddKey}
					class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="12" y1="5" x2="12" y2="19"/>
						<line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					Add API Key
				</button>
			{:else}
				<!-- Add/Edit Form -->
				<div class="space-y-4">
					<div>
						<label for="key-name" class="block text-sm font-medium text-gray-300 mb-1">
							Name *
						</label>
						<input
							id="key-name"
							type="text"
							bind:value={keyName}
							placeholder="e.g., Production, Test Account"
							class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
						/>
					</div>
					
					<div>
						<label for="key-value" class="block text-sm font-medium text-gray-300 mb-1">
							API Key *
						</label>
						<div class="relative">
							<input
								id="key-value"
								type={showKeyValue ? 'text' : 'password'}
								bind:value={keyValue}
								placeholder="Enter your API key"
								autocomplete="off"
								spellcheck="false"
								class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12 placeholder-gray-500"
								onpaste={(e) => e.stopPropagation()}
								oncontextmenu={(e) => e.stopPropagation()}
							/>
							<button
								type="button"
								onclick={() => showKeyValue = !showKeyValue}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
							>
								{#if showKeyValue}
									<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
										<line x1="1" y1="1" x2="23" y2="23"/>
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
										<circle cx="12" cy="12" r="3"/>
									</svg>
								{/if}
							</button>
						</div>
					</div>
					
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-1">
							Environment *
						</label>
						<div class="flex flex-wrap gap-3">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="key-environment"
									value="prod"
									checked={keyEnvironment === 'prod'}
									oninput={() => keyEnvironment = 'prod'}
									class="w-4 h-4 text-green-600 bg-gray-800 border-gray-600 focus:ring-green-500"
								/>
								<span class="text-sm text-gray-300">Production</span>
								<span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-green-900/50 text-green-400 border border-green-700">
									device.cardknox.com
								</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="key-environment"
									value="test"
									checked={keyEnvironment === 'test'}
									oninput={() => keyEnvironment = 'test'}
									class="w-4 h-4 text-red-600 bg-gray-800 border-gray-600 focus:ring-red-500"
								/>
								<span class="text-sm text-gray-300">Dev</span>
								<span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-red-900/50 text-red-400 border border-red-700">
									devdevice.cardknox.com
								</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="key-environment"
									value="custom"
									checked={keyEnvironment === 'custom'}
									oninput={() => keyEnvironment = 'custom'}
									class="w-4 h-4 text-yellow-600 bg-gray-800 border-gray-600 focus:ring-yellow-500"
								/>
								<span class="text-sm text-gray-300">Custom</span>
								<span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700">
									custom url
								</span>
							</label>
						</div>
					</div>
					
					{#if keyEnvironment === 'custom'}
						<div>
							<label for="custom-base-url" class="block text-sm font-medium text-gray-300 mb-1">
								Custom Base URL *
							</label>
							<input
								id="custom-base-url"
								type="text"
								bind:value={customBaseUrl}
								placeholder="e.g., qa-g-us-west-2.devdevice.cardknox.com"
								class="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 placeholder-gray-500"
							/>
							<p class="mt-1 text-xs text-gray-500">Enter the base URL without https:// or /v1 suffix</p>
						</div>
					{/if}
				</div>
				
				<div class="flex gap-3 mt-6">
					<button
						onclick={saveKey}
						disabled={!keyName.trim() || !keyValue.trim() || (keyEnvironment === 'custom' && !customBaseUrl.trim())}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{editingKey ? 'Save Changes' : 'Add Key'}
					</button>
					<button
						onclick={cancelAddEdit}
						class="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 border border-gray-600 transition-colors"
					>
						Cancel
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
