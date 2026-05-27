<script lang="ts">
  import type { Snippet } from 'svelte';
  import Header from './Header.svelte';
  import Footer from './Footer.svelte';
  import ToastHost from '$lib/components/ui/ToastHost.svelte';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div class="flex min-h-screen flex-col bg-gray-50">
  <Header />
  <main class="flex-1">
    {@render children()}
  </main>
  <Footer />
</div>

<ToastHost />
