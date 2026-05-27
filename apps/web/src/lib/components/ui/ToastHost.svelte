<script lang="ts">
  import { fly } from 'svelte/transition';
  import Toast from './Toast.svelte';
  import { toasts } from '$lib/stores/toasts';
</script>

<!--
  Positioned fixed at bottom-centre, above everything else.
  pointer-events-none on the container lets clicks pass through the gap between toasts.
-->
<div
  aria-live="polite"
  aria-atomic="false"
  class="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm
         -translate-x-1/2 flex-col gap-2 px-4"
>
  {#each $toasts as toast (toast.id)}
    <div
      class="pointer-events-auto"
      in:fly={{ y: 10, duration: 200 }}
      out:fly={{ y: 10, duration: 150 }}
    >
      <Toast {toast} ondismiss={(id) => toasts.dismiss(id)} />
    </div>
  {/each}
</div>
