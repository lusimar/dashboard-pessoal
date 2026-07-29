<script setup lang="ts">
import type { FunctionalComponent } from 'vue'

defineProps<{
  label: string
  value: string
  icon: FunctionalComponent
  accent: 'teal' | 'gold' | 'sandy' | 'slate'
}>()

const accentClasses = {
  teal: 'bg-teal/10 text-teal',
  gold: 'bg-gold/10 text-gold',
  sandy: 'bg-sandy/10 text-sandy',
  slate: 'bg-slate/20 text-slate-light',
}
</script>

<template>
  <div class="card flex items-center gap-4">
    <div class="p-3 rounded-lg shrink-0" :class="accentClasses[accent]">
      <component :is="icon" :size="22" />
    </div>
    <div class="min-w-0">
      <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ label }}</p>
      <p class="text-xl font-bold text-white truncate">{{ value }}</p>
    </div>
  </div>
</template>
