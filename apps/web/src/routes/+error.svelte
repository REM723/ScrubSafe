<script lang="ts">
  import { page } from '$app/stores';
  import Shell from '$lib/components/layout/Shell.svelte';
</script>

<Shell>
  <div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
    <p class="text-6xl font-bold text-gray-200">{$page.status}</p>
    <h1 class="mt-4 text-2xl font-semibold text-gray-900">
      {$page.status === 404 ? 'Page not found' : 'Something went wrong'}
    </h1>
    <p class="mt-2 text-gray-500">{$page.error?.message ?? 'An unexpected error occurred.'}</p>
    <a
      href="/"
      class="mt-8 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
    >
      Go home
    </a>
  </div>
</Shell>
