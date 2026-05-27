<script lang="ts">
  interface Props {
    value: number;
    max?: number;
    class?: string;
  }

  const { value, max = 100, class: className = '' }: Props = $props();

  const pct = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
</script>

<div
  role="progressbar"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
  class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 {className}"
>
  <div
    class="h-full rounded-full bg-brand-500 transition-all duration-200"
    style="width: {pct}%"
  ></div>
</div>
