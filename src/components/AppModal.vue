<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    size?: 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{ close: [] }>()

const sizeClass = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
        @click.self="emit('close')"
      >
        <div
          class="w-full bg-carbon-light border border-white/10 rounded-xl shadow-2xl my-auto"
          :class="sizeClass[props.size]"
        >
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 class="font-semibold text-white">{{ props.title }}</h2>
            <button class="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5" @click="emit('close')">
              <X :size="18" />
            </button>
          </div>
          <div class="px-6 py-5">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
