import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Environment = 'prod' | 'test' | 'custom';

function getBaseUrl(environment: Environment, customBaseUrl?: string): string {
	if (environment === 'custom' && customBaseUrl) {
		let url = customBaseUrl.trim();
		if (!url.startsWith('https://') && !url.startsWith('http://')) {
			url = 'https://' + url;
		}
		if (!url.endsWith('/v1')) {
			url = url.replace(/\/v2$/, '') + '/v1';
		}
		return url;
	}
	return environment === 'test'
		? 'https://devdevice.cardknox.com/v1'
		: 'https://device.cardknox.com/v1';
}

export const POST: RequestHandler = async ({ request }) => {
	let requestBody: Record<string, unknown> = {};
	const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': '[REDACTED]' };
	let endpoint = '';

	try {
		const { apiKey, deviceId, cancelMessage, environment = 'prod', customBaseUrl } = await request.json();

		const baseUrl = getBaseUrl(environment, customBaseUrl);
		endpoint = `${baseUrl}/Session/cancel`;

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}
		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		requestBody = {
			xDeviceId: deviceId
		};
		if (cancelMessage) {
			requestBody.xCancelMessage = cancelMessage;
		}

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': apiKey
			},
			body: JSON.stringify(requestBody)
		});

		const responseHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			responseHeaders[key] = value;
		});

		let data;
		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			data = await response.json();
		} else {
			const text = await response.text();
			data = { xError: text || `HTTP ${response.status}`, xResult: 'E' };
		}

		return json({
			...data,
			_debug: {
				request: {
					method: 'POST',
					url: endpoint,
					headers: requestHeaders,
					body: requestBody
				},
				response: {
					status: response.status,
					statusText: response.statusText,
					headers: responseHeaders,
					body: data
				}
			}
		}, { status: response.ok ? 200 : response.status });
	} catch (error) {
		console.error('Error canceling V2 session:', error);
		return json({
			error: 'Failed to cancel session',
			_debug: {
				request: { method: 'POST', url: endpoint, headers: requestHeaders, body: requestBody },
				response: { status: 500, statusText: 'Error', headers: {}, body: { error: String(error) } }
			}
		}, { status: 500 });
	}
};
