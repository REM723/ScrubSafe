<script lang="ts">
  import type { ToastMessage } from '$lib/types';

  interface Props {
    toast: ToastMessage;
    ondismiss: (id: string) => void;
  }

  const { toast, ondismiss }: Props = $props();

  const iconMap: Record<ToastMessage['type'], string> = {
    success: '✓',
    error: '✕',
    info: 'i',
  };

  const colorMap: Record<ToastMessage['type'], string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
</script>

<div
  role="alert"
  class="flex items-start gap-3 rounded-lg border px-4 py-3 shadow-sm
         {colorMap[toast.type]}"
>
  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
               bg-current text-xs font-bold text-white">
    {iconMap[toast.type]}
  </span>
  <p class="flex-1 text-sm font-medium">{toast.message}</p>
  <button
    type="button"
    class="shrink-0 opacity-60 hover:opacity-100"
    onclick={() => ondismiss(toast.id)}
    aria-label="Dismiss"
  >
    ✕
  </button>
</div>
