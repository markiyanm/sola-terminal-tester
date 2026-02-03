import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'sola_terminal_tester_config';

// Simple obfuscation for API key storage (not true encryption, but better than plaintext)
function obfuscate(str: string): string {
	return btoa(str.split('').reverse().join(''));
}

function deobfuscate(str: string): string {
	try {
		return atob(str).split('').reverse().join('');
	} catch {
		return '';
	}
}

export type Environment = 'prod' | 'test';

export interface ApiKeyEntry {
	id: string;
	name: string;
	key: string;
	environment: Environment;
}

interface Config {
	apiKey: string; // Currently selected key
	apiKeys: ApiKeyEntry[]; // All saved keys
	selectedKeyId: string | null;
	selectedEnvironment: Environment; // Currently selected environment
}

function loadConfig(): Config {
	if (!browser) return { apiKey: '', apiKeys: [], selectedKeyId: null, selectedEnvironment: 'prod' };
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			
			// Handle migration from old single-key format
			if (parsed.apiKey && !parsed.apiKeys) {
				const legacyKey = deobfuscate(parsed.apiKey || '');
				if (legacyKey) {
					const id = crypto.randomUUID();
					return {
						apiKey: legacyKey,
						apiKeys: [{ id, name: 'Default', key: legacyKey, environment: 'prod' }],
						selectedKeyId: id,
						selectedEnvironment: 'prod'
					};
				}
			}
			
			// New multi-key format with environment support
			const apiKeys: ApiKeyEntry[] = (parsed.apiKeys || []).map((entry: { id: string; name: string; key: string; environment?: Environment }) => ({
				id: entry.id,
				name: entry.name,
				key: deobfuscate(entry.key || ''),
				environment: entry.environment || 'prod' // Default to prod for migrated keys
			}));
			
			const selectedKeyId = parsed.selectedKeyId || null;
			const selectedEntry = apiKeys.find(k => k.id === selectedKeyId);
			
			return {
				apiKey: selectedEntry?.key || '',
				apiKeys,
				selectedKeyId,
				selectedEnvironment: selectedEntry?.environment || 'prod'
			};
		}
	} catch (e) {
		console.error('Failed to load config:', e);
	}
	
	return { apiKey: '', apiKeys: [], selectedKeyId: null, selectedEnvironment: 'prod' };
}

function saveConfig(config: Config) {
	if (!browser) return;
	
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			apiKeys: config.apiKeys.map(entry => ({
				id: entry.id,
				name: entry.name,
				key: obfuscate(entry.key),
				environment: entry.environment
			})),
			selectedKeyId: config.selectedKeyId
		}));
	} catch (e) {
		console.error('Failed to save config:', e);
	}
}

function createConfigStore() {
	const { subscribe, set, update } = writable<Config>(loadConfig());

	return {
		subscribe,
		addApiKey: (name: string, key: string, environment: Environment = 'prod') => {
			update(config => {
				const id = crypto.randomUUID();
				const newEntry: ApiKeyEntry = { id, name, key, environment };
				const newKeys = [...config.apiKeys, newEntry];
				const newConfig = {
					...config,
					apiKeys: newKeys,
					selectedKeyId: id,
					apiKey: key,
					selectedEnvironment: environment
				};
				saveConfig(newConfig);
				return newConfig;
			});
		},
		updateApiKey: (id: string, name: string, key: string, environment: Environment) => {
			update(config => {
				const newKeys = config.apiKeys.map(entry => 
					entry.id === id ? { ...entry, name, key, environment } : entry
				);
				const isSelected = config.selectedKeyId === id;
				const updatedEntry = newKeys.find(e => e.id === id);
				const newConfig = {
					...config,
					apiKeys: newKeys,
					apiKey: isSelected ? key : config.apiKey,
					selectedEnvironment: isSelected && updatedEntry ? updatedEntry.environment : config.selectedEnvironment
				};
				saveConfig(newConfig);
				return newConfig;
			});
		},
		deleteApiKey: (id: string) => {
			update(config => {
				const newKeys = config.apiKeys.filter(entry => entry.id !== id);
				let newSelectedId = config.selectedKeyId;
				let newApiKey = config.apiKey;
				let newEnvironment = config.selectedEnvironment;
				
				if (config.selectedKeyId === id) {
					// Select the first remaining key, or null if none left
					newSelectedId = newKeys.length > 0 ? newKeys[0].id : null;
					newApiKey = newKeys.length > 0 ? newKeys[0].key : '';
					newEnvironment = newKeys.length > 0 ? newKeys[0].environment : 'prod';
				}
				
				const newConfig = {
					...config,
					apiKeys: newKeys,
					selectedKeyId: newSelectedId,
					apiKey: newApiKey,
					selectedEnvironment: newEnvironment
				};
				saveConfig(newConfig);
				return newConfig;
			});
		},
		selectApiKey: (id: string) => {
			update(config => {
				const entry = config.apiKeys.find(k => k.id === id);
				if (!entry) return config;
				
				const newConfig = {
					...config,
					selectedKeyId: id,
					apiKey: entry.key,
					selectedEnvironment: entry.environment
				};
				saveConfig(newConfig);
				return newConfig;
			});
		},
		// Legacy methods for backwards compatibility
		setApiKey: (apiKey: string) => {
			update(config => {
				if (config.apiKeys.length === 0) {
					// Create a new entry
					const id = crypto.randomUUID();
					const newConfig: Config = {
						apiKey,
						apiKeys: [{ id, name: 'Default', key: apiKey, environment: 'prod' }],
						selectedKeyId: id,
						selectedEnvironment: 'prod'
					};
					saveConfig(newConfig);
					return newConfig;
				} else if (config.selectedKeyId) {
					// Update the selected entry
					const newKeys = config.apiKeys.map(entry => 
						entry.id === config.selectedKeyId ? { ...entry, key: apiKey } : entry
					);
					const newConfig = { ...config, apiKey, apiKeys: newKeys };
					saveConfig(newConfig);
					return newConfig;
				}
				return config;
			});
		},
		clearApiKey: () => {
			update(config => {
				const newConfig: Config = { ...config, apiKey: '', apiKeys: [], selectedKeyId: null, selectedEnvironment: 'prod' };
				saveConfig(newConfig);
				return newConfig;
			});
		},
		init: () => {
			set(loadConfig());
		}
	};
}

export const config = createConfigStore();
