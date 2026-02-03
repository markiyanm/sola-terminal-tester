import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLOUDIM_BASE_URL = 'https://device.cardknox.com/v1';

export const POST: RequestHandler = async ({ request }) => {
	const endpoint = `${CLOUDIM_BASE_URL}/Device`;
	let requestBody: Record<string, unknown> = {};
	
	try {
		const { apiKey, serialNumber, deviceMake, friendlyName } = await request.json();

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}

		requestBody = {
			xDeviceSerialNumber: serialNumber,
			xDeviceMake: deviceMake || 'pax',
			xDeviceFriendlyName: friendlyName
		};

		const response = await fetch(endpoint, {
			method: 'POST',
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
				endpoint: `POST ${endpoint}`,
				requestBody,
				responseStatus: response.status
			}
		}, { status: response.ok ? 200 : response.status });
	} catch (error) {
		console.error('Error creating device:', error);
		return json({ 
			error: 'Failed to create device',
			_debug: { endpoint: `POST ${endpoint}`, requestBody, error: String(error) }
		}, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const endpoint = `${CLOUDIM_BASE_URL}/Device`;
	
	try {
		const apiKey = url.searchParams.get('apiKey');

		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
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
		console.error('Error listing devices:', error);
		return json({ 
			error: 'Failed to list devices',
			_debug: { endpoint: `GET ${endpoint}`, error: String(error) }
		}, { status: 500 });
	}
};
