<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import { usePrivacy } from './composables/usePrivacy'

const route = useRoute()
const { valuesHidden } = usePrivacy()
const isPublic = computed(() => route.meta.public === true)
const isFullscreen = computed(() => route.meta.fullscreen === true)
</script>

<template>
  <div class="min-h-screen bg-carbon">
    <template v-if="isPublic">
      <router-view />
    </template>
    <template v-else>
      <div class="flex min-h-screen">
        <AppSidebar />
        <main class="flex-1 min-w-0 lg:pl-64">
          <div
            :key="valuesHidden ? 'values-hidden' : 'values-shown'"
            :class="
              isFullscreen
                ? 'w-full px-4 sm:px-6 lg:px-8 py-8'
                : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
            "
          >
            <router-view />
          </div>
        </main>
      </div>
    </template>
  </div>
</template>
