import type { Device } from '$lib/stores/devices';
import type { Environment } from '$lib/stores/config';

// Device API functions
export async function registerDevice(
	apiKey: string,
	serialNumber: string,
	deviceMake: string,
	friendlyName: string,
	environment: Environment = 'prod',
	customBaseUrl?: string
): Promise<{ xDeviceId?: string; xRefnum?: string; xResult?: string; xError?: string }> {
	const response = await fetch('/api/device', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, serialNumber, deviceMake, friendlyName, environment, customBaseUrl })
	});
	return response.json();
}

export interface ListDevicesResponse {
	xDevices?: Device[];
	xRefnum?: string;
	xResult?: string;
	xError?: string;
	error?: string;
	_debug?: {
		endpoint?: string;
		responseStatus?: number;
		error?: string;
	};
}

export async function listDevices(apiKey: string, environment: Environment = 'prod', customBaseUrl?: string): Promise<ListDevicesResponse> {
	let url = `/api/device?apiKey=${encodeURIComponent(apiKey)}&environment=${environment}`;
	if (customBaseUrl) {
		url += `&customBaseUrl=${encodeURIComponent(customBaseUrl)}`;
	}
	const response = await fetch(url);
	return response.json();
}

export async function getDeviceStatus(
	apiKey: string,
	deviceId: string,
	environment: Environment = 'prod',
	customBaseUrl?: string
): Promise<{ xDeviceId?: string; xDeviceStatus?: string; xError?: string }> {
	let url = `/api/device/${encodeURIComponent(deviceId)}?apiKey=${encodeURIComponent(apiKey)}&environment=${environment}`;
	if (customBaseUrl) {
		url += `&customBaseUrl=${encodeURIComponent(customBaseUrl)}`;
	}
	const response = await fetch(url);
	return response.json();
}

export async function updateDevice(
	apiKey: string,
	deviceId: string,
	friendlyName: string,
	environment: Environment = 'prod',
	customBaseUrl?: string
): Promise<{ xResult?: string; xError?: string; error?: string }> {
	const response = await fetch(`/api/device/${encodeURIComponent(deviceId)}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, friendlyName, environment, customBaseUrl })
	});
	return response.json();
}

export async function deleteDevice(
	apiKey: string,
	deviceId: string,
	environment: Environment = 'prod',
	customBaseUrl?: string
): Promise<{ xResult?: string; xError?: string; error?: string }> {
	const response = await fetch(`/api/device/${encodeURIComponent(deviceId)}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, environment, customBaseUrl })
	});
	return response.json();
}

// Session API functions
export interface InitiateSessionParams {
	apiKey: string;
	deviceId: string;
	command: string;
	amount?: string;
	enableTipPrompt?: boolean;
	invoice?: string;
	tip?: string;
	externalRequestId?: string;
	environment?: Environment;
	customBaseUrl?: string;
}

export interface SessionInitiateResponse {
	xSessionId?: string;
	xRefnum?: string;
	xResult?: string;
	xError?: string;
}

export async function initiateSession(params: InitiateSessionParams): Promise<SessionInitiateResponse> {
	const response = await fetch('/api/session', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params)
	});
	return response.json();
}

export interface SessionStatusResponse {
	xSessionStatus?: string;
	xGatewayRefnum?: string;
	xGatewayStatus?: string;
	xTransactionResult?: unknown;
	xRefnum?: string;
	xResult?: string;
	xError?: string;
}

export async function getSessionStatus(
	apiKey: string,
	sessionId: string,
	environment: Environment = 'prod',
	customBaseUrl?: string
): Promise<SessionStatusResponse> {
	let url = `/api/session/${encodeURIComponent(sessionId)}?apiKey=${encodeURIComponent(apiKey)}&environment=${environment}`;
	if (customBaseUrl) {
		url += `&customBaseUrl=${encodeURIComponent(customBaseUrl)}`;
	}
	const response = await fetch(url);
	return response.json();
}

export async function cancelSession(
	apiKey: string,
	sessionId: string,
	deviceId: string,
	environment: Environment = 'prod',
	customBaseUrl?: string
): Promise<{ xResult?: string; xError?: string }> {
	const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, deviceId, environment, customBaseUrl })
	});
	return response.json();
}

// Report API functions
export async function getTransactionReport(
	apiKey: string,
	refNum: string
): Promise<unknown> {
	const response = await fetch('/api/report', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, refNum })
	});
	return response.json();
}
