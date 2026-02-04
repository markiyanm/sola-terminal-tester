import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Environment = 'prod' | 'test' | 'custom';

function getBaseUrl(environment: Environment, customBaseUrl?: string): string {
	if (environment === 'custom' && customBaseUrl) {
		// Ensure the custom URL has https:// prefix and /v1 suffix
		let url = customBaseUrl.trim();
		if (!url.startsWith('https://') && !url.startsWith('http://')) {
			url = 'https://' + url;
		}
		if (!url.endsWith('/v1')) {
			url = url + '/v1';
		}
		return url;
	}
	return environment === 'test' 
		? 'https://devdevice.cardknox.com/v1'
		: 'https://device.cardknox.com/v1';
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
		
		const baseUrl = getBaseUrl(environment, customBaseUrl);
		endpoint = `${baseUrl}/Session/initiate`;

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		if (!command) {
			return json({ error: 'Command is required' }, { status: 400 });
		}

		// Build the payload
		const payload: Record<string, unknown> = {
			xCommand: command,
			xSoftwareName: 'SolaTerminalTester',
			xSoftwareVersion: '1.0.0',
			xExternalRequestId: externalRequestId || `test-${Date.now()}`
		};

		// Add amount if provided (required for most transaction types)
		if (amount !== undefined && amount !== null && amount !== '') {
			payload.xAmount = amount;
		}

		// Add optional fields
		if (enableTipPrompt !== undefined) {
			payload.xEnableTipPrompt = enableTipPrompt;
		}

		if (invoice) {
			payload.xInvoice = invoice;
		}

		if (tip !== undefined && tip !== null && tip !== '') {
			payload.xTip = tip;
		}

		requestBody = {
			xPayload: payload,
			xDeviceId: deviceId
		};

		requestHeaders = {
			'Content-Type': 'application/json',
			'Authorization': '[REDACTED]'
		};

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': apiKey
			},
			body: JSON.stringify(requestBody)
		});

		// Capture response headers
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
		console.error('Error initiating session:', error);
		return json({ 
			error: 'Failed to initiate session',
			_debug: {
				request: { method: 'POST', url: endpoint, headers: requestHeaders, body: requestBody },
				response: { status: 500, statusText: 'Error', headers: {}, body: { error: String(error) } }
			}
		}, { status: 500 });
	}
};
