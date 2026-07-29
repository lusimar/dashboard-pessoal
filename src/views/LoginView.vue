<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Hexagon, Lock, Mail, LoaderCircle } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

const { signIn } = useAuth()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch (e: any) {
    error.value =
      e?.message === 'Invalid login credentials'
        ? 'Credenciais inválidas. Verifique e-mail e senha.'
        : e?.message ?? 'Erro ao entrar. Tente novamente.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Marca -->
      <div class="flex flex-col items-center mb-8">
        <div class="p-4 rounded-2xl bg-teal/10 mb-4">
          <Hexagon :size="32" class="text-teal" />
        </div>
        <h1 class="text-2xl font-bold text-white">Management OS</h1>
        <p class="text-sm text-gray-500 mt-1">Seu workspace pessoal de gestão</p>
      </div>

      <form class="card space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="label" for="email">E-mail</label>
          <div class="relative">
            <Mail :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="input !pl-9"
              placeholder="voce@exemplo.com"
            />
          </div>
        </div>

        <div>
          <label class="label" for="password">Senha</label>
          <div class="relative">
            <Lock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="input !pl-9"
              placeholder="••••••••"
            />
          </div>
        </div>

        <p v-if="error" class="text-sm text-sandy bg-sandy/10 border border-sandy/30 rounded-lg px-3 py-2">
          {{ error }}
        </p>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          <LoaderCircle v-if="loading" :size="16" class="animate-spin" />
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <p class="text-center text-xs text-gray-600 mt-6">
        Acesso restrito. Usuários são cadastrados manualmente via Supabase.
      </p>
    </div>
  </div>
</template>
