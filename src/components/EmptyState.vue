<script setup lang="ts">
import type { FunctionalComponent } from 'vue'

defineProps<{
  icon: FunctionalComponent
  message: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="p-4 rounded-full bg-white/5 mb-4">
      <component :is="icon" :size="28" class="text-gray-500" />
    </div>
    <p class="text-sm text-gray-500">{{ message }}</p>
  </div>
</template>
