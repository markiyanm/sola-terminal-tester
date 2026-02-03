import type { Device } from '$lib/stores/devices';

// Device API functions
export async function registerDevice(
	apiKey: string,
	serialNumber: string,
	deviceMake: string,
	friendlyName: string
): Promise<{ xDeviceId?: string; xRefnum?: string; xResult?: string; xError?: string }> {
	const response = await fetch('/api/device', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, serialNumber, deviceMake, friendlyName })
	});
	return response.json();
}

export interface ListDevicesResponse {
	xDevices?: Device[];
	xRefnum?: string;
	xResult?: string;
	xError?: string;
	error?: string;
}

export async function listDevices(apiKey: string): Promise<ListDevicesResponse> {
	const response = await fetch(`/api/device?apiKey=${encodeURIComponent(apiKey)}`);
	return response.json();
}

export async function getDeviceStatus(
	apiKey: string,
	deviceId: string
): Promise<{ xDeviceId?: string; xDeviceStatus?: string; xError?: string }> {
	const response = await fetch(`/api/device/${encodeURIComponent(deviceId)}?apiKey=${encodeURIComponent(apiKey)}`);
	return response.json();
}

export async function updateDevice(
	apiKey: string,
	deviceId: string,
	friendlyName: string
): Promise<{ xResult?: string; xError?: string; error?: string }> {
	const response = await fetch(`/api/device/${encodeURIComponent(deviceId)}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, friendlyName })
	});
	return response.json();
}

export async function deleteDevice(
	apiKey: string,
	deviceId: string
): Promise<{ xResult?: string; xError?: string; error?: string }> {
	const response = await fetch(`/api/device/${encodeURIComponent(deviceId)}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey })
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
	sessionId: string
): Promise<SessionStatusResponse> {
	const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}?apiKey=${encodeURIComponent(apiKey)}`);
	return response.json();
}

export async function cancelSession(
	apiKey: string,
	sessionId: string,
	deviceId: string
): Promise<{ xResult?: string; xError?: string }> {
	const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, deviceId })
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
