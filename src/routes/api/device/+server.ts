import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Environment = 'prod' | 'test';

function getBaseUrl(environment: Environment): string {
	return environment === 'test' 
		? 'https://devdevice.cardknox.com/v1'
		: 'https://device.cardknox.com/v1';
}

export const POST: RequestHandler = async ({ request }) => {
	let requestBody: Record<string, unknown> = {};
	let endpoint = '';
	
	try {
		const { apiKey, serialNumber, deviceMake, friendlyName, environment = 'prod' } = await request.json();
		const baseUrl = getBaseUrl(environment);
		endpoint = `${baseUrl}/Device`;

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
	const environment = (url.searchParams.get('environment') || 'prod') as Environment;
	const baseUrl = getBaseUrl(environment);
	const endpoint = `${baseUrl}/Device`;
	
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
