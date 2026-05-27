<script lang="ts">
  import FileRow from './FileRow.svelte';
  import type { FileEntry } from '$lib/stores/files';

  interface Props {
    entries: FileEntry[];
    ondownload: (id: string) => void;
    onremove: (id: string) => void;
  }

  const { entries, ondownload, onremove }: Props = $props();
</script>

{#if entries.length > 0}
  <ul class="mt-4 space-y-2" aria-label="File queue">
    {#each entries as entry (entry.id)}
      <FileRow {entry} {ondownload} {onremove} />
    {/each}
  </ul>
{/if}
