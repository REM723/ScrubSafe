<script lang="ts">
  import { session } from '$lib/stores/session';
</script>

<header class="border-b border-gray-200 bg-white">
  <nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
    <a href="/" class="flex items-center gap-2">
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

    <div class="flex items-center gap-6">
      {#if $session}
        <a href="/dashboard" class="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
        <a href="/account" class="text-sm text-gray-600 hover:text-gray-900">Account</a>
        <form method="POST" action="/api/auth/logout">
          <button type="submit" class="text-sm text-gray-600 hover:text-gray-900">Sign out</button>
        </form>
      {:else}
        <a href="/dashboard" class="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
        <a
          href="/auth/login"
          class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Sign in
        </a>
      {/if}
    </div>
  </nav>
</header>
