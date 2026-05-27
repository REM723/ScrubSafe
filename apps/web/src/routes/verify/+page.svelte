<script lang="ts">
  import Shell from '$lib/components/layout/Shell.svelte';
  import VerificationPanel from '$lib/components/features/VerificationPanel.svelte';
</script>

<svelte:head>
  <title>Verify Clean Files — ScrubSafe</title>
</svelte:head>

<Shell>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <!-- Page header -->
    <div class="mb-8 text-center">
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-7 w-7 text-green-600"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043
               3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268
               0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0
               1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0
               1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0
               2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043
               3.296A3.745 3.745 0 0 1 21 12Z"
          />
        </svg>
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">Verify Clean Files</h1>
      <p class="mt-3 text-gray-500">
        Upload a file to confirm all metadata has been stripped. Runs entirely in your browser —
        nothing is uploaded.
      </p>
    </div>

    <VerificationPanel />

    <!-- How verification works -->
    <div class="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6">
      <h2 class="text-sm font-semibold text-gray-900">What we check</h2>
      <ul class="mt-3 space-y-2">
        {#each ['EXIF — camera, timestamp, lens settings', 'XMP — Adobe editing history', 'IPTC — author, copyright, keywords', 'GPS — precise location coordinates', 'ICC Profile — color space metadata'] as item}
          <li class="flex items-center gap-2 text-sm text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-4 w-4 shrink-0 text-brand-500"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {item}
          </li>
        {/each}
      </ul>
    </div>
  </div>
</Shell>
