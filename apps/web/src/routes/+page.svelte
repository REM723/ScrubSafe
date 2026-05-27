<script lang="ts">
  import Shell from '$lib/components/layout/Shell.svelte';
  import ScrubWorkspace from '$lib/components/core/ScrubWorkspace.svelte';

  const FEATURES = [
    {
      title: 'Fully local',
      body: 'WebAssembly runs inside your browser tab. Your file bytes never touch a server.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 5.25 5.25 0 0 0 5.25 15.75 11.959 11.959 0 0 1 12 21a11.96 11.96 0 0 1-6.75-5.25A5.25 5.25 0 0 0 6.75 6a11.959 11.959 0 0 1 2.25-1.036Z" />`,
    },
    {
      title: 'All major formats',
      body: 'JPEG, PNG, TIFF, HEIC, PDF, DOCX, XLSX, PPTX — every common file type covered.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />`,
    },
    {
      title: 'No account needed',
      body: 'Start scrubbing immediately. Sign up only if you want usage history or higher limits.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />`,
    },
  ];
</script>

<svelte:head>
  <title>ScrubSafe — Strip file metadata in your browser</title>
</svelte:head>

<Shell>
  <!-- Hero -->
  <section class="bg-gradient-to-b from-brand-50 to-white px-4 py-16 sm:py-20">
    <div class="mx-auto max-w-2xl text-center">
      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs
               font-semibold text-brand-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
            clip-rule="evenodd"
          />
        </svg>
        100% local · Zero uploads
      </span>

      <h1 class="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        Your files. Your privacy.<br class="hidden sm:block" /> No exceptions.
      </h1>
      <p class="mt-5 text-lg text-gray-500">
        Strip EXIF, GPS, XMP, and IPTC metadata from images and documents — entirely inside your
        browser. Nothing ever leaves your device.
      </p>

      <div class="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a
          href="/inspect"
          class="w-full rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm
                 transition-colors hover:bg-brand-600 sm:w-auto"
        >
          Inspect & Scrub Files
        </a>
        <a
          href="/how-it-works"
          class="w-full rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold
                 text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
        >
          How It Works
        </a>
      </div>
    </div>
  </section>

  <!-- Quick scrub -->
  <section class="mx-auto max-w-3xl px-4 pb-4 pt-10">
    <p class="mb-4 text-center text-sm font-medium text-gray-500">
      Or drop a file right here to get started:
    </p>
    <ScrubWorkspace />
  </section>

  <!-- Features -->
  <section class="border-t border-gray-100 bg-gray-50 px-4 py-16 mt-12">
    <div class="mx-auto max-w-5xl">
      <h2 class="text-center text-2xl font-bold text-gray-900">Privacy by design</h2>
      <p class="mt-2 text-center text-sm text-gray-500">
        Every architectural decision was made to keep your files under your control.
      </p>

      <div class="mt-10 grid gap-6 sm:grid-cols-3">
        {#each FEATURES as feat}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-5 w-5 text-brand-500"
                aria-hidden="true"
              >
                {@html feat.icon}
              </svg>
            </div>
            <h3 class="mt-4 font-semibold text-gray-900">{feat.title}</h3>
            <p class="mt-2 text-sm leading-relaxed text-gray-500">{feat.body}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Supported formats bar -->
  <section class="border-t border-gray-100 bg-white px-4 py-10">
    <div class="mx-auto max-w-3xl text-center">
      <p class="text-xs font-semibold uppercase tracking-widest text-gray-400">Supported formats</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        {#each ['JPEG', 'PNG', 'TIFF', 'HEIC', 'PDF', 'DOCX', 'XLSX', 'PPTX'] as fmt}
          <span
            class="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500"
          >
            {fmt}
          </span>
        {/each}
      </div>
    </div>
  </section>
</Shell>
