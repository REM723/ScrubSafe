<script lang="ts">
  import Shell from '$lib/components/layout/Shell.svelte';
  import ScrubWorkspace from '$lib/components/core/ScrubWorkspace.svelte';
  import MetadataInspector from '$lib/components/features/MetadataInspector.svelte';
  import { fileList } from '$lib/stores/files';

  const doneFiles = $derived($fileList.filter((f) => f.status === 'done' && f.report !== null));
</script>

<svelte:head>
  <title>Inspect & Scrub — ScrubSafe</title>
</svelte:head>

<Shell>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">Inspect & Scrub</h1>
      <p class="mt-2 text-gray-500">
        Drop files below to see exactly what metadata they contain, then remove it all with one
        click.
      </p>
    </div>

    <!-- Privacy note -->
    <div
      class="mb-6 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="mt-0.5 h-5 w-5 shrink-0 text-brand-500"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6
             5.25 5.25 0 0 0 5.25 15.75 11.959 11.959 0 0 1 12 21a11.96 11.96 0
             0 1-6.75-5.25A5.25 5.25 0 0 0 6.75 6a11.959 11.959 0 0 1 2.25-1.036Z"
        />
      </svg>
      <p class="text-sm text-brand-700">
        All processing happens in your browser via WebAssembly. File bytes never leave your device.
      </p>
    </div>

    <!-- Scrub workspace (drop zone + file queue) -->
    <ScrubWorkspace />

    <!-- Metadata inspector for completed files -->
    {#if doneFiles.length > 0}
      <div class="mt-10 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Scrub reports</h2>
        {#each doneFiles as entry}
          {#if entry.report}
            <MetadataInspector filename={entry.filename} report={entry.report} />
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</Shell>
