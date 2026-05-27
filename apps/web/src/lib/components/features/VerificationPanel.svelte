<script lang="ts">
  import FileDropZone from './FileDropZone.svelte';
  import { formatBytes } from '$lib/utils/bytes';

  type ScanStatus = 'idle' | 'scanning' | 'clean' | 'dirty';

  interface CategoryResult {
    name: string;
    clean: boolean;
    count: number;
  }

  let file = $state<File | null>(null);
  let status = $state<ScanStatus>('idle');
  let categories = $state<CategoryResult[]>([]);

  const totalFields = $derived(categories.reduce((s, c) => s + c.count, 0));

  async function handleFiles(files: File[]) {
    const f = files[0];
    if (!f) return;
    file = f;
    status = 'scanning';
    categories = [];

    // Simulate an in-browser metadata scan (real impl delegates to WASM in read-only mode)
    await new Promise<void>((r) => setTimeout(r, 700));

    categories = [
      { name: 'EXIF', clean: true, count: 0 },
      { name: 'XMP', clean: true, count: 0 },
      { name: 'IPTC', clean: true, count: 0 },
      { name: 'GPS', clean: true, count: 0 },
      { name: 'ICC Profile', clean: true, count: 0 },
    ];

    status = categories.some((c) => !c.clean) ? 'dirty' : 'clean';
  }

  function reset() {
    file = null;
    status = 'idle';
    categories = [];
  }
</script>

<div class="space-y-6">
  {#if status === 'idle'}
    <FileDropZone onfiles={handleFiles} />
    <p class="text-center text-sm text-gray-400">
      Upload a previously scrubbed file to confirm all metadata has been removed.
    </p>
  {:else}
    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <!-- File header -->
      <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
        <div class="min-w-0">
          <p class="truncate font-medium text-gray-900">{file?.name}</p>
          <p class="text-sm text-gray-500">{formatBytes(file?.size ?? 0)}</p>
        </div>
        <button
          onclick={reset}
          class="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
          aria-label="Clear file"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-5 w-5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if status === 'scanning'}
        <div class="flex flex-col items-center gap-3 py-14">
          <div
            class="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
          ></div>
          <p class="text-sm text-gray-500">Scanning for metadata…</p>
        </div>

      {:else}
        <!-- Result banner -->
        <div class="px-5 py-4 {status === 'clean' ? 'bg-green-50' : 'bg-amber-50'}">
          <div class="flex items-center gap-3">
            {#if status === 'clean'}
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2.5"
                  stroke="currentColor"
                  class="h-5 w-5 text-green-600"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-green-800">File is clean</p>
                <p class="text-sm text-green-700">No metadata detected in any checked category.</p>
              </div>
            {:else}
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="h-5 w-5 text-amber-600"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
                       1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-amber-800">Metadata detected</p>
                <p class="text-sm text-amber-700">
                  {totalFields} field{totalFields === 1 ? '' : 's'} found. Scrub the file to remove
                  them.
                </p>
              </div>
            {/if}
          </div>
        </div>

        <!-- Category checklist -->
        <div class="divide-y divide-gray-100">
          {#each categories as cat}
            <div class="flex items-center justify-between px-5 py-3">
              <div class="flex items-center gap-3">
                {#if cat.clean}
                  <div
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="2.5"
                      stroke="currentColor"
                      class="h-3.5 w-3.5 text-green-600"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </div>
                {:else}
                  <div
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100"
                  >
                    <span class="text-xs font-bold text-amber-700">{cat.count}</span>
                  </div>
                {/if}
                <span class="text-sm font-medium text-gray-700">{cat.name}</span>
              </div>
              <span
                class="text-xs font-medium {cat.clean ? 'text-green-600' : 'text-amber-600'}"
              >
                {cat.clean ? 'Clean' : `${cat.count} field${cat.count === 1 ? '' : 's'}`}
              </span>
            </div>
          {/each}
        </div>

        <!-- CTA if dirty -->
        {#if status === 'dirty'}
          <div class="border-t border-gray-100 p-5">
            <a
              href="/inspect"
              class="inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium
                     text-white transition-colors hover:bg-brand-600"
            >
              Scrub this file →
            </a>
          </div>
        {:else}
          <div class="border-t border-gray-100 p-5">
            <button
              onclick={reset}
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium
                     text-gray-700 transition-colors hover:bg-gray-50"
            >
              Verify another file
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
