<script lang="ts">
  import type { MetadataReport, MetadataCategory, MetadataField } from '@scrubsafe/shared-types';
  import { formatBytes, savingsPercent } from '$lib/utils/bytes';

  interface CategoryGroup {
    id: MetadataCategory;
    label: string;
    removed: MetadataField[];
    sensitive: boolean;
  }

  interface Props {
    filename: string;
    report: MetadataReport;
  }

  const { filename, report }: Props = $props();

  const CATEGORY_META: Record<MetadataCategory, { label: string; startOpen: boolean }> = {
    location:  { label: 'Location',  startOpen: true  },
    identity:  { label: 'Identity',  startOpen: true  },
    device:    { label: 'Device',    startOpen: false },
    software:  { label: 'Software',  startOpen: false },
    history:   { label: 'History',   startOpen: false },
    other:     { label: 'Other',     startOpen: false },
  };

  const CATEGORY_ORDER: MetadataCategory[] = [
    'location', 'identity', 'device', 'software', 'history', 'other',
  ];

  const CATEGORY_COLORS: Record<MetadataCategory, string> = {
    location:  'bg-red-100 text-red-700',
    identity:  'bg-orange-100 text-orange-700',
    device:    'bg-blue-100 text-blue-700',
    software:  'bg-purple-100 text-purple-700',
    history:   'bg-yellow-100 text-yellow-700',
    other:     'bg-gray-100 text-gray-600',
  };

  const afterKeys = $derived(new Set(report.after.fields.map((f) => f.key)));

  const removedFields = $derived(report.before.fields.filter((f) => !afterKeys.has(f.key)));

  const retainedFields = $derived(report.after.fields);

  const groups = $derived.by<CategoryGroup[]>(() => {
    const map = new Map<MetadataCategory, MetadataField[]>();
    for (const field of removedFields) {
      const bucket = map.get(field.category) ?? [];
      bucket.push(field);
      map.set(field.category, bucket);
    }
    return CATEGORY_ORDER
      .filter((id) => map.has(id))
      .map((id) => ({
        id,
        label: CATEGORY_META[id].label,
        removed: map.get(id)!,
        sensitive: map.get(id)!.some((f) => f.sensitive),
      }));
  });

  const sensitiveCount = $derived(removedFields.filter((f) => f.sensitive).length);
  const savedPct = $derived(savingsPercent(report.originalSize, report.cleanSize));
</script>

<div class="overflow-hidden rounded-2xl border border-gray-200 bg-white">
  <!-- Header -->
  <div class="border-b border-gray-100 bg-gray-50 px-5 py-4">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h3 class="truncate font-semibold text-gray-900">{filename}</h3>
        <p class="mt-0.5 text-sm text-gray-500">
          {formatBytes(report.originalSize)} → {formatBytes(report.cleanSize)}
        </p>
      </div>
      <span
        class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold
               {removedFields.length === 0 ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}"
      >
        {removedFields.length === 0 ? 'Already clean' : 'Scrubbed'}
      </span>
    </div>
  </div>

  <!-- Stats row -->
  <div class="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
    <div class="px-4 py-3 text-center">
      <p class="text-2xl font-bold text-gray-900">{removedFields.length}</p>
      <p class="mt-0.5 text-xs text-gray-500">Removed</p>
    </div>
    <div class="px-4 py-3 text-center">
      <p class="text-2xl font-bold text-gray-900">{groups.length}</p>
      <p class="mt-0.5 text-xs text-gray-500">Categories</p>
    </div>
    <div class="px-4 py-3 text-center">
      <p class="text-2xl font-bold {sensitiveCount > 0 ? 'text-red-600' : 'text-gray-400'}">
        {sensitiveCount > 0 ? sensitiveCount : '—'}
      </p>
      <p class="mt-0.5 text-xs text-gray-500">Sensitive</p>
    </div>
    <div class="px-4 py-3 text-center">
      <p class="text-2xl font-bold {savedPct > 0 ? 'text-green-600' : 'text-gray-400'}">
        {savedPct > 0 ? `−${savedPct}%` : '—'}
      </p>
      <p class="mt-0.5 text-xs text-gray-500">Size saved</p>
    </div>
  </div>

  <!-- Field groups (removed) -->
  {#if removedFields.length === 0}
    <div class="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
           stroke-width="1.5" stroke="currentColor" class="h-8 w-8 text-gray-300" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      <p class="text-sm text-gray-500">No metadata found — this file was already clean.</p>
    </div>
  {:else}
    <div class="divide-y divide-gray-100">
      {#each groups as group (group.id)}
        <details class="group/details" open={CATEGORY_META[group.id].startOpen}>
          <summary
            class="flex cursor-pointer list-none items-center justify-between px-5 py-3
                   transition-colors hover:bg-gray-50"
          >
            <div class="flex items-center gap-2">
              <span class="rounded-md px-2 py-0.5 text-xs font-semibold {CATEGORY_COLORS[group.id]}">
                {group.label}
              </span>
              {#if group.sensitive}
                <span class="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
                  sensitive
                </span>
              {/if}
              <span class="text-sm text-gray-500">
                {group.removed.length} field{group.removed.length === 1 ? '' : 's'}
              </span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke-width="2" stroke="currentColor"
                 class="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open/details:rotate-180"
                 aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>

          <div class="px-5 pb-4 pt-1">
            <dl class="space-y-1">
              {#each group.removed as field (field.key)}
                <div class="flex items-baseline justify-between gap-3 text-sm">
                  <dt class="shrink-0 text-gray-500">{field.label}</dt>
                  <dd class="min-w-0 truncate text-right font-mono text-xs text-red-500 line-through
                             decoration-red-400">
                    {field.value || '—'}
                  </dd>
                </div>
              {/each}
            </dl>
          </div>
        </details>
      {/each}
    </div>

    <!-- Retained fields -->
    {#if retainedFields.length > 0}
      <details class="border-t border-gray-100">
        <summary
          class="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-gray-400
                 transition-colors hover:bg-gray-50"
        >
          <span class="text-sm">Retained ({retainedFields.length})</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               stroke-width="2" stroke="currentColor"
               class="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div class="px-5 pb-4 pt-1">
          <dl class="space-y-1">
            {#each retainedFields as field (field.key)}
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <dt class="shrink-0 text-gray-400">{field.label}</dt>
                <dd class="min-w-0 truncate text-right font-mono text-xs text-gray-400">
                  {field.value || '—'}
                </dd>
              </div>
            {/each}
          </dl>
        </div>
      </details>
    {/if}
  {/if}
</div>
