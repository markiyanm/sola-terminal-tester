import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const DEVICES_STORAGE_KEY = 'sola_terminal_tester_devices';
const SELECTED_DEVICE_KEY = 'sola_terminal_tester_selected_device';

export interface Device {
	xDeviceId: string;
	xDeviceSerialNumber?: string;
	xDeviceMake?: string;
	xDeviceFriendlyName?: string;
	xDeviceStatus?: 'CONNECTED' | 'DISCONNECTED' | string;
	xDeviceModel?: string;
	xDeviceLocalIpAddress?: string;
	xDeviceOSVersion?: string;
	xDeviceCardknoxApplicationVersion?: string;
}

function loadDevices(): Device[] {
	if (!browser) return [];
	
	try {
		const stored = localStorage.getItem(DEVICES_STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.error('Failed to load devices:', e);
	}
	
	return [];
}

function saveDevices(devices: Device[]) {
	if (!browser) return;
	
	try {
		localStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
	} catch (e) {
		console.error('Failed to save devices:', e);
	}
}

function loadSelectedDeviceId(): string | null {
	if (!browser) return null;
	return localStorage.getItem(SELECTED_DEVICE_KEY);
}

function saveSelectedDeviceId(deviceId: string | null) {
	if (!browser) return;
	
	if (deviceId) {
		localStorage.setItem(SELECTED_DEVICE_KEY, deviceId);
	} else {
		localStorage.removeItem(SELECTED_DEVICE_KEY);
	}
}

function createDevicesStore() {
	const { subscribe, set, update } = writable<Device[]>(loadDevices());

	return {
		subscribe,
		setDevices: (devices: Device[]) => {
			set(devices);
			saveDevices(devices);
		},
		addDevice: (device: Device) => {
			update(devices => {
				// Check if device already exists
				const existing = devices.findIndex(d => d.xDeviceId === device.xDeviceId);
				let newDevices: Device[];
				
				if (existing >= 0) {
					newDevices = [...devices];
					newDevices[existing] = { ...newDevices[existing], ...device };
				} else {
					newDevices = [...devices, device];
				}
				
				saveDevices(newDevices);
				return newDevices;
			});
		},
		updateDeviceStatus: (deviceId: string, status: string) => {
			update(devices => {
				const newDevices = devices.map(d => 
					d.xDeviceId === deviceId ? { ...d, xDeviceStatus: status } : d
				);
				saveDevices(newDevices);
				return newDevices;
			});
		},
		removeDevice: (deviceId: string) => {
			update(devices => {
				const newDevices = devices.filter(d => d.xDeviceId !== deviceId);
				saveDevices(newDevices);
				return newDevices;
			});
		},
		clear: () => {
			set([]);
			saveDevices([]);
		},
		init: () => {
			set(loadDevices());
		}
	};
}

function createSelectedDeviceStore() {
	const { subscribe, set } = writable<string | null>(loadSelectedDeviceId());

	return {
		subscribe,
		select: (deviceId: string | null) => {
			set(deviceId);
			saveSelectedDeviceId(deviceId);
		},
		init: () => {
			set(loadSelectedDeviceId());
		}
	};
}

export const devices = createDevicesStore();
export const selectedDeviceId = createSelectedDeviceStore();

// Derived store to get the currently selected device
export const selectedDevice = derived(
	[devices, selectedDeviceId],
	([$devices, $selectedDeviceId]) => {
		if (!$selectedDeviceId) return null;
		return $devices.find(d => d.xDeviceId === $selectedDeviceId) || null;
	}
);
