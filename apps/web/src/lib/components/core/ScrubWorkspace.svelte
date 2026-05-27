<script lang="ts">
  import FileDropZone from '$lib/components/features/FileDropZone.svelte';
  import FileQueue from './FileQueue.svelte';
  import Button from '../ui/Button.svelte';
  import { fileStore, fileList } from '$lib/stores/files';
  import { processFiles, fileKey, formatRejectionMessage } from '$lib/utils/upload';
  import { toasts } from '$lib/stores/toasts';
  import { appendEntry } from '$lib/utils/audit-log';
  import { dispatch, cancel, cancelAll } from '$lib/workers/dispatcher';
  import type { WorkerOutbound } from '@scrubsafe/shared-types';

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  // Terminate any running workers when this component is destroyed.
  $effect(() => {
    return () => cancelAll();
  });

  // ── Queue state ───────────────────────────────────────────────────────────────

  const seenKeys = $derived(
    new Set($fileList.map((e) => fileKey(e.filename, e.originalSize))),
  );

  const hasFiles = $derived($fileList.length > 0);
  const hasDone = $derived($fileList.some((e) => e.status === 'done'));

  // ── File intake ───────────────────────────────────────────────────────────────

  async function handleFiles(raw: File[]): Promise<void> {
    const { accepted, rejected } = await processFiles(raw, seenKeys);

    for (const { file, reason } of rejected) {
      if (reason === 'duplicate') {
        toasts.info(formatRejectionMessage(file, reason));
      } else {
        toasts.error(formatRejectionMessage(file, reason));
      }
    }

    // Sequential arrayBuffer() reads avoid saturating memory for large batches.
    for (const { file, mime } of accepted) {
      const id = crypto.randomUUID();

      fileStore.add({
        id,
        filename: file.name,
        mime,
        originalSize: file.size,
        status: 'queued',
        progress: 0,
        cleanUrl: null,
        report: null,
        error: null,
      });

      const buffer = await file.arrayBuffer();
      dispatch(id, buffer, mime, (msg) => handleWorkerMessage(msg));
    }
  }

  // ── Worker messages ───────────────────────────────────────────────────────────

  function handleWorkerMessage(msg: WorkerOutbound): void {
    switch (msg.type) {
      case 'PROGRESS':
        fileStore.updateProgress(msg.id, msg.percent);
        break;

      case 'DONE': {
        const blob = new Blob([msg.cleanBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        fileStore.markDone(msg.id, url, msg.report);

        const entry = $fileList.find((e) => e.id === msg.id);
        if (entry) {
          const afterKeys = new Set(msg.report.after.fields.map((f) => f.key));
          const fieldsRemoved = msg.report.before.fields
            .filter((f) => !afterKeys.has(f.key))
            .map((f) => f.key);

          appendEntry({
            id: msg.id,
            timestamp: Date.now(),
            filename: entry.filename,
            originalSize: entry.originalSize,
            cleanSize: msg.report.cleanSize,
            fieldsRemoved,
          }).catch(console.error);

          const removed = msg.report.fieldsRemoved.length;
          toasts.success(
            `"${entry.filename}" cleaned — ${removed} metadata field${removed === 1 ? '' : 's'} removed.`,
          );
        }
        break;
      }

      case 'ERROR':
        fileStore.markError(msg.id, msg.message);
        toasts.error(`Processing failed: ${msg.message}`);
        break;
    }
  }

  // ── Queue actions ─────────────────────────────────────────────────────────────

  function handleDownload(id: string): void {
    const entry = $fileList.find((e) => e.id === id);
    if (!entry?.cleanUrl) return;

    const a = document.createElement('a');
    a.href = entry.cleanUrl;
    a.download = entry.filename;
    a.click();

    URL.revokeObjectURL(entry.cleanUrl);
    fileStore.revokeUrl(id);
  }

  function handleRemove(id: string): void {
    const entry = $fileList.find((e) => e.id === id);
    // If still processing, kill its worker before removing from the store.
    if (entry?.status === 'queued' || entry?.status === 'processing') {
      cancel(id);
    }
    if (entry?.cleanUrl) URL.revokeObjectURL(entry.cleanUrl);
    fileStore.remove(id);
  }

  function handleClearAll(): void {
    for (const entry of $fileList) {
      if (entry.status === 'queued' || entry.status === 'processing') {
        cancel(entry.id);
      }
      if (entry.cleanUrl) URL.revokeObjectURL(entry.cleanUrl);
    }
    fileStore.clear();
  }
</script>

<div class="space-y-4">
  <FileDropZone onfiles={handleFiles} />

  {#if hasFiles}
    <div class="flex items-center justify-between">
      <p class="text-sm text-gray-500">
        {$fileList.length} file{$fileList.length === 1 ? '' : 's'}
      </p>
      <div class="flex gap-2">
        {#if hasDone}
          <Button variant="secondary" size="sm" onclick={handleClearAll}>Clear done</Button>
        {/if}
        <Button variant="ghost" size="sm" onclick={handleClearAll}>Clear all</Button>
      </div>
    </div>
  {/if}

  <FileQueue entries={$fileList} ondownload={handleDownload} onremove={handleRemove} />
</div>
