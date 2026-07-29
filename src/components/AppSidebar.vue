<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard,
  Building2,
  FileText,
  Wallet,
  GraduationCap,
  CheckSquare,
  Rocket,
  CreditCard,
  StickyNote,
  Briefcase,
  Bell,
  LogOut,
  Menu,
  X,
  Hexagon,
  Eye,
  EyeOff,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { usePrivacy } from '../composables/usePrivacy'

const { user, signOut } = useAuth()
const { valuesHidden, toggleValuesHidden } = usePrivacy()
const router = useRouter()
const mobileOpen = ref(false)

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'text-teal' },
  { to: '/companies', label: 'Empresas', icon: Building2, color: 'text-slate-light' },
  { to: '/notes', label: 'Anotações', icon: StickyNote, color: 'text-gold' },
  { to: '/jobs', label: 'Candidaturas', icon: Briefcase, color: 'text-slate-light' },
  { to: '/documents', label: 'Documentos', icon: FileText, color: 'text-gold' },
  { to: '/projects', label: 'Projetos', icon: Rocket, color: 'text-teal' },
  { to: '/finances', label: 'Finanças', icon: Wallet, color: 'text-sandy' },
  { to: '/cards', label: 'Cartões', icon: CreditCard, color: 'text-teal' },
  { to: '/college', label: 'Faculdade', icon: GraduationCap, color: 'text-teal-light' },
  { to: '/tasks', label: 'Tarefas', icon: CheckSquare, color: 'text-gold-light' },
  { to: '/reminders', label: 'Lembretes', icon: Bell, color: 'text-sandy' },
]

async function handleSignOut() {
  await signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <!-- Botão mobile -->
  <button
    class="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-carbon-light border border-white/10 text-gray-300"
    @click="mobileOpen = !mobileOpen"
  >
    <X v-if="mobileOpen" :size="20" />
    <Menu v-else :size="20" />
  </button>

  <!-- Overlay mobile -->
  <div
    v-if="mobileOpen"
    class="lg:hidden fixed inset-0 z-30 bg-black/60"
    @click="mobileOpen = false"
  />

  <aside
    class="fixed inset-y-0 left-0 z-40 w-64 bg-carbon border-r border-white/5 flex flex-col transition-transform duration-200 lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <!-- Logo -->
    <div class="flex items-center gap-3 px-6 h-20 border-b border-white/5">
      <div class="p-2 rounded-lg bg-teal/10">
        <Hexagon :size="22" class="text-teal" />
      </div>
      <div>
        <p class="font-bold text-white leading-tight">Control Desk</p>
        <p class="text-[11px] text-gray-500 uppercase tracking-widest">PERSONAL HUB</p>
      </div>
    </div>

    <!-- Navegação -->
    <nav class="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="group flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        exact-active-class="!bg-teal/10 !text-teal"
        @click="mobileOpen = false"
      >
        <component :is="link.icon" :size="18" :class="link.color" />
        {{ link.label }}
      </router-link>
    </nav>

    <!-- Usuário -->
    <div class="px-4 py-4 border-t border-white/5 space-y-2">
      <button
        type="button"
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        :title="valuesHidden ? 'Revelar valores' : 'Esconder valores'"
        @click="toggleValuesHidden"
      >
        <EyeOff v-if="valuesHidden" :size="18" class="text-sandy" />
        <Eye v-else :size="18" class="text-teal" />
        {{ valuesHidden ? 'Revelar valores' : 'Esconder valores' }}
      </button>
      <div class="flex items-center justify-between gap-2 px-1">
        <div class="min-w-0">
          <p class="text-xs text-gray-500">Conectado como</p>
          <p class="text-sm text-gray-300 truncate">{{ user?.email }}</p>
        </div>
        <button
          class="p-2 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10 transition-colors"
          title="Sair"
          @click="handleSignOut"
        >
          <LogOut :size="18" />
        </button>
      </div>
    </div>
  </aside>
</template>
