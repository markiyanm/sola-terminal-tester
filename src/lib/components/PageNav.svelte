<script lang="ts">
	import { page } from '$app/stores';

	let currentPath = $derived($page.url.pathname);
</script>

<nav class="flex gap-1 bg-gray-800/50 rounded-lg p-1">
	<a
		href="/"
		class="px-4 py-1.5 text-sm rounded-md transition-colors {currentPath === '/'
			? 'bg-gray-700 text-gray-100 font-medium'
			: 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}"
	>
		V1 (Async)
	</a>
	<a
		href="/v2"
		class="px-4 py-1.5 text-sm rounded-md transition-colors {currentPath === '/v2'
			? 'bg-gray-700 text-gray-100 font-medium'
			: 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}"
	>
		V2 (Sync)
	</a>
	<a
		href="/pos"
		class="px-4 py-1.5 text-sm rounded-md transition-colors {currentPath === '/pos'
			? 'bg-gray-700 text-gray-100 font-medium'
			: 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}"
	>
		POS Demo
	</a>
</nav>
