import type { Environment } from '$lib/stores/config';

export interface V2SessionParams {
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

export interface V2SessionResponse {
	xRefnum?: string;
	xResult?: string;       // A, S, E, I, D
	xStatus?: string;       // Approved, Success, Error, InProgress, Declined
	xError?: string;
	xMaskedCardNumber?: string;
	xAuthCode?: string;
	xBatch?: string;
	xCardType?: string;
	xExp?: string;
	xToken?: string;
	xAID?: string;
	xCurrency?: string;
	xDate?: string;
	xIsEMV?: boolean;
	xVoid?: boolean;
	xVoidable?: boolean;
	xRemainingBalance?: string;
	_debug?: {
		request: {
			method: string;
			url: string;
			headers: Record<string, string>;
			body: unknown;
		};
		response: {
			status: number;
			statusText: string;
			headers: Record<string, string>;
			body: unknown;
		};
	};
	[key: string]: unknown;
}

export async function initiateV2Session(
	params: V2SessionParams,
	signal?: AbortSignal
): Promise<V2SessionResponse> {
	const response = await fetch('/api/v2/session', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
		signal
	});
	return response.json();
}

/**
 * Compute the Cardknox V2 session endpoint URL (for debug display only).
 * Mirrors getV2BaseUrl in src/routes/api/v2/session/+server.ts
 */
export function getV2SessionEndpointUrl(environment: Environment, customBaseUrl?: string): string {
	if (environment === 'custom' && customBaseUrl) {
		let url = customBaseUrl.trim();
		if (!url.startsWith('https://') && !url.startsWith('http://')) {
			url = 'https://' + url;
		}
		url = url.replace(/\/v1$/, '');
		if (!url.endsWith('/v2')) {
			url = url + '/v2';
		}
		return `${url}/session`;
	}
	const base = environment === 'test'
		? 'https://devdevice.cardknox.com/v2'
		: 'https://device.cardknox.com/v2';
	return `${base}/session`;
}

/**
 * Compute the Cancel endpoint URL (for debug display only).
 * Cancel uses V1 endpoint even for V2 sessions.
 * Mirrors getBaseUrl in src/routes/api/v2/session/cancel/+server.ts
 */
export function getCancelEndpointUrl(environment: Environment, customBaseUrl?: string): string {
	if (environment === 'custom' && customBaseUrl) {
		let url = customBaseUrl.trim();
		if (!url.startsWith('https://') && !url.startsWith('http://')) {
			url = 'https://' + url;
		}
		if (!url.endsWith('/v1')) {
			url = url.replace(/\/v2$/, '') + '/v1';
		}
		return `${url}/Session/cancel`;
	}
	const base = environment === 'test'
		? 'https://devdevice.cardknox.com/v1'
		: 'https://device.cardknox.com/v1';
	return `${base}/Session/cancel`;
}

export async function cancelV2Session(
	apiKey: string,
	deviceId: string,
	cancelMessage?: string,
	environment: Environment = 'prod',
	customBaseUrl?: string
): Promise<Record<string, unknown>> {
	const response = await fetch('/api/v2/session/cancel', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apiKey, deviceId, cancelMessage, environment, customBaseUrl })
	});
	return response.json();
}
