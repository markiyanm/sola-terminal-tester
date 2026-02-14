import { writable } from 'svelte/store';
import type { DebugInfo } from './session';

export type V2SessionStatus = 'idle' | 'pending' | 'completed' | 'error' | 'cancelled';

export interface V2SessionState {
	status: V2SessionStatus;
	startTime: number | null;
	// Response data from V2 synchronous response
	refnum: string | null;
	result: string | null;        // xResult: A, S, E, I, D
	xStatus: string | null;       // xStatus: Approved, Success, Error, InProgress, Declined
	xError: string | null;
	// Card/transaction data
	maskedCardNumber: string | null;
	authCode: string | null;
	batch: string | null;
	cardType: string | null;
	exp: string | null;
	token: string | null;
	aid: string | null;
	currency: string | null;
	date: string | null;
	isEMV: boolean | null;
	isVoid: boolean | null;
	isVoidable: boolean | null;
	remainingBalance: string | null;
	// Full response body
	responseData: unknown | null;
	// Debug info for V2 session call (request set immediately, response filled later)
	debug: DebugInfo | null;
	debugResponsePending: boolean;
	// Debug info for cancel call (request set immediately, response filled later)
	cancelDebug: DebugInfo | null;
	cancelDebugResponsePending: boolean;
	// Report (reuses V1 report API)
	reportResponse: unknown | null;
	reportDebug: DebugInfo | null;
	// Error
	error: string | null;
}

const initialState: V2SessionState = {
	status: 'idle',
	startTime: null,
	refnum: null,
	result: null,
	xStatus: null,
	xError: null,
	maskedCardNumber: null,
	authCode: null,
	batch: null,
	cardType: null,
	exp: null,
	token: null,
	aid: null,
	currency: null,
	date: null,
	isEMV: null,
	isVoid: null,
	isVoidable: null,
	remainingBalance: null,
	responseData: null,
	debug: null,
	debugResponsePending: false,
	cancelDebug: null,
	cancelDebugResponsePending: false,
	reportResponse: null,
	reportDebug: null,
	error: null
};

function createV2SessionStore() {
	const { subscribe, set, update } = writable<V2SessionState>(initialState);

	return {
		subscribe,
		startRequest: () => {
			set({
				...initialState,
				status: 'pending',
				startTime: Date.now()
			});
		},
		// Set debug with request details immediately (response is placeholder)
		setDebugRequest: (debug: DebugInfo) => {
			update(state => ({
				...state,
				debug,
				debugResponsePending: true
			}));
		},
		// Fill in the response side of debug after fetch completes
		setDebugResponse: (response: DebugInfo['response']) => {
			update(state => ({
				...state,
				debug: state.debug ? { ...state.debug, response } : null,
				debugResponsePending: false
			}));
		},
		// Set cancel debug request immediately (response is placeholder)
		setCancelDebugRequest: (debug: DebugInfo) => {
			update(state => ({
				...state,
				cancelDebug: debug,
				cancelDebugResponsePending: true
			}));
		},
		// Fill in the cancel response after fetch completes
		setCancelDebugResponse: (response: DebugInfo['response']) => {
			update(state => ({
				...state,
				cancelDebug: state.cancelDebug ? { ...state.cancelDebug, response } : null,
				cancelDebugResponsePending: false
			}));
		},
		setCompleted: (data: {
			refnum?: string;
			result?: string;
			xStatus?: string;
			xError?: string;
			maskedCardNumber?: string;
			authCode?: string;
			batch?: string;
			cardType?: string;
			exp?: string;
			token?: string;
			aid?: string;
			currency?: string;
			date?: string;
			isEMV?: boolean;
			isVoid?: boolean;
			isVoidable?: boolean;
			remainingBalance?: string;
			responseData: unknown;
		}) => {
			update(state => ({
				...state,
				status: 'completed',
				refnum: data.refnum || null,
				result: data.result || null,
				xStatus: data.xStatus || null,
				xError: data.xError || null,
				maskedCardNumber: data.maskedCardNumber || null,
				authCode: data.authCode || null,
				batch: data.batch || null,
				cardType: data.cardType || null,
				exp: data.exp || null,
				token: data.token || null,
				aid: data.aid || null,
				currency: data.currency || null,
				date: data.date || null,
				isEMV: data.isEMV ?? null,
				isVoid: data.isVoid ?? null,
				isVoidable: data.isVoidable ?? null,
				remainingBalance: data.remainingBalance || null,
				responseData: data.responseData,
				debugResponsePending: false
			}));
		},
		setError: (error: string, debug?: DebugInfo | null, xError?: string | null) => {
			update(state => ({
				...state,
				status: 'error',
				error,
				xError: xError ?? state.xError,
				debug: debug ?? state.debug,
				debugResponsePending: false
			}));
		},
		setCancelled: (message?: string) => {
			update(state => ({
				...state,
				status: 'cancelled',
				error: message || 'Transaction cancelled'
			}));
		},
		setCancelDebug: (debug: DebugInfo) => {
			update(state => ({
				...state,
				cancelDebug: debug
			}));
		},
		setReportData: (response: unknown, debug: DebugInfo | null) => {
			update(state => ({
				...state,
				reportResponse: response,
				reportDebug: debug
			}));
		},
		clear: () => {
			set(initialState);
		}
	};
}

export const v2session = createV2SessionStore();
