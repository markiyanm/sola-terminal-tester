import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLOUDIM_BASE_URL = 'https://device.cardknox.com/v1';

export const GET: RequestHandler = async ({ params, url }) => {
	const sessionId = params.id;
	const endpoint = `${CLOUDIM_BASE_URL}/Session/${sessionId}`;
	const requestHeaders = { 'Authorization': '[REDACTED]' };
	
	try {
		const apiKey = url.searchParams.get('apiKey');

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		if (!sessionId) {
			return json({ error: 'Session ID is required' }, { status: 400 });
		}

		const response = await fetch(endpoint, {
			method: 'GET',
			headers: {
				'Authorization': apiKey
			}
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
					method: 'GET',
					url: endpoint,
					headers: requestHeaders,
					body: null
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
		console.error('Error getting session status:', error);
		return json({ 
			error: 'Failed to get session status',
			_debug: {
				request: { method: 'GET', url: endpoint, headers: requestHeaders, body: null },
				response: { status: 500, statusText: 'Error', headers: {}, body: { error: String(error) } }
			}
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const sessionId = params.id;
	const endpoint = `${CLOUDIM_BASE_URL}/Session/cancel`;
	let requestBody: Record<string, unknown> = {};
	const requestHeaders = { 'Content-Type': 'application/json', 'Authorization': '[REDACTED]' };
	
	try {
		const { apiKey, deviceId } = await request.json();

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		if (!sessionId) {
			return json({ error: 'Session ID is required' }, { status: 400 });
		}

		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		requestBody = {
			xSessionId: sessionId,
			xDeviceId: deviceId
		};

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
		console.error('Error canceling session:', error);
		return json({ 
			error: 'Failed to cancel session',
			_debug: {
				request: { method: 'POST', url: endpoint, headers: requestHeaders, body: requestBody },
				response: { status: 500, statusText: 'Error', headers: {}, body: { error: String(error) } }
			}
		}, { status: 500 });
	}
};
