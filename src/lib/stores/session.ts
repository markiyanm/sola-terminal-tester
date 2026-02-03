import { writable } from 'svelte/store';

export interface DebugInfo {
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
}

export interface SessionState {
	sessionId: string | null;
	refNum: string | null;
	gatewayRefNum: string | null;
	status: string | null;
	lastResponse: unknown | null;
	lastReportResponse: unknown | null;
	// Separate debug info for each API call type
	initiateDebug: DebugInfo | null;
	sessionStatusDebug: DebugInfo | null;
	reportDebug: DebugInfo | null;
	// Legacy - keeping for backwards compatibility
	lastCloudIMDebug: DebugInfo | null;
	lastReportDebug: DebugInfo | null;
	isLoading: boolean;
	error: string | null;
}

const initialState: SessionState = {
	sessionId: null,
	refNum: null,
	gatewayRefNum: null,
	status: null,
	lastResponse: null,
	lastReportResponse: null,
	initiateDebug: null,
	sessionStatusDebug: null,
	reportDebug: null,
	lastCloudIMDebug: null,
	lastReportDebug: null,
	isLoading: false,
	error: null
};

function createSessionStore() {
	const { subscribe, set, update } = writable<SessionState>(initialState);

	return {
		subscribe,
		setSession: (sessionId: string, refNum: string) => {
			update(state => ({
				...state,
				sessionId,
				refNum,
				status: 'INITIATING',
				error: null
			}));
		},
		setStatus: (status: string, gatewayRefNum?: string) => {
			update(state => ({
				...state,
				status,
				gatewayRefNum: gatewayRefNum || state.gatewayRefNum
			}));
		},
		setLastResponse: (response: unknown) => {
			update(state => ({
				...state,
				lastResponse: response
			}));
		},
		setLastReportResponse: (response: unknown) => {
			update(state => ({
				...state,
				lastReportResponse: response
			}));
		},
		setInitiateDebug: (debug: DebugInfo) => {
			update(state => ({
				...state,
				initiateDebug: debug,
				lastCloudIMDebug: debug // Also set legacy for compatibility
			}));
		},
		setSessionStatusDebug: (debug: DebugInfo) => {
			update(state => ({
				...state,
				sessionStatusDebug: debug,
				lastCloudIMDebug: debug // Also set legacy for compatibility
			}));
		},
		setReportDebug: (debug: DebugInfo) => {
			update(state => ({
				...state,
				reportDebug: debug,
				lastReportDebug: debug // Also set legacy for compatibility
			}));
		},
		// Legacy methods - keeping for backwards compatibility
		setCloudIMDebug: (debug: DebugInfo) => {
			update(state => ({
				...state,
				lastCloudIMDebug: debug
			}));
		},
		setLoading: (isLoading: boolean) => {
			update(state => ({ ...state, isLoading }));
		},
		setError: (error: string | null) => {
			update(state => ({ ...state, error, isLoading: false }));
		},
		clear: () => {
			set(initialState);
		}
	};
}

export const session = createSessionStore();
