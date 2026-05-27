<script lang="ts">
  import type { FileStatus } from '@scrubsafe/shared-types';

  interface Props {
    status: FileStatus;
  }

  const { status }: Props = $props();

  const config: Record<FileStatus, { label: string; classes: string }> = {
    queued: { label: 'Queued', classes: 'bg-gray-100 text-gray-600' },
    processing: { label: 'Processing', classes: 'bg-blue-100 text-blue-700 animate-pulse' },
    done: { label: 'Done', classes: 'bg-green-100 text-green-700' },
    error: { label: 'Error', classes: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', classes: 'bg-yellow-100 text-yellow-700' },
  };
</script>

<span
  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
         {config[status].classes}"
>
  {config[status].label}
</span>
