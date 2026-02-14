import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Environment = 'prod' | 'test' | 'custom';

function getV2BaseUrl(environment: Environment, customBaseUrl?: string): string {
	if (environment === 'custom' && customBaseUrl) {
		let url = customBaseUrl.trim();
		if (!url.startsWith('https://') && !url.startsWith('http://')) {
			url = 'https://' + url;
		}
		// Strip /v1 if present, then ensure /v2
		url = url.replace(/\/v1$/, '');
		if (!url.endsWith('/v2')) {
			url = url + '/v2';
		}
		return url;
	}
	return environment === 'test'
		? 'https://devdevice.cardknox.com/v2'
		: 'https://device.cardknox.com/v2';
}

export const POST: RequestHandler = async ({ request }) => {
	let requestBody: Record<string, unknown> = {};
	let requestHeaders: Record<string, string> = {};
	let endpoint = '';

	try {
		const {
			apiKey,
			deviceId,
			command,
			amount,
			enableTipPrompt,
			invoice,
			tip,
			externalRequestId,
			environment = 'prod',
			customBaseUrl
		} = await request.json();

		const baseUrl = getV2BaseUrl(environment, customBaseUrl);
		endpoint = `${baseUrl}/session`;

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}
		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}
		if (!command) {
			return json({ error: 'Command is required' }, { status: 400 });
		}

		// V2 uses a flat payload with xKey in the body (no Authorization header)
		requestBody = {
			xKey: '[REDACTED]',
			xDeviceId: deviceId,
			xCommand: command,
			xSoftwareName: 'SolaTerminalTester',
			xSoftwareVersion: '1.0.0',
			xExternalRequestId: externalRequestId || `test-${Date.now()}`
		};

		// Build actual payload with real key
		const actualPayload: Record<string, unknown> = {
			...requestBody,
			xKey: apiKey
		};

		if (amount !== undefined && amount !== null && amount !== '') {
			requestBody.xAmount = amount;
			actualPayload.xAmount = amount;
		}
		if (enableTipPrompt !== undefined) {
			requestBody.xEnableTipPrompt = enableTipPrompt;
			actualPayload.xEnableTipPrompt = enableTipPrompt;
		}
		if (invoice) {
			requestBody.xInvoice = invoice;
			actualPayload.xInvoice = invoice;
		}
		if (tip !== undefined && tip !== null && tip !== '') {
			requestBody.xTip = tip;
			actualPayload.xTip = tip;
		}

		requestHeaders = {
			'Content-Type': 'application/json'
		};

		// Propagate client disconnect to outgoing fetch
		const abortController = new AbortController();
		if (request.signal) {
			request.signal.addEventListener('abort', () => {
				abortController.abort();
			});
		}

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(actualPayload),
			signal: abortController.signal
		});

		const responseHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			responseHeaders[key] = value;
		});

		const data = await response.json();
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
		if ((error as { name?: string })?.name === 'AbortError') {
			return json({
				error: 'Request aborted',
				_debug: {
					request: { method: 'POST', url: endpoint, headers: requestHeaders, body: requestBody },
					response: { status: 0, statusText: 'Aborted', headers: {}, body: { error: 'Request was aborted' } }
				}
			}, { status: 499 });
		}

		console.error('Error in V2 session:', error);
		return json({
			error: 'Failed to process V2 session',
			_debug: {
				request: { method: 'POST', url: endpoint, headers: requestHeaders, body: requestBody },
				response: { status: 500, statusText: 'Error', headers: {}, body: { error: String(error) } }
			}
		}, { status: 500 });
	}
};
