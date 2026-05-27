<script lang="ts">
  import Badge from '../ui/Badge.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import Button from '../ui/Button.svelte';
  import { formatBytes } from '$lib/utils/bytes';
  import type { FileEntry } from '$lib/stores/files';

  interface Props {
    entry: FileEntry;
    ondownload: (id: string) => void;
    onremove: (id: string) => void;
  }

  const { entry, ondownload, onremove }: Props = $props();
</script>

<li class="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4">
  <div class="flex items-center gap-3">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-gray-900" title={entry.filename}>
        {entry.filename}
      </p>
      <p class="mt-0.5 text-xs text-gray-400">
        {formatBytes(entry.originalSize)}
        {#if entry.report}
          → {formatBytes(entry.report.cleanSize)}
          <span class="text-green-600">
            (−{entry.report.fieldsRemoved.length} field{entry.report.fieldsRemoved.length === 1
              ? ''
              : 's'})
          </span>
        {/if}
      </p>
    </div>

    <Badge status={entry.status} />

    <div class="flex shrink-0 items-center gap-2">
      {#if entry.status === 'done' && entry.cleanUrl}
        <Button
          variant="primary"
          size="sm"
          onclick={() => ondownload(entry.id)}
        >
          Download
        </Button>
      {/if}
      <Button
        variant="ghost"
        size="sm"
        onclick={() => onremove(entry.id)}
        aria-label="Remove {entry.filename}"
      >
        ✕
      </Button>
    </div>
  </div>

  {#if entry.status === 'processing'}
    <ProgressBar value={entry.progress} />
  {/if}

  {#if entry.status === 'error' && entry.error}
    <p class="text-xs text-red-600">{entry.error}</p>
  {/if}
</li>
