import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const REPORTING_BASE_URL = 'https://x1.cardknox.com';

export const POST: RequestHandler = async ({ request }) => {
	const endpoint = `${REPORTING_BASE_URL}/reportjson`;
	let requestBody: Record<string, unknown> = {};
	const requestHeaders = { 'Content-Type': 'application/json' };
	
	try {
		const { apiKey, refNum } = await request.json();

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		if (!refNum) {
			return json({ error: 'Reference number is required' }, { status: 400 });
		}

		requestBody = {
			xKey: '[REDACTED]',
			xVersion: '5.0.0',
			xSoftwareName: 'SolaTerminalTester',
			xSoftwareVersion: '1.0.0',
			xCommand: 'Report:Transaction',
			xRefnum: refNum
		};

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: requestHeaders,
			body: JSON.stringify({
				...requestBody,
				xKey: apiKey
			})
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
		console.error('Error getting transaction report:', error);
		return json({ 
			error: 'Failed to get transaction report',
			_debug: {
				request: { method: 'POST', url: endpoint, headers: requestHeaders, body: requestBody },
				response: { status: 500, statusText: 'Error', headers: {}, body: { error: String(error) } }
			}
		}, { status: 500 });
	}
};
