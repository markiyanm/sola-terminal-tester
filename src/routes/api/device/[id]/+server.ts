import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLOUDIM_BASE_URL = 'https://device.cardknox.com/v1';

export const GET: RequestHandler = async ({ params, url }) => {
	const deviceId = params.id;
	const endpoint = `${CLOUDIM_BASE_URL}/Device/${deviceId}`;
	
	try {
		const apiKey = url.searchParams.get('apiKey');

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		const response = await fetch(endpoint, {
			method: 'GET',
			headers: {
				'Authorization': apiKey
			}
		});

		const data = await response.json();
		return json({
			...data,
			_debug: {
				endpoint: `GET ${endpoint}`,
				responseStatus: response.status
			}
		}, { status: response.ok ? 200 : response.status });
	} catch (error) {
		console.error('Error getting device status:', error);
		return json({ 
			error: 'Failed to get device status',
			_debug: { endpoint: `GET ${endpoint}`, error: String(error) }
		}, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const deviceId = params.id;
	const endpoint = `${CLOUDIM_BASE_URL}/Device/${deviceId}`;
	let requestBody: Record<string, unknown> = {};
	
	try {
		const { apiKey, friendlyName } = await request.json();

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		if (!friendlyName) {
			return json({ error: 'Friendly name is required' }, { status: 400 });
		}

		requestBody = {
			xDeviceFriendlyName: friendlyName
		};

		const response = await fetch(endpoint, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': apiKey
			},
			body: JSON.stringify(requestBody)
		});

		const data = await response.json();
		return json({
			...data,
			_debug: {
				endpoint: `PUT ${endpoint}`,
				requestBody,
				responseStatus: response.status
			}
		}, { status: response.ok ? 200 : response.status });
	} catch (error) {
		console.error('Error updating device:', error);
		return json({ 
			error: 'Failed to update device',
			_debug: { endpoint: `PUT ${endpoint}`, requestBody, error: String(error) }
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const deviceId = params.id;
	const endpoint = `${CLOUDIM_BASE_URL}/Device/${deviceId}`;
	const requestHeaders = { 'Authorization': '[REDACTED]' };
	
	try {
		const { apiKey } = await request.json();

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		const response = await fetch(endpoint, {
			method: 'DELETE',
			headers: {
				'Authorization': apiKey
			}
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
					method: 'DELETE',
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
		console.error('Error deleting device:', error);
		return json({ 
			error: 'Failed to delete device',
			_debug: {
				request: { method: 'DELETE', url: endpoint, headers: requestHeaders, body: null },
				response: { status: 500, statusText: 'Error', headers: {}, body: { error: String(error) } }
			}
		}, { status: 500 });
	}
};
