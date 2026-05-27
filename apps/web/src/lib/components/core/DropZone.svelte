<script lang="ts">
  import type { SupportedMime } from '@scrubsafe/shared-types';

  interface Props {
    onfiles: (files: File[]) => void;
    accept?: SupportedMime[];
    disabled?: boolean;
  }

  const { onfiles, accept, disabled = false }: Props = $props();

  let dragging = $state(false);
  let dragCounter = $state(0);

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
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    dragCounter = 0;
    if (disabled) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) onfiles(files);
  }

  function handleInput(e: Event) {
    if (disabled) return;
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length > 0) onfiles(files);
    input.value = '';
  }

  const acceptAttr = accept?.join(',') ?? '.jpg,.jpeg,.png,.tif,.tiff,.heic,.pdf,.docx,.xlsx,.pptx';
</script>

<label
  class="relative flex min-h-56 cursor-pointer flex-col items-center justify-center
         rounded-2xl border-2 border-dashed p-8 text-center transition-colors
         {dragging
    ? 'border-brand-500 bg-brand-50'
    : 'border-gray-300 bg-white hover:border-brand-400 hover:bg-gray-50'}
         {disabled ? 'cursor-not-allowed opacity-50' : ''}"
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondragover={handleDragOver}
  ondrop={handleDrop}
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled}
  onkeydown={(e) => e.key === 'Enter' && !disabled && (e.target as HTMLElement).click()}
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

  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="mb-4 h-12 w-12 {dragging ? 'text-brand-500' : 'text-gray-300'}"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 3.75 3.75 0 0 1 3.818 3.821 4.5 4.5 0 0 1-1.13 8.774H6.75Z"
    />
  </svg>

  <p class="text-base font-medium text-gray-700">
    {dragging ? 'Release to add files' : 'Drop files here'}
  </p>
  <p class="mt-1 text-sm text-gray-400">or click to browse</p>
  <p class="mt-3 text-xs text-gray-400">
    JPEG · PNG · TIFF · HEIC · PDF · DOCX · XLSX · PPTX
  </p>
</label>
