<script lang="ts">
  import Shell from '$lib/components/layout/Shell.svelte';
  import { session } from '$lib/stores/session';
</script>

<svelte:head>
  <title>Dashboard — ScrubSafe</title>
</svelte:head>

<Shell>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>

    {#if $session}
      <p class="mt-2 text-gray-500">Signed in as {$session.email}</p>

      <div class="mt-8 grid gap-6 sm:grid-cols-2">
        <div class="rounded-xl border border-gray-200 bg-white p-6">
          <p class="text-sm font-medium text-gray-500">Files scrubbed this month</p>
          <p class="mt-2 text-4xl font-bold text-gray-900">—</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-6">
          <p class="text-sm font-medium text-gray-500">Current plan</p>
          <p class="mt-2 text-4xl font-bold capitalize text-gray-900">{$session.plan}</p>
        </div>
      </div>
    {:else}
      <p class="mt-4 text-gray-500">
        <a href="/auth/login" class="text-brand-500 hover:underline">Sign in</a> to view your dashboard.
      </p>
    {/if}
  </div>
</Shell>
