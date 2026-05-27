<script lang="ts">
  import { session } from '$lib/stores/session';

  let mobileOpen = $state(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/inspect', label: 'Inspect' },
    { href: '/verify', label: 'Verify' },
    { href: '/how-it-works', label: 'How It Works' },
  ];
</script>

<header class="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
  <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
    <!-- Logo -->
    <a href="/" class="flex shrink-0 items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="h-6 w-6 text-brand-500"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-lg font-bold text-gray-900">ScrubSafe</span>
    </a>

    <!-- Desktop nav -->
    <div class="hidden items-center gap-0.5 md:flex">
      {#each navLinks as link}
        <a
          href={link.href}
          class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors
                 hover:bg-gray-100 hover:text-gray-900
                 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-600"
        >
          {link.label}
        </a>
      {/each}
    </div>

    <!-- Desktop right -->
    <div class="hidden items-center gap-2 md:flex">
      <a
        href="/settings"
        class="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900
               aria-[current=page]:bg-gray-100 aria-[current=page]:text-gray-900"
        aria-label="Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-5 w-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </a>

      {#if $session}
        <span class="text-sm text-gray-500">{$session.email}</span>
        <form method="POST" action="/api/auth/logout">
          <button
            type="submit"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600
                   transition-colors hover:bg-gray-50"
          >
            Sign out
          </button>
        </form>
      {:else}
        <a
          href="/auth/login"
          class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white
                 transition-colors hover:bg-brand-600"
        >
          Sign in
        </a>
      {/if}
    </div>

    <!-- Mobile hamburger -->
    <button
      class="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 md:hidden"
      onclick={() => (mobileOpen = !mobileOpen)}
      aria-expanded={mobileOpen}
      aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
    >
      {#if mobileOpen}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-6 w-6"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-6 w-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      {/if}
    </button>
  </nav>

  <!-- Mobile menu -->
  {#if mobileOpen}
    <div class="border-t border-gray-100 bg-white px-4 py-3 md:hidden">
      <div class="space-y-0.5">
        {#each navLinks as link}
          <a
            href={link.href}
            onclick={() => (mobileOpen = false)}
            class="block rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors
                   hover:bg-gray-50 hover:text-gray-900
                   aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-600"
          >
            {link.label}
          </a>
        {/each}
        <a
          href="/settings"
          onclick={() => (mobileOpen = false)}
          class="block rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors
                 hover:bg-gray-50 hover:text-gray-900"
        >
          Settings
        </a>
      </div>

      <div class="mt-3 border-t border-gray-100 pt-3">
        {#if $session}
          <p class="px-3 pb-2 text-xs text-gray-400">{$session.email}</p>
          <form method="POST" action="/api/auth/logout">
            <button
              type="submit"
              class="block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium
                     text-gray-700 transition-colors hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        {:else}
          <a
            href="/auth/login"
            onclick={() => (mobileOpen = false)}
            class="block rounded-md px-3 py-2.5 text-sm font-medium text-brand-600
                   transition-colors hover:bg-brand-50"
          >
            Sign in →
          </a>
        {/if}
      </div>
    </div>
  {/if}
</header>
