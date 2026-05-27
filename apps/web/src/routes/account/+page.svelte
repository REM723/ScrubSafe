<script lang="ts">
  import Shell from '$lib/components/layout/Shell.svelte';
  import { session } from '$lib/stores/session';
</script>

<svelte:head>
  <title>Account — ScrubSafe</title>
</svelte:head>

<Shell>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <h1 class="text-3xl font-bold text-gray-900">Account</h1>

    {#if $session}
      <div class="mt-8 space-y-6">
        <div class="rounded-xl border border-gray-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-gray-900">Profile</h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex gap-4">
              <dt class="w-24 font-medium text-gray-500">Email</dt>
              <dd class="text-gray-900">{$session.email}</dd>
            </div>
            <div class="flex gap-4">
              <dt class="w-24 font-medium text-gray-500">Plan</dt>
              <dd class="capitalize text-gray-900">{$session.plan}</dd>
            </div>
          </dl>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-gray-900">Billing</h2>
          <p class="mt-2 text-sm text-gray-500">
            Manage your subscription and invoices via the Stripe customer portal.
          </p>
          <a
            href="/api/billing/portal"
            class="mt-4 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Open billing portal
          </a>
        </div>
      </div>
    {:else}
      <p class="mt-4 text-gray-500">
        <a href="/auth/login" class="text-brand-500 hover:underline">Sign in</a> to manage your account.
      </p>
    {/if}
  </div>
</Shell>
