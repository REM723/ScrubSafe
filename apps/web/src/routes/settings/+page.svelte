<script lang="ts">
  import Shell from '$lib/components/layout/Shell.svelte';
  import ProfileEditor from '$lib/components/features/ProfileEditor.svelte';
  import { session } from '$lib/stores/session';

  type ScrubLevel = 'all' | 'privacy-only' | 'gps-only';

  let scrubLevel = $state<ScrubLevel>('all');
  let keepIcc = $state(false);
  let notifyOnDone = $state(true);

  const SCRUB_LEVELS: { value: ScrubLevel; label: string; description: string }[] = [
    { value: 'all', label: 'Remove everything', description: 'Strip all metadata fields — safest option' },
    {
      value: 'privacy-only',
      label: 'Privacy fields only',
      description: 'Remove GPS, author, dates, and device info; keep colour profiles',
    },
    { value: 'gps-only', label: 'GPS only', description: 'Remove only location data' },
  ];
</script>

<svelte:head>
  <title>Settings — ScrubSafe</title>
</svelte:head>

<Shell>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
    <p class="mt-2 text-gray-500">Manage your account and scrubbing preferences.</p>

    <div class="mt-10 space-y-8">
      <!-- Profile section -->
      <section>
        <h2 class="text-base font-semibold text-gray-900">Profile</h2>
        <div class="mt-4 rounded-2xl border border-gray-200 bg-white p-6">
          {#if $session}
            <ProfileEditor user={$session} />
          {:else}
            <p class="text-sm text-gray-500">
              <a href="/auth/login" class="text-brand-500 hover:underline">Sign in</a> to manage your
              profile.
            </p>
          {/if}
        </div>
      </section>

      <!-- Scrubbing preferences -->
      <section>
        <h2 class="text-base font-semibold text-gray-900">Scrubbing preferences</h2>
        <p class="mt-1 text-sm text-gray-500">
          These settings apply to all files processed in this browser. Stored locally only.
        </p>

        <div class="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <!-- Scrub level -->
          <div class="border-b border-gray-100 p-5">
            <p class="text-sm font-medium text-gray-900">Default scrub level</p>
            <div class="mt-3 space-y-2">
              {#each SCRUB_LEVELS as level}
                <label class="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="scrub-level"
                    value={level.value}
                    bind:group={scrubLevel}
                    class="mt-0.5 h-4 w-4 border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p class="text-sm font-medium text-gray-700">{level.label}</p>
                    <p class="text-xs text-gray-400">{level.description}</p>
                  </div>
                </label>
              {/each}
            </div>
          </div>

          <!-- Keep ICC toggle -->
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <p class="text-sm font-medium text-gray-900">Keep ICC colour profile</p>
              <p class="text-xs text-gray-400">
                Retains colour accuracy for professional printing workflows
              </p>
            </div>
            <button
              role="switch"
              aria-checked={keepIcc}
              aria-label="Keep ICC colour profile"
              onclick={() => (keepIcc = !keepIcc)}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2
                     border-transparent transition-colors duration-200 ease-in-out
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                     {keepIcc ? 'bg-brand-500' : 'bg-gray-200'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
                       transition-transform duration-200 ease-in-out
                       {keepIcc ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>

          <!-- Notify on done toggle -->
          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-medium text-gray-900">Notify when scrubbing completes</p>
              <p class="text-xs text-gray-400">Show an in-page notification for each finished file</p>
            </div>
            <button
              role="switch"
              aria-checked={notifyOnDone}
              aria-label="Notify when scrubbing completes"
              onclick={() => (notifyOnDone = !notifyOnDone)}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2
                     border-transparent transition-colors duration-200 ease-in-out
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                     {notifyOnDone ? 'bg-brand-500' : 'bg-gray-200'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
                       transition-transform duration-200 ease-in-out
                       {notifyOnDone ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        </div>
      </section>

      <!-- Danger zone -->
      {#if $session}
        <section>
          <h2 class="text-base font-semibold text-gray-900">Account</h2>
          <div class="mt-4 rounded-2xl border border-red-200 bg-white p-6">
            <h3 class="text-sm font-medium text-gray-900">Delete account</h3>
            <p class="mt-1 text-sm text-gray-500">
              Permanently deletes your account and all usage data. This cannot be undone.
            </p>
            <button
              class="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium
                     text-red-600 transition-colors hover:bg-red-50"
            >
              Delete account
            </button>
          </div>
        </section>
      {/if}
    </div>
  </div>
</Shell>
