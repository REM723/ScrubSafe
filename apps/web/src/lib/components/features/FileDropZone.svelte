<script lang="ts">
  import type { SupportedMime } from '@scrubsafe/shared-types';
  import { filesFromClipboard, MAX_FILE_SIZE } from '$lib/utils/upload';

  interface Props {
    onfiles: (files: File[]) => void;
    accept?: SupportedMime[];
    disabled?: boolean;
    compact?: boolean;
  }

  const { onfiles, accept, disabled = false, compact = false }: Props = $props();

  let dragging = $state(false);
  let dragCounter = $state(0);
  let pasting = $state(false);

  const FORMAT_LABELS: Partial<Record<SupportedMime, string>> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/tiff': 'TIFF',
    'image/heic': 'HEIC',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  };

  const displayFormats = $derived(
    accept ? accept.map((m) => FORMAT_LABELS[m] ?? m) : Object.values(FORMAT_LABELS),
  );

  const acceptAttr = $derived(
    accept?.join(',') ?? '.jpg,.jpeg,.png,.tif,.tiff,.heic,.pdf,.docx,.xlsx,.pptx',
  );

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    dragCounter++;
    dragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) dragging = false;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    dragCounter = 0;
    if (disabled) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) onfiles(files);
  }

  // ── Click to browse ───────────────────────────────────────────────────────────

  function handleInput(e: Event) {
    if (disabled) return;
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length) onfiles(files);
    // Reset so the same file can be re-selected after removal.
    input.value = '';
  }

  // ── Clipboard paste ───────────────────────────────────────────────────────────
  //
  // Registered on `document` so it fires anywhere on the page, not just when
  // the drop zone is focused.  The listener is torn down when the component
  // unmounts, preventing duplicate handlers if more than one instance mounts.

  $effect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (disabled) return;
      const files = filesFromClipboard(e);
      if (files.length === 0) return;

      e.preventDefault();
      pasting = true;
      setTimeout(() => { pasting = false; }, 1500);
      onfiles(files);
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  });

  // ── Visual state ─────────────────────────────────────────────────────────────

  const active = $derived(dragging || pasting);

  const MAX_MB = MAX_FILE_SIZE / 1_048_576;
</script>

<label
  class="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl
         border-2 border-dashed p-8 text-center transition-all duration-200
         {compact ? 'min-h-36' : 'min-h-64'}
         {active
           ? 'border-brand-500 bg-brand-50 scale-[1.005]'
           : 'border-gray-300 bg-white hover:border-brand-400 hover:bg-gray-50'}
         {disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''}"
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondragover={handleDragOver}
  ondrop={handleDrop}
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled}
  aria-label="Upload files — drag and drop, click to browse, or paste from clipboard"
  onkeydown={(e) => e.key === 'Enter' && !disabled && (e.currentTarget as HTMLElement).click()}
>
  <input
    type="file"
    multiple
    accept={acceptAttr}
    class="sr-only"
    oninput={handleInput}
    {disabled}
    aria-hidden="true"
    tabindex="-1"
  />

  <!-- Icon circle -->
  <div
    class="mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-200
           {active ? 'bg-brand-100' : 'bg-gray-100 group-hover:bg-brand-50'}"
  >
    {#if pasting}
      <!-- Clipboard icon when paste is active -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="h-8 w-8 text-brand-500"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
        />
      </svg>
    {:else}
      <!-- Upload cloud icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="h-8 w-8 transition-colors duration-200
               {dragging ? 'text-brand-500' : 'text-gray-400 group-hover:text-brand-400'}"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775
             5.25 5.25 0 0 1 10.338-2.32 3.75 3.75 0 0 1 3.818 3.821
             4.5 4.5 0 0 1-1.13 8.774H6.75Z"
        />
      </svg>
    {/if}
  </div>

  <!-- Label text -->
  {#if pasting}
    <p class="text-base font-semibold text-brand-600">Adding from clipboard…</p>
  {:else if dragging}
    <p class="text-base font-semibold text-brand-600">Release to add files</p>
  {:else}
    <p class="text-base font-semibold text-gray-700">Drop files here</p>
    <p class="mt-1 text-sm text-gray-400">
      <span class="text-brand-500 underline underline-offset-2">Click to browse</span>
      {' '}or paste from clipboard
    </p>
  {/if}

  {#if !compact}
    <div class="mt-4 flex flex-wrap justify-center gap-1.5">
      {#each displayFormats as fmt}
        <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
          {fmt}
        </span>
      {/each}
    </div>
    <p class="mt-3 text-xs text-gray-400">
      Up to {MAX_MB} MB per file · processed locally · nothing leaves your device
    </p>
  {/if}
</label>
