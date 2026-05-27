<script lang="ts">
  import type { User } from '$lib/stores/session';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    user: User | null;
    onsave?: (data: { email: string }) => void;
  }

  const { user, onsave }: Props = $props();

  let email = $state('');
  let saving = $state(false);
  let saved = $state(false);

  $effect(() => {
    email = user?.email ?? '';
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!user) return;
    saving = true;
    // In production this POSTs to the API
    await new Promise<void>((r) => setTimeout(r, 500));
    onsave?.({ email });
    saving = false;
    saved = true;
    setTimeout(() => (saved = false), 3000);
  }
</script>

<form onsubmit={handleSubmit} class="space-y-6">
  <!-- Email -->
  <div>
    <label for="profile-email" class="block text-sm font-medium text-gray-700">
      Email address
    </label>
    <input
      id="profile-email"
      type="email"
      bind:value={email}
      disabled={!user}
      placeholder="you@example.com"
      class="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
             shadow-sm placeholder:text-gray-400
             focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
             disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
    />
  </div>

  <!-- Plan -->
  <div>
    <p class="text-sm font-medium text-gray-700">Plan</p>
    <div class="mt-1.5 flex items-center gap-3">
      <span
        class="rounded-full px-3 py-1 text-xs font-semibold capitalize
               {user?.plan === 'pro' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}"
      >
        {user?.plan ?? 'Free'}
      </span>
      {#if user?.plan === 'free'}
        <a
          href="/api/billing/portal"
          class="text-xs font-medium text-brand-500 underline underline-offset-2 hover:text-brand-600"
        >
          Upgrade to Pro →
        </a>
      {:else if user?.plan === 'pro'}
        <a
          href="/api/billing/portal"
          class="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700"
        >
          Manage billing →
        </a>
      {/if}
    </div>
  </div>

  <!-- Save row -->
  <div class="flex items-center gap-3 border-t border-gray-100 pt-4">
    <Button type="submit" disabled={!user || saving}>
      {saving ? 'Saving…' : 'Save changes'}
    </Button>

    {#if saved}
      <span class="flex items-center gap-1.5 text-sm text-green-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2.5"
          stroke="currentColor"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        Saved
      </span>
    {/if}
  </div>
</form>
