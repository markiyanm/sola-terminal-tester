<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import ApiKeyConfig from '$lib/components/ApiKeyConfig.svelte';
	import { listDevices } from '$lib/api/client';
	import { cancelV2Session, getCancelEndpointUrl, getV2SessionEndpointUrl, initiateV2Session } from '$lib/api/v2client';
	import { config } from '$lib/stores/config';
	import { devices, selectedDevice, selectedDeviceId, type Device } from '$lib/stores/devices';
	import { v2session } from '$lib/stores/v2session';
	import type { DebugInfo } from '$lib/stores/session';

	type Product = {
		id: string;
		name: string;
		price: number;
		description?: string;
		photoClass: string;
	};

	type CartLine = {
		productId: string;
		name: string;
		price: number;
		quantity: number;
		description?: string;
	};

	type ProductForm = {
		name: string;
		price: string;
		description: string;
	};

type DiscountMode = 'percent' | 'amount';
type PaymentMethod = 'credit-card' | 'gift-card';

	const PRODUCTS_STORAGE_KEY = 'sola_terminal_tester_pos_products_square_style';
	const TAX_RATE = 0.095;

	const DEFAULT_PRODUCTS: Product[] = [
		{ id: 'avocado-toast', name: 'Avocado Toast', price: 5.5, photoClass: 'photo-avocado' },
		{ id: 'bagel', name: 'Bagel', price: 3.25, photoClass: 'photo-bagel' },
		{ id: 'oatmeal', name: 'Oatmeal', price: 4, photoClass: 'photo-oatmeal' },
		{ id: 'smoothie', name: 'Smoothie', price: 3.75, description: 'Strawberry-Banana', photoClass: 'photo-smoothie' },
		{ id: 'coffee', name: 'Coffee', price: 2.5, description: 'Medium Roast', photoClass: 'photo-coffee' },
		{ id: 'sticky-bun', name: 'Sticky Bun', price: 4.75, photoClass: 'photo-sticky' },
		{ id: 'croissant', name: 'Croissant', price: 4.25, photoClass: 'photo-croissant' },
		{ id: 'yogurt', name: 'Yogurt', price: 4.5, photoClass: 'photo-yogurt' },
		{ id: 'green-juice', name: 'Green Juice', price: 4.95, photoClass: 'photo-green' },
		{ id: 'espresso', name: 'Espresso', price: 3.25, photoClass: 'photo-espresso' },
		{ id: 'herb-muffin', name: 'Herb Muffin', price: 3.95, photoClass: 'photo-herb' },
		{ id: 'biscotti', name: 'Biscotti', price: 2.95, photoClass: 'photo-biscotti' },
		{ id: 'bran-muffin', name: 'Bran Muffin', price: 3.95, photoClass: 'photo-bran' },
		{ id: 'orange-juice', name: 'Orange Juice', price: 3.5, photoClass: 'photo-orange' },
		{ id: 'tea', name: 'Tea', price: 2.75, photoClass: 'photo-tea' },
		{ id: 'cupcake', name: 'Cupcake', price: 4.25, photoClass: 'photo-cupcake' },
		{ id: 'brownie', name: 'Brownie', price: 3.75, photoClass: 'photo-brownie' },
		{ id: 'scone', name: 'Scone', price: 3.5, photoClass: 'photo-sticky' },
		{ id: 'danish', name: 'Cheese Danish', price: 4.5, photoClass: 'photo-croissant' },
		{ id: 'cookie', name: 'Chocolate Chip', price: 2.75, photoClass: 'photo-biscotti' },
		{ id: 'latte', name: 'Latte', price: 4.5, photoClass: 'photo-espresso' },
		{ id: 'matcha', name: 'Matcha', price: 4.75, photoClass: 'photo-green' }
	];

	const STARTING_CART: CartLine[] = [];

	let products = $state<Product[]>(DEFAULT_PRODUCTS);
	let cart = $state<CartLine[]>(STARTING_CART);
	let showProductEditor = $state(false);
let showDiscountEditor = $state(false);
	let editingProductId = $state<string | null>(null);
	let productForm = $state<ProductForm>({ name: '', price: '', description: '' });
	let productEditorError = $state<string | null>(null);
let discountMode = $state<DiscountMode>('percent');
let discountInput = $state('');
let discountError = $state<string | null>(null);
let appliedDiscountMode = $state<DiscountMode>('percent');
let appliedDiscountValue = $state(0);
let paymentMethod = $state<PaymentMethod>('credit-card');
	let terminalError = $state<string | null>(null);
	let checkoutError = $state<string | null>(null);
	let isRefreshingDevices = $state(false);
	let isCancellingSale = $state(false);
	let bypassStatusCheck = $state(false);
	let showReaderMenu = $state(false);
	let lastDeviceRefreshTime = $state<Date | null>(null);
	let currentTime = $state(new Date());
	let saleRequestVersion = 0;

	let subtotal = $derived(cart.reduce((sum, line) => sum + line.price * line.quantity, 0));
let discount = $derived.by(() => {
	if (subtotal <= 0 || appliedDiscountValue <= 0) return 0;
	const rawDiscount = appliedDiscountMode === 'percent'
		? subtotal * (Math.min(appliedDiscountValue, 100) / 100)
		: appliedDiscountValue;
	return roundCurrency(Math.min(subtotal, rawDiscount));
});
let discountPreview = $derived.by(() => {
	const value = Number(discountInput) || 0;
	if (subtotal <= 0 || value <= 0) return 0;
	const rawDiscount = discountMode === 'percent'
		? subtotal * (Math.min(value, 100) / 100)
		: value;
	return roundCurrency(Math.min(subtotal, rawDiscount));
});
	let tax = $derived(roundCurrency((subtotal - discount) * TAX_RATE));
	let total = $derived(roundCurrency(subtotal - discount + tax));
	let itemCount = $derived(cart.reduce((sum, line) => sum + line.quantity, 0));
	let selectedDeviceOnline = $derived($selectedDevice?.xDeviceStatus === 'CONNECTED');
	let isCheckingOut = $derived($v2session.status === 'pending');
	let readerStatus = $derived(
		$selectedDeviceId
			? selectedDeviceOnline || bypassStatusCheck
				? 'Reader ready'
				: 'Reader offline'
			: 'Select reader'
	);
	let canCheckout = $derived(
		$config.apiKey &&
		$selectedDeviceId &&
		cart.length > 0 &&
		(selectedDeviceOnline || bypassStatusCheck) &&
		!isCheckingOut
	);
	let statusDateTime = $derived(formatStatusDateTime(currentTime));

	onMount(() => {
		config.init();
		devices.init();
		selectedDeviceId.init();
		products = loadProducts();

		currentTime = new Date();
		const clockInterval = window.setInterval(() => {
			currentTime = new Date();
		}, 1000);

		return () => {
			window.clearInterval(clockInterval);
		};
	});

	function loadProducts(): Product[] {
		if (!browser) return DEFAULT_PRODUCTS;

		try {
			const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
			if (!stored) return DEFAULT_PRODUCTS;

			const parsed = JSON.parse(stored);
			if (!Array.isArray(parsed)) return DEFAULT_PRODUCTS;

			const cleaned = parsed
				.filter((item): item is Product => (
					item &&
					typeof item.id === 'string' &&
					typeof item.name === 'string' &&
					typeof item.price === 'number'
				))
				.map((item, index) => ({
					...item,
					price: roundCurrency(item.price),
					description: typeof item.description === 'string' ? item.description : undefined,
					photoClass: item.photoClass || DEFAULT_PRODUCTS[index % DEFAULT_PRODUCTS.length].photoClass
				}));

			return cleaned.length > 0 ? cleaned : DEFAULT_PRODUCTS;
		} catch (e) {
			console.error('Failed to load POS products:', e);
			return DEFAULT_PRODUCTS;
		}
	}

	function saveProducts(nextProducts: Product[]) {
		products = nextProducts;
		if (!browser) return;

		try {
			localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts));
		} catch (e) {
			console.error('Failed to save POS products:', e);
		}
	}

	function roundCurrency(value: number): number {
		return Math.round((value + Number.EPSILON) * 100) / 100;
	}

	function formatMoney(value: number): string {
		return value.toFixed(2);
	}

	function formatStatusDateTime(value: Date): string {
		const time = new Intl.DateTimeFormat(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(value);
		const date = new Intl.DateTimeFormat(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		}).format(value);

		return `${time}  ${date}`;
	}

	function formatDeviceName(device: Device): string {
		return device.xDeviceFriendlyName || device.xDeviceSerialNumber || device.xDeviceId;
	}

	function addToCart(product: Product) {
		checkoutError = null;
		const existing = cart.find(line => line.productId === product.id);

		if (existing) {
			cart = cart.map(line =>
				line.productId === product.id
					? { ...line, quantity: line.quantity + 1 }
					: line
			);
			return;
		}

		cart = [
			...cart,
			{
				productId: product.id,
				name: product.name,
				price: product.price,
				quantity: 1,
				description: product.description
			}
		];
	}

	function updateLineQuantity(productId: string, nextQuantity: number) {
		if (nextQuantity <= 0) {
			cart = cart.filter(line => line.productId !== productId);
			return;
		}

		cart = cart.map(line =>
			line.productId === productId
				? { ...line, quantity: nextQuantity }
				: line
		);
	}

	function openProductEditor(product?: Product) {
		editingProductId = product?.id || null;
		productForm = {
			name: product?.name || '',
			price: product ? formatMoney(product.price) : '',
			description: product?.description || ''
		};
		productEditorError = null;
		showProductEditor = true;
	}

	function closeProductEditor() {
		showProductEditor = false;
		editingProductId = null;
		productEditorError = null;
		productForm = { name: '', price: '', description: '' };
	}

	function openDiscountEditor() {
		discountMode = appliedDiscountMode;
		discountInput = appliedDiscountValue > 0 ? String(appliedDiscountValue) : '';
		discountError = null;
		showDiscountEditor = true;
	}

	function closeDiscountEditor() {
		showDiscountEditor = false;
		discountError = null;
	}

	function applyDiscount() {
		const value = Number(discountInput);

		if (!Number.isFinite(value) || value < 0) {
			discountError = 'Enter a valid discount value';
			return;
		}

		if (discountMode === 'percent' && value > 100) {
			discountError = 'Percent discount cannot exceed 100%';
			return;
		}

		appliedDiscountMode = discountMode;
		appliedDiscountValue = roundCurrency(value);
		closeDiscountEditor();
	}

	function clearDiscount() {
		appliedDiscountValue = 0;
		discountInput = '';
		closeDiscountEditor();
	}

	function newProductId(name: string): string {
		const slug = name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');

		return `${slug || 'item'}-${Date.now()}`;
	}

	function saveProduct() {
		const name = productForm.name.trim();
		const price = Number(productForm.price);
		const description = productForm.description.trim() || undefined;

		if (!name) {
			productEditorError = 'Product name is required';
			return;
		}

		if (!Number.isFinite(price) || price <= 0) {
			productEditorError = 'Enter a valid price greater than zero';
			return;
		}

		const normalizedPrice = roundCurrency(price);

		if (editingProductId) {
			saveProducts(products.map(product =>
				product.id === editingProductId
					? { ...product, name, price: normalizedPrice, description }
					: product
			));

			cart = cart.map(line =>
				line.productId === editingProductId
					? { ...line, name, price: normalizedPrice, description }
					: line
			);
		} else {
			saveProducts([
				...products,
				{
					id: newProductId(name),
					name,
					price: normalizedPrice,
					description,
					photoClass: DEFAULT_PRODUCTS[products.length % DEFAULT_PRODUCTS.length].photoClass
				}
			]);
		}

		closeProductEditor();
	}

	function deleteEditingProduct() {
		if (!editingProductId) return;

		saveProducts(products.filter(product => product.id !== editingProductId));
		cart = cart.filter(line => line.productId !== editingProductId);
		closeProductEditor();
	}

	function clearSale() {
		cart = [];
		checkoutError = null;
	}

	function closeApprovalModal() {
		v2session.clear();
	}

	function startNewSale() {
		cart = [];
		checkoutError = null;
		v2session.clear();
	}

	function selectTerminal(deviceId: string) {
		selectedDeviceId.select(deviceId || null);
		bypassStatusCheck = false;
		showReaderMenu = false;
		checkoutError = null;
	}

	async function refreshTerminals() {
		if (!$config.apiKey) {
			terminalError = 'Configure an API key before refreshing readers.';
			return;
		}

		isRefreshingDevices = true;
		terminalError = null;

		try {
			const result = await listDevices($config.apiKey, $config.selectedEnvironment, $config.customBaseUrl);

			if (result.xResult === 'S' && result.xDevices) {
				const refreshedDevices = result.xDevices.map(device => ({
					...device,
					_rawJson: { ...device } as Record<string, unknown>
				}));

				devices.setDevices(refreshedDevices);
				lastDeviceRefreshTime = new Date();

				if (!$selectedDeviceId && refreshedDevices.length > 0) {
					const connectedDevice = refreshedDevices.find(device => device.xDeviceStatus === 'CONNECTED');
					selectedDeviceId.select((connectedDevice || refreshedDevices[0]).xDeviceId);
				}
			} else {
				terminalError = result.error || result.xError || 'Failed to refresh readers.';
			}
		} catch (e) {
			terminalError = e instanceof Error ? e.message : 'Failed to refresh readers.';
		} finally {
			isRefreshingDevices = false;
		}
	}

	function extractDebugInfo(result: Record<string, unknown>): DebugInfo | null {
		if (result._debug && typeof result._debug === 'object') {
			return result._debug as DebugInfo;
		}
		return null;
	}

	function stripDebugFromResponse(result: Record<string, unknown>): Record<string, unknown> {
		const { _debug, ...rest } = result;
		return rest;
	}

	async function sendSale() {
		if (!$config.apiKey || !$selectedDeviceId || cart.length === 0) return;

		const requestVersion = ++saleRequestVersion;
		const saleAmount = formatMoney(total);
		const saleCommand = paymentMethod === 'gift-card' ? 'gift:redeem' : 'cc:sale';
		const externalRequestId = `pos-${Date.now()}`;
		const invoice = `POS-${Date.now().toString().slice(-8)}`;
		const endpointUrl = getV2SessionEndpointUrl($config.selectedEnvironment, $config.customBaseUrl);

		checkoutError = null;
		isCancellingSale = false;
		v2session.clear();
		v2session.startRequest();
		v2session.setDebugRequest({
			request: {
				method: 'POST',
				url: endpointUrl,
				headers: { 'Content-Type': 'application/json' },
				body: {
					xKey: '[REDACTED]',
					xDeviceId: $selectedDeviceId,
					xCommand: saleCommand,
					xAmount: saleAmount,
					xInvoice: invoice,
					xSoftwareName: 'SolaTerminalTester',
					xSoftwareVersion: '1.0.0',
					xExternalRequestId: externalRequestId
				}
			},
			response: {
				status: 0,
				statusText: 'Pending...',
				headers: {},
				body: null
			}
		});

		try {
			const result = await initiateV2Session({
				apiKey: $config.apiKey,
				deviceId: $selectedDeviceId,
				command: saleCommand,
				amount: saleAmount,
				invoice,
				externalRequestId,
				environment: $config.selectedEnvironment,
				customBaseUrl: $config.customBaseUrl
			});

			if (requestVersion !== saleRequestVersion) return;

			const debug = extractDebugInfo(result);
			const cleanResponse = stripDebugFromResponse(result);

			if (debug) {
				v2session.setDebugResponse(debug.response);
			}

			if (result.xResult === 'E' || result.error) {
				const message = (result.xError as string) || (result.error as string) || 'Transaction failed';
				checkoutError = message;
				v2session.setError(message, undefined, result.xError as string);
			} else {
				v2session.setCompleted({
					refnum: result.xRefnum as string,
					result: result.xResult as string,
					xStatus: result.xStatus as string,
					xError: result.xError as string,
					maskedCardNumber: result.xMaskedCardNumber as string,
					authCode: result.xAuthCode as string,
					batch: result.xBatch as string,
					cardType: result.xCardType as string,
					exp: result.xExp as string,
					token: result.xToken as string,
					aid: result.xAID as string,
					currency: result.xCurrency as string,
					date: result.xDate as string,
					isEMV: result.xIsEMV as boolean,
					isVoid: result.xVoid as boolean,
					isVoidable: result.xVoidable as boolean,
					remainingBalance: result.xRemainingBalance as string,
					responseData: cleanResponse
				});
			}
		} catch (e) {
			if (requestVersion !== saleRequestVersion) return;

			v2session.setDebugResponse({
				status: 0,
				statusText: 'Error',
				headers: {},
				body: { error: e instanceof Error ? e.message : String(e) }
			});

			checkoutError = e instanceof Error ? e.message : 'Failed to send POS sale';
			v2session.setError(checkoutError);
		}
	}

	async function cancelSale() {
		if (!$config.apiKey || !$selectedDeviceId || $v2session.status !== 'pending') return;

		isCancellingSale = true;
		checkoutError = null;
		saleRequestVersion += 1;

		const cancelUrl = getCancelEndpointUrl($config.selectedEnvironment, $config.customBaseUrl);
		v2session.setCancelDebugRequest({
			request: {
				method: 'POST',
				url: cancelUrl,
				headers: { 'Content-Type': 'application/json', 'Authorization': '[REDACTED]' },
				body: { xDeviceId: $selectedDeviceId }
			},
			response: {
				status: 0,
				statusText: 'Pending...',
				headers: {},
				body: null
			}
		});

		try {
			const result = await cancelV2Session(
				$config.apiKey,
				$selectedDeviceId,
				undefined,
				$config.selectedEnvironment,
				$config.customBaseUrl
			);
			const debug = extractDebugInfo(result);

			if (debug) {
				v2session.setCancelDebugResponse(debug.response);
			}

			if (result.xResult === 'E' || result.error) {
				const message = (result.xError as string) || (result.error as string) || 'Failed to cancel transaction';
				checkoutError = message;
				v2session.setError(message, undefined, result.xError as string);
			} else {
				v2session.setCancelled('Transaction cancelled');
			}
		} catch (e) {
			v2session.setCancelDebugResponse({
				status: 0,
				statusText: 'Error',
				headers: {},
				body: { error: e instanceof Error ? e.message : String(e) }
			});

			checkoutError = e instanceof Error ? e.message : 'Failed to cancel transaction';
			v2session.setError(checkoutError);
		} finally {
			isCancellingSale = false;
		}
	}
</script>

<svelte:head>
	<title>Sola Terminal Tester - POS Demo</title>
	<meta name="description" content="Square-style POS demo using Sola Terminal V2 synchronous sale flow" />
	<meta name="color-scheme" content="light" />
</svelte:head>

<div class="pos-page min-h-screen overflow-x-hidden text-[#30333a]">
	<div class="pos-shell flex h-screen w-full flex-col overflow-hidden shadow-2xl">
		<header class="flex h-10 items-center justify-between bg-black px-3 text-xs font-semibold text-white">
			<div class="w-48">{statusDateTime}</div>
			<div class="pos-reader-top relative">
				<button
					type="button"
					onclick={() => showReaderMenu = !showReaderMenu}
					class="inline-flex max-w-[360px] items-center justify-center gap-2 rounded px-3 py-1 text-white hover:bg-white/10"
				>
					{#if $selectedDevice}
						<span class="reader-status-dot {$selectedDevice.xDeviceStatus === 'CONNECTED' ? 'online' : 'offline'}"></span>
						<span class="truncate">
							{formatDeviceName($selectedDevice)}
							{#if $selectedDevice.xDeviceSerialNumber}
								({$selectedDevice.xDeviceSerialNumber})
							{/if}
						</span>
					{:else}
						<span class="reader-status-dot"></span>
						<span class="reader-label">Select reader</span>
					{/if}
					<span class="reader-caret" aria-hidden="true"></span>
				</button>

				{#if showReaderMenu}
					<div class="pos-reader-menu absolute left-1/2 top-full mt-1 w-80 -translate-x-1/2 overflow-hidden rounded-sm border border-[#cfd4da] bg-white text-left text-[#30333a] shadow-xl">
						<button
							type="button"
							onclick={() => selectTerminal('')}
							class="block w-full px-3 py-2 text-left text-sm hover:bg-[#eef5ff]"
						>
							Select reader
						</button>
						{#each $devices as device (device.xDeviceId)}
							<button
								type="button"
								onclick={() => selectTerminal(device.xDeviceId)}
								class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#eef5ff]"
							>
								<span class="min-w-0 truncate font-semibold">
									{formatDeviceName(device)}
									({device.xDeviceSerialNumber || device.xDeviceId})
								</span>
								<span class="inline-flex shrink-0 items-center gap-1.5 text-xs text-[#4a4f57]">
									<span class="reader-menu-status-dot {device.xDeviceStatus === 'CONNECTED' ? 'online' : 'offline'}"></span>
									{device.xDeviceStatus === 'CONNECTED' ? 'Online' : 'Offline'}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<div class="pos-top-actions flex w-48 items-center justify-end gap-2">
				<button
					type="button"
					onclick={() => openProductEditor()}
					class="pos-top-iconbtn"
					title="Add item"
					aria-label="Add item"
				>
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<circle cx="3" cy="8" r="1.4" fill="currentColor" />
						<circle cx="8" cy="8" r="1.4" fill="currentColor" />
						<circle cx="13" cy="8" r="1.4" fill="currentColor" />
					</svg>
				</button>
				<div class="pos-api-top flex items-center gap-2">
					<ApiKeyConfig onKeyChanged={refreshTerminals} />
				</div>
			</div>
		</header>

		<div class="flex min-h-0 flex-1">
			<section class="pos-left flex min-w-0 flex-1 flex-col border-r border-[#d6d9dd]">
				<div class="pos-grid grid flex-1 overflow-y-auto p-4">
					{#each products as product (product.id)}
						<div class="pos-tile group rounded-sm bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22)]">
							<div class="pos-tile-inner">
								<button
									onclick={() => addToCart(product)}
									class="flex h-full w-full flex-col overflow-hidden rounded-sm bg-white text-left"
								>
									<div class="food-photo {product.photoClass}">
										<div class="plate"></div>
									</div>
									<div class="product-tile-name">
										<span>{product.name}</span>
									</div>
								</button>
								<button
									onclick={() => openProductEditor(product)}
									class="pos-tile-edit"
									title="Edit product"
								>
									Edit
								</button>
							</div>
						</div>
					{/each}

				</div>
			</section>

			<aside class="pos-side flex flex-col">
				<div class="flex h-[72px] items-center justify-between border-b border-[#e1e3e6] px-5">
					<div></div>
					<h1 class="text-[20px] font-semibold text-[#30333a]">Current sale ({itemCount})</h1>
					<button
						type="button"
						onclick={clearSale}
						class="cart-clear-button"
						disabled={cart.length === 0}
						title="Clear sale"
					>
						Clear
					</button>
				</div>

				<div class="pos-cart-scroll min-h-0 flex-1 overflow-y-auto">
					{#if terminalError}
						<div class="cart-banner cart-banner-error">{terminalError}</div>
					{/if}

					{#if $selectedDevice && !selectedDeviceOnline}
						<label class="cart-banner cart-banner-warn">
							<input type="checkbox" bind:checked={bypassStatusCheck} />
							<span>Try selected reader anyway</span>
						</label>
					{/if}

					<ul class="cart-lines">
						{#each cart as line (line.productId)}
							<li class="cart-line">
								<div class="cart-line-main">
									<button
										type="button"
										onclick={() => updateLineQuantity(line.productId, line.quantity + 1)}
										class="cart-line-name"
										title="Add another"
									>
										{#if line.quantity > 1}
											<span class="cart-qty-badge">{line.quantity}</span>
										{/if}
										<span class="cart-name-text">{line.name}</span>
									</button>
									{#if line.description}
										<div class="cart-line-modifier">{line.description}</div>
									{/if}
								</div>
								<div class="cart-line-right">
									<span class="cart-line-price">${formatMoney(line.price * line.quantity)}</span>
									<button
										type="button"
										onclick={() => updateLineQuantity(line.productId, line.quantity - 1)}
										class="cart-line-remove"
										title={line.quantity > 1 ? 'Remove one' : 'Remove item'}
										aria-label={line.quantity > 1 ? 'Remove one' : 'Remove item'}
									>
										<svg viewBox="0 0 16 16" aria-hidden="true">
											<path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
										</svg>
									</button>
								</div>
							</li>
						{/each}

						{#if cart.length === 0}
							<li class="cart-empty">Tap an item to start the sale.</li>
						{/if}
					</ul>

					{#if cart.length > 0}
						<div class="cart-totals">
							<div class="cart-totals-row">
								<span>Subtotal</span>
								<span>${formatMoney(subtotal)}</span>
							</div>
							{#if discount > 0}
								<div class="cart-totals-row cart-totals-discount">
									<span>Discounts</span>
									<span>- ${formatMoney(discount)}</span>
								</div>
							{/if}
							<div class="cart-totals-row">
								<span>Tax</span>
								<span>${formatMoney(tax)}</span>
							</div>
							<div class="cart-totals-row cart-totals-total">
								<span>Total</span>
								<span>${formatMoney(total)}</span>
							</div>
						</div>
					{/if}

					{#if checkoutError}
						<div class="cart-banner cart-banner-error cart-banner-bottom">{checkoutError}</div>
					{:else if $v2session.status === 'cancelled'}
						<div class="cart-banner cart-banner-warn cart-banner-bottom">
							Transaction cancelled
						</div>
					{:else if !$config.apiKey}
						<div class="cart-banner cart-banner-muted cart-banner-bottom">
							Configure an API key before charging the sale.
						</div>
					{/if}
				</div>

				<div class="checkout-footer border-t border-[#e1e3e6] p-4">
					<div class="checkout-controls">
						<button type="button" class="checkout-discount-button" onclick={openDiscountEditor}>
							<span class="checkout-discount-icon">%</span>
							<span>
								Discounts
								{#if discount > 0}
									<strong>- ${formatMoney(discount)}</strong>
								{/if}
							</span>
						</button>

						<select class="payment-method-select" bind:value={paymentMethod}>
							<option value="credit-card">Credit Card</option>
							<option value="gift-card">Gift Card</option>
						</select>
					</div>

					<button
						onclick={isCheckingOut ? cancelSale : sendSale}
						disabled={isCheckingOut ? isCancellingSale : !canCheckout}
						class="sale-action-button h-16 w-full text-[20px] font-semibold text-white transition-colors disabled:bg-[#b9c1ca] {isCheckingOut ? 'cancel-mode' : 'charge-mode'}"
					>
						{#if isCheckingOut}
							{isCancellingSale ? 'Cancelling...' : 'Cancel'}
						{:else}
							Charge ${formatMoney(total)}
						{/if}
					</button>
				</div>
			</aside>
		</div>

	</div>
</div>

{#if showProductEditor}
	<div
		class="product-editor-backdrop"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) closeProductEditor(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeProductEditor(); }}
	>
		<div class="product-editor-modal">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-[#30333a]">{editingProductId ? 'Edit item' : 'Add item'}</h2>
				<button onclick={closeProductEditor} class="text-3xl leading-none text-[#8d939b]" title="Close">×</button>
			</div>

			{#if productEditorError}
				<div class="mb-4 border border-[#f2b2b2] bg-[#fff4f4] p-3 text-sm text-[#b42323]">
					{productEditorError}
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="product-name" class="mb-1 block text-sm font-semibold text-[#4a4f57]">Name</label>
					<input id="product-name" bind:value={productForm.name} class="w-full border border-[#cfd4da] px-3 py-2" />
				</div>
				<div>
					<label for="product-price" class="mb-1 block text-sm font-semibold text-[#4a4f57]">Price</label>
					<input id="product-price" type="number" min="0.01" step="0.01" bind:value={productForm.price} class="w-full border border-[#cfd4da] px-3 py-2" />
				</div>
				<div>
					<label for="product-description" class="mb-1 block text-sm font-semibold text-[#4a4f57]">Modifier text</label>
					<input id="product-description" bind:value={productForm.description} class="w-full border border-[#cfd4da] px-3 py-2" />
				</div>
			</div>

			<div class="mt-6 flex gap-3">
				<button onclick={saveProduct} class="flex-1 bg-[#0074f8] px-4 py-3 font-semibold text-white">Save</button>
				<button onclick={closeProductEditor} class="border border-[#cfd4da] px-4 py-3 font-semibold text-[#4a4f57]">Cancel</button>
			</div>

			{#if editingProductId}
				<div class="mt-4 border-t border-[#e1e3e6] pt-4 text-center">
					<button onclick={deleteEditingProduct} class="text-sm font-semibold text-[#d23b3b]">Delete item</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if $v2session.status === 'completed'}
	<div
		class="approval-backdrop"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) closeApprovalModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeApprovalModal(); }}
	>
		<div class="approval-modal">
			<button type="button" class="approval-close" onclick={closeApprovalModal} title="Close">×</button>
			<div class="approval-check-wrap">
				<div class="approval-check-glow"></div>
				<svg class="approval-check" viewBox="0 0 96 96" aria-hidden="true">
					<circle cx="48" cy="48" r="42" />
					<path d="M29 49.5L42.2 62.5L68 35.5" />
				</svg>
			</div>
			<p class="approval-kicker">Transaction approved</p>
			<h2>Payment complete</h2>
			{#if $v2session.refnum}
				<p class="approval-ref">Ref {$v2session.refnum}</p>
			{/if}
			<div class="approval-details">
				<div>
					<span>Amount</span>
					<strong>${formatMoney(total)}</strong>
				</div>
				<div>
					<span>Method</span>
					<strong>{paymentMethod === 'gift-card' ? 'Gift Card' : 'Credit Card'}</strong>
				</div>
			</div>
			<button type="button" class="approval-primary" onclick={startNewSale}>Start new sale</button>
		</div>
	</div>
{/if}

{#if showDiscountEditor}
	<div
		class="product-editor-backdrop"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) closeDiscountEditor(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeDiscountEditor(); }}
	>
		<div class="product-editor-modal discount-editor-modal">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-[#30333a]">Apply discount</h2>
				<button onclick={closeDiscountEditor} class="text-3xl leading-none text-[#8d939b]" title="Close">×</button>
			</div>

			{#if discountError}
				<div class="mb-4 border border-[#f2b2b2] bg-[#fff4f4] p-3 text-sm text-[#b42323]">
					{discountError}
				</div>
			{/if}

			<div class="discount-mode-toggle">
				<button
					type="button"
					class:active={discountMode === 'percent'}
					onclick={() => { discountMode = 'percent'; discountError = null; }}
				>
					Percent
				</button>
				<button
					type="button"
					class:active={discountMode === 'amount'}
					onclick={() => { discountMode = 'amount'; discountError = null; }}
				>
					Amount
				</button>
			</div>

			<div class="mt-4">
				<label for="discount-value" class="mb-1 block text-sm font-semibold text-[#4a4f57]">
					{discountMode === 'percent' ? 'Discount percent' : 'Discount amount'}
				</label>
				<div class="discount-input-wrap">
					<span>{discountMode === 'percent' ? '%' : '$'}</span>
					<input
						id="discount-value"
						type="number"
						min="0"
						max={discountMode === 'percent' ? '100' : undefined}
						step={discountMode === 'percent' ? '1' : '0.01'}
						bind:value={discountInput}
						placeholder={discountMode === 'percent' ? '10' : '5.00'}
					/>
				</div>
			</div>

			<div class="discount-preview">
				<span>Discount on current sale</span>
				<strong>- ${formatMoney(discountPreview)}</strong>
			</div>

			<div class="discount-actions">
				<button type="button" onclick={applyDiscount} class="discount-save-button">
					Save discount
				</button>
				<button type="button" onclick={closeDiscountEditor} class="discount-cancel-button">
					Cancel
				</button>
			</div>

			{#if appliedDiscountValue > 0}
				<div class="mt-4 border-t border-[#e1e3e6] pt-4 text-center">
					<button onclick={clearDiscount} class="text-sm font-semibold text-[#d23b3b]">Remove discount</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(html),
	:global(body) {
		color-scheme: light !important;
	}

	.pos-page {
		min-height: 100vh;
		overflow: hidden;
		background: #eef0f3 !important;
		color: #30333a;
		color-scheme: light !important;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}

	.product-editor-backdrop {
		position: fixed !important;
		inset: 0 !important;
		z-index: 10000 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		padding: 24px !important;
		background: rgba(0, 0, 0, 0.45) !important;
	}

	.product-editor-modal {
		position: relative !important;
		z-index: 10001 !important;
		width: min(440px, calc(100vw - 48px)) !important;
		max-height: calc(100vh - 48px) !important;
		overflow-y: auto !important;
		border-radius: 4px !important;
		background: #ffffff !important;
		padding: 24px !important;
		color: #30333a !important;
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35) !important;
	}

	.product-editor-modal input {
		display: block !important;
		width: 100% !important;
		height: 42px !important;
		box-sizing: border-box !important;
		background: #ffffff !important;
		color: #30333a !important;
	}

	.approval-backdrop {
		position: fixed;
		inset: 0;
		z-index: 12000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: rgba(15, 23, 42, 0.54);
		backdrop-filter: blur(8px);
	}

	.approval-modal {
		position: relative;
		width: min(420px, 100%);
		padding: 34px 30px 28px;
		border: 1px solid rgba(187, 247, 208, 0.9);
		border-radius: 24px;
		background:
			radial-gradient(circle at 50% 0%, rgba(34, 197, 94, 0.18), transparent 44%),
			linear-gradient(180deg, #ffffff 0%, #f8fff9 100%);
		box-shadow: 0 28px 80px rgba(15, 23, 42, 0.32);
		text-align: center;
		color: #172033;
	}

	.approval-close {
		position: absolute;
		top: 12px;
		right: 16px;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		color: #94a3b8;
		font-size: 28px;
		line-height: 1;
	}

	.approval-close:hover {
		background: #eef2f7;
		color: #475569;
	}

	.approval-check-wrap {
		position: relative;
		width: 108px;
		height: 108px;
		margin: 0 auto 18px;
	}

	.approval-check-glow {
		position: absolute;
		inset: 0;
		border-radius: 999px;
		background: radial-gradient(circle, rgba(34, 197, 94, 0.32), rgba(34, 197, 94, 0));
		filter: blur(2px);
	}

	.approval-check {
		position: relative;
		width: 108px;
		height: 108px;
		filter: drop-shadow(0 12px 24px rgba(22, 163, 74, 0.28));
	}

	.approval-check circle {
		fill: #22c55e;
		stroke: #bbf7d0;
		stroke-width: 3;
	}

	.approval-check path {
		fill: none;
		stroke: #ffffff;
		stroke-width: 8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.approval-kicker {
		margin: 0 0 6px;
		color: #15803d;
		font-size: 13px;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.approval-modal h2 {
		margin: 0;
		font-size: 30px;
		font-weight: 850;
		letter-spacing: -0.04em;
	}

	.approval-ref {
		margin: 10px auto 0;
		color: #64748b;
		font-size: 15px;
		font-weight: 700;
	}

	.approval-details {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin: 24px 0;
	}

	.approval-details div {
		padding: 12px;
		border: 1px solid #dcfce7;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.72);
	}

	.approval-details span {
		display: block;
		margin-bottom: 4px;
		color: #64748b;
		font-size: 11px;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}

	.approval-details strong {
		color: #172033;
		font-size: 17px;
		font-weight: 850;
	}

	.approval-primary {
		width: 100%;
		height: 52px;
		border-radius: 12px;
		background: linear-gradient(135deg, #16a34a, #22c55e) !important;
		color: #ffffff !important;
		font-size: 16px;
		font-weight: 850;
		box-shadow: 0 12px 24px rgba(22, 163, 74, 0.24);
	}

	.approval-primary:hover {
		background: linear-gradient(135deg, #15803d, #16a34a) !important;
	}

	.discount-editor-modal {
		max-width: 420px;
	}

	.discount-mode-toggle {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		padding: 4px;
		border-radius: 8px;
		background: #eef2f6;
	}

	.discount-mode-toggle button {
		height: 40px;
		border-radius: 6px;
		color: #4a4f57;
		font-size: 14px;
		font-weight: 700;
	}

	.discount-mode-toggle button.active {
		background: #ffffff;
		color: #0074f8;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14);
	}

	.discount-input-wrap {
		display: grid;
		grid-template-columns: 42px 1fr;
		align-items: center;
		border: 1px solid #cfd4da;
		background: #ffffff;
	}

	.discount-input-wrap span {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 42px;
		border-right: 1px solid #e1e3e6;
		color: #6b7280;
		font-weight: 800;
	}

	.discount-input-wrap input {
		border: 0 !important;
	}

	.discount-preview {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 16px;
		padding: 12px;
		border-radius: 6px;
		background: #f6faf7;
		color: #4a4f57;
		font-size: 14px;
	}

	.discount-preview strong {
		color: #167a38;
		font-size: 16px;
		font-variant-numeric: tabular-nums;
	}

	.discount-actions {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
		margin-top: 22px;
	}

	.discount-save-button {
		width: 100%;
		height: 52px;
		border-radius: 6px;
		background: #0074f8 !important;
		color: #ffffff !important;
		font-size: 16px;
		font-weight: 800;
	}

	.discount-save-button:hover {
		background: #0068df !important;
	}

	.discount-cancel-button {
		width: 100%;
		height: 46px;
		border: 1px solid #cfd4da !important;
		border-radius: 6px;
		background: #ffffff !important;
		color: #4a4f57 !important;
		font-size: 15px;
		font-weight: 700;
	}

	.discount-cancel-button:hover {
		background: #f6f7f9 !important;
	}

	.pos-shell {
		display: flex;
		flex-direction: column;
		width: 100vw;
		height: 100vh;
		margin: 0;
		background: #ffffff !important;
		color-scheme: light !important;
		box-shadow: 0 18px 45px rgba(15, 23, 42, 0.22);
	}

	.pos-shell > header {
		display: flex;
		position: relative;
		z-index: 1000;
		align-items: center;
		justify-content: space-between;
		height: 40px;
		flex: 0 0 40px;
		padding: 0 12px;
		background: #000 !important;
		color: #fff !important;
		font-size: 12px;
		font-weight: 700;
	}

	.pos-shell > header > div {
		width: 33.33%;
	}

	.pos-shell > header > div:nth-child(2) {
		text-align: center;
	}

	.pos-reader-top {
		position: relative;
		z-index: 1001;
		display: flex;
		justify-content: center;
		min-width: 0;
	}

	.pos-reader-top > button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		max-width: 360px;
		height: 26px;
		padding: 0 10px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
	}

	.pos-reader-top > button:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.reader-label {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reader-status-dot {
		display: block;
		width: 8px;
		height: 8px;
		flex: 0 0 8px;
		border-radius: 999px;
		background: #9ca3af;
	}

	.reader-status-dot.online {
		background: #22c55e;
	}

	.reader-status-dot.offline {
		background: #ef4444;
	}

	.reader-caret {
		display: block;
		width: 0;
		height: 0;
		flex: 0 0 auto;
		border-left: 4px solid transparent;
		border-right: 4px solid transparent;
		border-top: 5px solid rgba(255, 255, 255, 0.85);
	}

	.pos-reader-menu {
		position: fixed !important;
		top: 40px !important;
		left: 50% !important;
		z-index: 9999 !important;
		width: 420px !important;
		max-width: calc(100vw - 24px);
		max-height: 280px;
		transform: translateX(-50%) !important;
		overflow-y: auto !important;
		border: 1px solid #cfd4da !important;
		background: #ffffff !important;
		color: #30333a !important;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28) !important;
	}

	.pos-reader-menu button {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		border: 0;
		background: #ffffff !important;
		color: #30333a !important;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.2;
		text-align: left;
	}

	.pos-reader-menu button:hover {
		background: #eef5ff !important;
	}

	.pos-reader-menu button + button {
		border-top: 1px solid #eef0f3;
	}

	.pos-reader-menu span {
		color: inherit !important;
	}

	.reader-menu-status-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		flex: 0 0 8px;
		border-radius: 999px;
	}

	.reader-menu-status-dot.online {
		background: #22c55e;
	}

	.reader-menu-status-dot.offline {
		background: #ef4444;
	}

	.pos-shell > header > div:last-child {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	:global(.pos-api-top > button) {
		height: 28px !important;
		padding: 0 10px !important;
		border-color: rgba(255, 255, 255, 0.35) !important;
		background: rgba(255, 255, 255, 0.12) !important;
		color: #ffffff !important;
		font-size: 12px !important;
		font-weight: 700 !important;
		line-height: 1 !important;
	}

	:global(.pos-api-top > button:hover) {
		background: rgba(255, 255, 255, 0.2) !important;
	}

	:global(.pos-api-top > button svg) {
		width: 14px !important;
		height: 14px !important;
	}

	:global(.pos-api-top > button span) {
		color: #ffffff !important;
	}

	.pos-top-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	.pos-top-iconbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		cursor: pointer;
		line-height: 1;
	}

	.pos-top-iconbtn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.pos-top-iconbtn svg {
		width: 14px;
		height: 14px;
	}

	.pos-shell > div:nth-of-type(1) {
		display: flex;
		min-height: 0;
		flex: 1 1 auto;
	}

	.pos-left {
		display: flex;
		min-width: 0;
		flex: 1 1 auto;
		flex-direction: column;
		background: #ffffff !important;
		border-right: 1px solid #d6d9dd;
	}

	.pos-left button,
	.pos-side button {
		border: 0;
		background: transparent;
		font: inherit;
		cursor: pointer;
		text-decoration: none;
	}

	.pos-grid {
		--pos-tile-size: 280px;
		display: grid;
		flex: 1 1 auto;
		grid-template-columns: repeat(auto-fill, var(--pos-tile-size));
		grid-auto-rows: var(--pos-tile-size);
		gap: 12px;
		align-items: start;
		justify-content: start;
		min-height: 0;
		overflow-y: auto;
		padding: 16px;
		background: #f5f6f7 !important;
	}

	.pos-grid > .pos-tile {
		position: relative;
		width: 100%;
		height: 100%;
		align-self: start;
		min-width: 0;
		overflow: hidden;
		border-radius: 2px;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
	}

	.pos-tile-inner {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
	}

	.pos-grid > .pos-tile .pos-tile-inner > button:first-child {
		display: flex;
		width: 100%;
		height: 100%;
		flex: 1 1 auto;
		flex-direction: column;
		padding: 0;
		background: #fff;
		color: #3c4047;
	}

	.pos-tile-edit {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 2;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		padding: 2px 6px;
		font-size: 11px;
		color: #6b7280;
		opacity: 0;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
		transition: opacity 0.15s ease;
	}

	.pos-tile:hover .pos-tile-edit {
		opacity: 1;
	}

	.pos-tile-edit:hover {
		color: #0074d9;
	}

	.pos-grid > .pos-tile .product-tile-name {
		display: flex;
		flex: 0 0 34%;
		align-items: center;
		justify-content: center;
		padding: 5px 8px;
		text-align: center;
		font-size: 17px;
		font-weight: 700;
		line-height: 1.1;
	}

	.pos-grid > .pos-tile > .pos-tile-inner.flex {
		width: 100%;
		height: 100%;
		padding: 0;
		color: #3c4047;
	}

	.pos-grid > .pos-tile > .pos-tile-inner > div:first-child {
		display: flex;
		flex: 1 1 66%;
		min-height: 0;
		align-items: center;
		justify-content: center;
		background: #0f7194;
		color: #fff;
		font-size: 46px;
		font-weight: 300;
	}

	.pos-grid > .pos-tile > .pos-tile-inner > div:last-child {
		display: flex;
		flex: 0 0 34%;
		align-items: center;
		justify-content: center;
		padding: 4px 6px;
		font-size: 17px;
		font-weight: 700;
		color: #3c4047;
	}

	.pos-side {
		display: flex;
		width: clamp(360px, 30vw, 420px);
		flex: 0 0 clamp(360px, 30vw, 420px);
		flex-direction: column;
		background: #ffffff !important;
	}

	.pos-side > div:first-child {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 72px;
		flex: 0 0 72px;
		padding: 0 20px;
		border-bottom: 1px solid #e1e3e6;
	}

	.pos-side h1 {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
	}

	.cart-clear-button {
		padding: 6px 10px;
		border-radius: 4px;
		color: #667085;
		font-size: 13px;
		font-weight: 700;
	}

	.cart-clear-button:hover:not(:disabled) {
		background: #f2f4f7;
		color: #d23b3b;
	}

	.cart-clear-button:disabled {
		color: #c3c8d0;
		cursor: default;
	}

	.pos-side > div:nth-child(2) {
		min-height: 0;
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 16px;
	}

	.pos-side > div:last-child {
		flex: 0 0 auto;
		padding: 16px;
		border-top: 1px solid #e1e3e6;
	}

	.sale-action-button {
		width: 100%;
		height: 64px;
		color: #fff;
		font-size: 20px;
		font-weight: 700;
	}

	.checkout-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 10px;
		margin-bottom: 12px;
	}

	.checkout-discount-button {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
		height: 48px;
		padding: 8px 10px;
		border: 1px solid #cfd4da !important;
		border-radius: 4px;
		background: #ffffff !important;
		color: #30333a !important;
		text-align: left;
	}

	.checkout-discount-button:hover {
		border-color: #0074f8 !important;
		background: #f3f8ff !important;
	}

	.checkout-discount-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex: 0 0 28px;
		border-radius: 999px;
		background: #0f7894;
		color: #ffffff;
		font-size: 18px;
		font-weight: 500;
	}

	.checkout-discount-button span:last-child {
		display: flex;
		min-width: 0;
		flex-direction: column;
		font-size: 13px;
		font-weight: 800;
		line-height: 1.15;
	}

	.checkout-discount-button strong {
		margin-top: 2px;
		color: #167a38;
		font-size: 12px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.payment-method-select {
		display: block;
		height: 48px;
		min-width: 0;
		width: 100%;
		padding: 0 34px 0 12px;
		border: 1px solid #cfd4da;
		border-radius: 4px;
		background: #ffffff;
		color: #30333a;
		font-size: 14px;
		font-weight: 800;
		outline: none;
	}

	.sale-action-button.charge-mode {
		background: #0074f8 !important;
	}

	.sale-action-button.charge-mode:hover:not(:disabled) {
		background: #0068df !important;
	}

	.sale-action-button.cancel-mode {
		background: #d23b3b !important;
	}

	.sale-action-button.cancel-mode:hover:not(:disabled) {
		background: #b92f2f !important;
	}

	.pos-side > div:last-child button:disabled {
		background: #b9c1ca !important;
	}

	.food-photo {
		position: relative;
		flex: 1 1 66%;
		min-height: 0;
		overflow: hidden;
		background: #d9c4ad;
	}

	.product-tile-name span {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.15;
		word-break: break-word;
	}

	.food-photo::before,
	.food-photo::after,
	.plate {
		position: absolute;
		content: '';
		display: block;
	}

	.plate {
		top: 50%;
		left: 50%;
		width: 72%;
		height: 68%;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.72);
		box-shadow: inset 0 0 0 7px rgba(235, 231, 224, 0.9), 0 5px 10px rgba(0, 0, 0, 0.08);
		transform: translate(-50%, -50%);
	}

	.photo-avocado { background: linear-gradient(135deg, #c79b6d, #efdfc8); }
	.photo-avocado::before { left: 30px; top: 18px; width: 54px; height: 28px; border-radius: 50%; background: #6ca63d; transform: rotate(12deg); z-index: 1; }
	.photo-avocado::after { left: 42px; top: 24px; width: 35px; height: 14px; border-radius: 50%; background: #d7e67b; z-index: 2; }

	.photo-bagel { background: linear-gradient(135deg, #cfa56c, #f1dcc1); }
	.photo-bagel::before { left: 37px; top: 11px; width: 50px; height: 42px; border-radius: 50%; background: radial-gradient(circle, #fff 0 20%, #b7782f 21% 42%, #e8be80 43% 100%); z-index: 1; }

	.photo-oatmeal { background: linear-gradient(135deg, #d9b987, #f4e5c8); }
	.photo-oatmeal::before { left: 30px; top: 10px; width: 62px; height: 44px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #314aa6 0 7%, transparent 8%), radial-gradient(circle at 62% 45%, #314aa6 0 7%, transparent 8%), #d6b36d; z-index: 1; }

	.photo-smoothie { background: linear-gradient(135deg, #f6c4cd, #f0ddc6); }
	.photo-smoothie::before { left: 42px; top: 8px; width: 40px; height: 52px; border-radius: 7px 7px 13px 13px; background: linear-gradient(#f89ab0, #de5e82); z-index: 1; }
	.photo-smoothie::after { left: 68px; top: 10px; width: 12px; height: 12px; border-radius: 50%; background: #c0183c; z-index: 2; }

	.photo-coffee { background: linear-gradient(135deg, #b79574, #ead7c1); }
	.photo-coffee::before { left: 35px; top: 13px; width: 54px; height: 38px; border-radius: 8px 8px 20px 20px; background: radial-gradient(ellipse at top, #1d120c 0 45%, #9cc3c4 46% 100%); z-index: 1; }
	.photo-coffee::after { left: 82px; top: 24px; width: 18px; height: 14px; border: 5px solid #9cc3c4; border-left: 0; border-radius: 0 12px 12px 0; z-index: 1; }

	.photo-sticky { background: linear-gradient(135deg, #e5c09b, #f2ddc6); }
	.photo-sticky::before { left: 31px; top: 15px; width: 60px; height: 36px; border-radius: 50%; background: repeating-radial-gradient(circle, #f6e0bd 0 7px, #b76a35 8px 14px); z-index: 1; }

	.photo-croissant { background: linear-gradient(135deg, #caa173, #ead9c5); }
	.photo-croissant::before { left: 28px; top: 19px; width: 68px; height: 28px; border-radius: 50% 50% 42% 42%; background: #c9873e; transform: rotate(-7deg); z-index: 1; }

	.photo-yogurt { background: linear-gradient(135deg, #e6cfb6, #f4e3d2); }
	.photo-yogurt::before { left: 31px; top: 11px; width: 62px; height: 42px; border-radius: 50%; background: radial-gradient(circle at 35% 40%, #d3164e 0 7%, transparent 8%), radial-gradient(circle at 57% 32%, #223aa8 0 7%, transparent 8%), #fff7ef; z-index: 1; }

	.photo-green { background: linear-gradient(135deg, #bedaa7, #e8dcc5); }
	.photo-green::before { left: 42px; top: 8px; width: 36px; height: 52px; border-radius: 6px 6px 13px 13px; background: linear-gradient(#9cda48, #3d9c32); z-index: 1; }

	.photo-espresso { background: linear-gradient(135deg, #d5b88c, #f3e1c7); }
	.photo-espresso::before { left: 35px; top: 19px; width: 52px; height: 27px; border-radius: 50%; background: radial-gradient(circle, #fff8ea 0 45%, #f7f0e6 46% 60%, #c7a77d 61% 100%); z-index: 1; }
	.photo-espresso::after { left: 47px; top: 24px; width: 28px; height: 13px; border-radius: 50%; background: #c99556; z-index: 2; }

	.photo-herb { background: linear-gradient(135deg, #d6a46d, #f2dfc8); }
	.photo-herb::before { left: 36px; top: 13px; width: 50px; height: 42px; border-radius: 45% 45% 40% 40%; background: radial-gradient(circle at 38% 38%, #a43320 0 7%, transparent 8%), radial-gradient(circle at 61% 45%, #6f8f25 0 6%, transparent 7%), #d9a85f; z-index: 1; }

	.photo-biscotti { background: linear-gradient(135deg, #c69a67, #ead9c4); }
	.photo-biscotti::before { left: 32px; top: 21px; width: 26px; height: 36px; border-radius: 8px; background: #8b5f37; transform: rotate(17deg); z-index: 1; }
	.photo-biscotti::after { left: 63px; top: 16px; width: 26px; height: 40px; border-radius: 8px; background: #4c3222; transform: rotate(16deg); z-index: 1; }

	.photo-bran { background: linear-gradient(135deg, #b98b65, #ead8c4); }
	.photo-bran::before { left: 33px; top: 13px; width: 58px; height: 43px; border-radius: 10px; background: radial-gradient(circle at 35% 35%, #51301e 0 7%, transparent 8%), #7d5136; transform: rotate(-8deg); z-index: 1; }

	.photo-orange { background: linear-gradient(135deg, #ffd188, #f2dfc1); }
	.photo-orange::before { left: 42px; top: 8px; width: 37px; height: 52px; border-radius: 6px 6px 13px 13px; background: linear-gradient(#ffca35, #f28b10); z-index: 1; }

	.photo-tea { background: linear-gradient(135deg, #d3ac79, #ead8bd); }
	.photo-tea::before { left: 34px; top: 17px; width: 56px; height: 28px; border-radius: 50%; background: radial-gradient(circle, #b87425 0 45%, #e8f5ed 46% 100%); z-index: 1; }

	.photo-cupcake { background: linear-gradient(135deg, #c8a176, #e9d8c4); }
	.photo-cupcake::before { left: 38px; top: 13px; width: 46px; height: 43px; border-radius: 50% 50% 25% 25%; background: linear-gradient(#2b201d 0 45%, #714221 46% 100%); z-index: 1; }

	.photo-brownie { background: linear-gradient(135deg, #b7926b, #ead9c7); }
	.photo-brownie::before { left: 34px; top: 14px; width: 56px; height: 42px; border-radius: 4px; background: #5a3528; transform: rotate(-4deg); z-index: 1; }

	.food-photo::before {
		left: 50% !important;
		top: 50% !important;
		transform: translate(-50%, -50%) scale(1.45) !important;
		transform-origin: center center;
	}

	.photo-avocado::before {
		transform: translate(-50%, -50%) rotate(12deg) scale(1.45) !important;
	}

	.photo-avocado::after {
		left: 50% !important;
		top: 50% !important;
		transform: translate(-45%, -50%) scale(1.45) !important;
		transform-origin: center center;
	}

	.photo-smoothie::after {
		left: calc(50% + 28px) !important;
		top: calc(50% - 32px) !important;
		transform: scale(1.35) !important;
		transform-origin: center center;
	}

	.photo-coffee::after {
		left: calc(50% + 36px) !important;
		top: calc(50% - 4px) !important;
		transform: scale(1.35) !important;
		transform-origin: center center;
	}

	.photo-croissant::before,
	.photo-bran::before,
	.photo-brownie::before {
		transform: translate(-50%, -50%) rotate(-7deg) scale(1.45) !important;
	}

	.photo-biscotti::before {
		left: calc(50% - 22px) !important;
		top: 50% !important;
		transform: translate(-50%, -50%) rotate(17deg) scale(1.45) !important;
		transform-origin: center center;
	}

	.photo-biscotti::after {
		left: calc(50% + 22px) !important;
		top: 50% !important;
		transform: translate(-50%, -50%) rotate(16deg) scale(1.45) !important;
		transform-origin: center center;
	}

	.photo-espresso::after,
	.photo-yogurt::after,
	.photo-tea::after {
		left: 50% !important;
		top: 50% !important;
		transform: translate(-50%, -50%) scale(1.45) !important;
		transform-origin: center center;
	}

	.pos-cart-scroll {
		padding: 16px 16px 12px;
	}

	.cart-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		margin-bottom: 12px;
		border-radius: 4px;
		font-size: 13px;
		line-height: 1.35;
	}

	.cart-banner-error {
		border: 1px solid #f2b2b2;
		background: #fff4f4;
		color: #b42323;
	}

	.cart-banner-warn {
		border: 1px solid #f1d68c;
		background: #fff8e3;
		color: #7a5d12;
	}

	.cart-banner-success {
		border: 1px solid #b8e0c4;
		background: #f3fff6;
		color: #167a38;
	}

	.cart-banner-muted {
		border: 1px dashed #d6d9dd;
		background: #fafbfc;
		color: #6b7280;
	}

	.cart-banner-bottom {
		margin-top: 14px;
		margin-bottom: 0;
	}

	.cart-lines {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.cart-line {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: start;
		column-gap: 12px;
		position: relative;
		padding: 12px 0;
		border-bottom: 1px solid #eef0f3;
	}

	.cart-line:first-child {
		padding-top: 4px;
	}

	.cart-line:last-child {
		border-bottom: 0;
	}

	.cart-line-main {
		min-width: 0;
	}

	.cart-line-name {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		border: 0;
		background: transparent;
		font-size: 16px;
		font-weight: 600;
		color: #0074d9;
		line-height: 1.25;
		text-align: left;
		cursor: pointer;
	}

	.cart-line-name:hover .cart-name-text {
		text-decoration: underline;
	}

	.cart-qty-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 999px;
		background: #e3f0ff;
		color: #0061cc;
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
	}

	.cart-name-text {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}

	.cart-line-modifier {
		margin-top: 2px;
		font-size: 13px;
		color: #8d939b;
	}

	.cart-line-right {
		display: flex;
		align-items: center;
		justify-self: end;
		gap: 0;
		padding-top: 1px;
		text-align: right;
	}

	.cart-line-price {
		display: block;
		min-width: 64px;
		font-size: 16px;
		font-weight: 600;
		color: #2a2e35;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.cart-line-remove {
		display: inline-flex;
		position: absolute;
		top: 9px;
		right: -2px;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: #b8bdc4;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.12s ease, color 0.12s ease, background 0.12s ease;
	}

	.cart-line:hover .cart-line-remove,
	.cart-line-remove:focus-visible {
		opacity: 1;
		transform: translateX(28px);
	}

	.cart-line-remove:hover {
		background: #fdecec;
		color: #d23b3b;
	}

	.cart-line-remove svg {
		width: 14px;
		height: 14px;
	}

	.cart-empty {
		list-style: none;
		padding: 28px 8px;
		text-align: center;
		font-size: 14px;
		color: #8d939b;
	}

	.cart-totals {
		margin-top: 14px;
		padding: 14px 0 4px;
		border-top: 1px solid #e1e3e6;
	}

	.cart-totals-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 0;
		font-size: 15px;
		color: #4a4f57;
		font-variant-numeric: tabular-nums;
	}

	.cart-totals-discount {
		color: #167a38;
	}

	.cart-totals-total {
		margin-top: 6px;
		padding-top: 12px;
		border-top: 1px solid #e1e3e6;
		font-size: 18px;
		font-weight: 700;
		color: #2a2e35;
	}
</style>
