<script lang="ts">
  import Shell from '$lib/components/layout/Shell.svelte';

  const steps = [
    {
      number: '01',
      title: 'Drop your file',
      body: 'Drag and drop or click to select any supported file — JPEG, PNG, TIFF, HEIC, PDF, DOCX, XLSX, or PPTX. No account required.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 3.75 3.75 0 0 1 3.818 3.821 4.5 4.5 0 0 1-1.13 8.774H6.75Z" />`,
    },
    {
      number: '02',
      title: 'We inspect the metadata',
      body: 'ScrubSafe reads the file in your browser and catalogues every metadata field: EXIF camera data, GPS coordinates, XMP editing history, IPTC author info, and more.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />`,
    },
    {
      number: '03',
      title: 'WASM strips it clean',
      body: 'A WebAssembly processor runs inside your browser tab and rewrites the file, removing every metadata field while keeping the actual content pixel-perfect.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />`,
    },
    {
      number: '04',
      title: 'Download the clean file',
      body: 'Your scrubbed file is ready instantly. Click download and you get a private, metadata-free version. The original is never stored anywhere.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />`,
    },
  ];

  const faqs = [
    {
      q: 'Does anything leave my device?',
      a: 'No. File bytes are processed entirely inside your browser using WebAssembly. ScrubSafe\'s servers never receive your file content — only optional anonymous usage counters.',
    },
    {
      q: 'Which metadata is removed?',
      a: 'All of it by default: EXIF (camera model, timestamp, settings), GPS location, XMP (editing software history), IPTC (author, copyright, keywords), and ICC colour profiles. You can configure which categories to keep in Settings.',
    },
    {
      q: 'Does scrubbing change the image quality?',
      a: 'No. The pixel data is untouched. Only the metadata sidecar data embedded in the file header is removed. The resulting image looks identical.',
    },
    {
      q: 'What file formats are supported?',
      a: 'JPEG, PNG, TIFF, HEIC/HEIF, PDF, DOCX, XLSX, and PPTX. More formats are on the roadmap.',
    },
    {
      q: 'Do I need an account?',
      a: 'No. Scrubbing is free and works without signing in. An account unlocks usage history and higher monthly limits.',
    },
  ];

  let openFaq = $state<number | null>(null);

  function toggleFaq(i: number) {
    openFaq = openFaq === i ? null : i;
  }
</script>

<svelte:head>
  <title>How It Works — ScrubSafe</title>
</svelte:head>

<Shell>
  <!-- Hero -->
  <section class="border-b border-gray-100 bg-gray-50 px-4 py-16">
    <div class="mx-auto max-w-2xl text-center">
      <h1 class="text-4xl font-bold tracking-tight text-gray-900">How It Works</h1>
      <p class="mt-4 text-lg text-gray-500">
        ScrubSafe is a privacy tool that runs entirely in your browser — no servers, no uploads, no
        accounts required.
      </p>
    </div>
  </section>

  <!-- Steps -->
  <section class="mx-auto max-w-3xl px-4 py-16">
    <div class="space-y-12">
      {#each steps as step, i}
        <div class="flex gap-6 sm:gap-8">
          <!-- Step number + icon -->
          <div class="flex shrink-0 flex-col items-center">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white
                     shadow-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-6 w-6"
                aria-hidden="true"
              >
                {@html step.icon}
              </svg>
            </div>
            {#if i < steps.length - 1}
              <div class="mt-3 h-12 w-px bg-gray-200"></div>
            {/if}
          </div>

          <!-- Content -->
          <div class="pb-4">
            <div class="flex items-baseline gap-3">
              <span class="text-xs font-bold tracking-widest text-brand-400">{step.number}</span>
              <h2 class="text-xl font-semibold text-gray-900">{step.title}</h2>
            </div>
            <p class="mt-2 text-gray-500 leading-relaxed">{step.body}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Architecture callout -->
  <section class="border-y border-gray-100 bg-brand-50 px-4 py-12">
    <div class="mx-auto max-w-3xl">
      <h2 class="text-lg font-bold text-brand-900">The processing pipeline</h2>
      <div
        class="mt-4 flex flex-col items-start gap-2 overflow-x-auto sm:flex-row sm:items-center"
      >
        {#each ['UI thread', 'Web Worker', 'WASM processor', 'Web Worker', 'UI thread'] as node, i}
          <div class="flex items-center gap-2">
            {#if i > 0}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="h-4 w-4 shrink-0 text-brand-400"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            {/if}
            <span
              class="whitespace-nowrap rounded-lg border border-brand-200 bg-white px-3 py-1.5
                     text-sm font-medium text-brand-700 shadow-sm"
            >
              {node}
            </span>
          </div>
        {/each}
      </div>
      <p class="mt-4 text-sm text-brand-700">
        The <code class="rounded bg-brand-100 px-1.5 py-0.5 font-mono text-xs">ArrayBuffer</code> is
        <em>transferred</em> (zero-copy) to the Worker — the original reference becomes detached.
        Your file bytes never touch a network socket.
      </p>
    </div>
  </section>

  <!-- FAQ -->
  <section class="mx-auto max-w-3xl px-4 py-16">
    <h2 class="text-2xl font-bold text-gray-900">Frequently asked questions</h2>

    <div class="mt-6 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
      {#each faqs as faq, i}
        <div>
          <button
            class="flex w-full items-center justify-between px-5 py-4 text-left transition-colors
                   hover:bg-gray-50"
            onclick={() => toggleFaq(i)}
            aria-expanded={openFaq === i}
          >
            <span class="text-sm font-medium text-gray-900">{faq.q}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="ml-4 h-4 w-4 shrink-0 text-gray-400 transition-transform
                     {openFaq === i ? 'rotate-180' : ''}"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {#if openFaq === i}
            <div class="border-t border-gray-100 px-5 pb-4 pt-3">
              <p class="text-sm leading-relaxed text-gray-600">{faq.a}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <!-- CTA -->
  <section class="border-t border-gray-100 bg-gray-50 px-4 py-14">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-2xl font-bold text-gray-900">Ready to scrub your first file?</h2>
      <p class="mt-3 text-gray-500">No sign-up required. Works in any modern browser.</p>
      <a
        href="/inspect"
        class="mt-6 inline-block rounded-xl bg-brand-500 px-8 py-3 text-sm font-semibold
               text-white shadow-sm transition-colors hover:bg-brand-600"
      >
        Start scrubbing →
      </a>
    </div>
  </section>
</Shell>
