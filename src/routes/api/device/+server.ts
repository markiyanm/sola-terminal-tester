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
	let endpoint = '';
	
	try {
		const { apiKey, serialNumber, deviceMake, friendlyName, environment = 'prod', customBaseUrl } = await request.json();
		const baseUrl = getBaseUrl(environment, customBaseUrl);
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
	const customBaseUrl = url.searchParams.get('customBaseUrl') || undefined;
	const baseUrl = getBaseUrl(environment, customBaseUrl);
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

		// Handle non-JSON responses (like HTML error pages or non-API servers)
		const contentType = response.headers.get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			const text = await response.text();
			let statusError: string;
			
			if (response.status === 401 || response.status === 403) {
				statusError = 'Authentication failed - check your API key';
			} else if (response.status === 404) {
				statusError = 'API endpoint not found - check your custom URL';
			} else if (response.status >= 200 && response.status < 300) {
				// Server returned success but not JSON - this is not a valid API endpoint
				statusError = 'Invalid API endpoint - server does not appear to be a CloudIM/Sola API';
			} else {
				statusError = `Server error: HTTP ${response.status} ${response.statusText}`;
			}
			
			return json({
				error: statusError,
				xError: statusError,
				_debug: {
					endpoint: `GET ${endpoint}`,
					responseStatus: response.status,
					responseText: text.substring(0, 500)
				}
			}, { status: response.ok ? 400 : response.status });
		}

		const data = await response.json();
		
		// Add more descriptive error for failed HTTP responses (4xx, 5xx)
		if (!response.ok && !data.xError) {
			data.xError = response.status === 401 || response.status === 403 
				? 'Authentication failed - check your API key'
				: `HTTP ${response.status}: ${response.statusText}`;
		}
		
		return json({
			...data,
			_debug: {
				endpoint: `GET ${endpoint}`,
				responseStatus: response.status
			}
		}, { status: response.ok ? 200 : response.status });
	} catch (error) {
		console.error('Error listing devices:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		// Provide more helpful error messages for common issues
		let userFriendlyError = 'Failed to connect to server';
		if (errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
			userFriendlyError = `Could not reach server: ${endpoint} - check the URL is correct`;
		} else if (errorMessage.includes('ECONNREFUSED')) {
			userFriendlyError = `Connection refused by server: ${endpoint}`;
		} else if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
			userFriendlyError = `SSL/TLS error connecting to: ${endpoint}`;
		}
		return json({ 
			error: userFriendlyError,
			xError: userFriendlyError,
			_debug: { endpoint: `GET ${endpoint}`, error: errorMessage }
		}, { status: 500 });
	}
};
