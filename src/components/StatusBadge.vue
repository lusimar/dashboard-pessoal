<script setup lang="ts">
defineProps<{
  label: string
  variant: 'success' | 'warning' | 'urgent' | 'info' | 'neutral'
}>()

const variantClasses = {
  success: 'bg-teal/10 text-teal border-teal/30',
  warning: 'bg-gold/10 text-gold border-gold/30',
  urgent: 'bg-sandy/10 text-sandy border-sandy/30',
  info: 'bg-slate/20 text-slate-light border-slate/40',
  neutral: 'bg-white/5 text-gray-400 border-white/10',
}
</script>

<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap"
    :class="variantClasses[variant]"
  >
    {{ label }}
  </span>
</template>
