<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Wallet,
  TrendingUp,
  CheckSquare,
  Bell,
  CalendarClock,
  GraduationCap,
  Rocket,
  ListTodo,
  BellRing,
  BellOff,
} from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { usePushNotifications } from '../composables/usePushNotifications'
import { useDashboardContext } from '../composables/useDashboardContext'
import {
  buildFinanceMonthLedger,
  computeFinanceKpis,
  startOfToday,
} from '../composables/useFinanceMonth'
import { formatCurrency, formatDate, formatDateTime, isOverdue } from '../composables/useFormat'
import type { BankCard, CardStatement, CollegeSubject, Company, Finance, LiveProject, Task } from '../types'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const { user } = useAuth()

function displayName() {
  const meta = user.value?.user_metadata?.full_name as string | undefined
  if (meta?.trim()) return meta.trim().split(/\s+/)[0]
  const local = user.value?.email?.split('@')[0] ?? 'Dev'
  const token = local.split(/[._0-9-]/)[0] || local
  return token.charAt(0).toUpperCase() + token.slice(1)
}

const { greeting, clockText, dateText, weatherText, quote } = useDashboardContext(displayName)
const {
  isEnabled,
  canEnable,
  loading: pushLoading,
  error: pushError,
  enableNotifications,
  disableNotifications,
} = usePushNotifications()

const loading = ref(true)
const finances = ref<Finance[]>([])
const companies = ref<Company[]>([])
const bankCards = ref<BankCard[]>([])
const tasks = ref<Task[]>([])
const subjects = ref<CollegeSubject[]>([])
const projects = ref<LiveProject[]>([])

onMounted(async () => {
  const [financesRes, companiesRes, cardsRes, tasksRes, subjectsRes, projectsRes] = await Promise.all([
    supabase.from('finances').select('*, companies(name)').order('due_date'),
    supabase.from('companies').select('*, contract_addendums(*)').order('name'),
    supabase.from('bank_cards').select('*, card_statements(*)').order('name'),
    supabase
      .from('tasks')
      .select('*, companies(name), college_subjects(name)')
      .neq('status', 'Completed')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('college_subjects').select('*').order('start_date', { ascending: false, nullsFirst: false }).limit(5),
    supabase.from('live_projects').select('*, companies(name)').order('created_at', { ascending: false }).limit(5),
  ])
  finances.value = (financesRes.data as Finance[]) ?? []
  companies.value = (companiesRes.data as Company[]) ?? []
  bankCards.value = (cardsRes.data as BankCard[]) ?? []
  tasks.value = (tasksRes.data as Task[]) ?? []
  subjects.value = (subjectsRes.data as CollegeSubject[]) ?? []
  projects.value = (projectsRes.data as LiveProject[]) ?? []
  loading.value = false
})

const today = startOfToday()
const viewYear = today.getFullYear()
const viewMonthIndex = today.getMonth()

const cardStatements = computed(() => {
  const month = viewMonthIndex + 1
  const result: Array<CardStatement & { card: BankCard }> = []
  for (const card of bankCards.value) {
    const st = (card.card_statements ?? []).find((s) => s.year === viewYear && s.month === month)
    if (st && Number(st.amount) > 0) result.push({ ...st, card })
  }
  return result
})

const monthItems = computed(() =>
  buildFinanceMonthLedger(
    finances.value,
    companies.value,
    viewYear,
    viewMonthIndex,
    cardStatements.value,
    today,
  ),
)

const kpis = computed(() => computeFinanceKpis(monthItems.value))

const openTasks = computed(() => tasks.value.filter((t) => t.category !== 'Lembrete'))
const reminders = computed(() => tasks.value.filter((t) => t.category === 'Lembrete'))

const tasksCardValue = computed(() =>
  openTasks.value.length === 0 ? 'Tudo limpo! ✨' : String(openTasks.value.length),
)

const remindersCardValue = computed(() => {
  const n = reminders.value.length
  if (n === 0) return 'Nenhum pendente'
  return `${n} pendente${n > 1 ? 's' : ''}`
})

const upcomingFinances = computed(() =>
  monthItems.value
    .filter((i) => !i.paidThisMonth)
    .slice(0, 6),
)

const upcomingTasks = computed(() => openTasks.value.slice(0, 5))
const upcomingReminders = computed(() => reminders.value.slice(0, 4))

const categoryVariant: Record<Task['category'], 'info' | 'warning' | 'urgent' | 'neutral'> = {
  Personal: 'neutral',
  College: 'info',
  Job: 'warning',
  Freelance: 'urgent',
  Lembrete: 'warning',
}

const categoryLabel: Record<Task['category'], string> = {
  Personal: 'Pessoal',
  College: 'Faculdade',
  Job: 'Trabalho',
  Freelance: 'Freelance',
  Lembrete: 'Lembrete',
}
</script>

<template>
  <!-- Header dinâmico -->
  <section class="card mb-8 border border-white/5 overflow-hidden relative">
    <div class="absolute inset-0 bg-gradient-to-br from-teal/5 via-transparent to-slate/10 pointer-events-none" />
    <div class="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {{ greeting }} <span class="inline-block">👋</span>
        </h1>
        <p class="text-sm text-gray-400 mt-1 capitalize">{{ dateText }}</p>
        <p v-if="quote" class="mt-4 text-sm text-gray-300 max-w-xl leading-relaxed border-l-2 border-teal/40 pl-3">
          <span class="text-teal mr-1">💬</span>“{{ quote }}”
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end shrink-0">
        <div class="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-200">
          {{ weatherText }}
        </div>
        <div class="inline-flex items-center gap-2 rounded-lg bg-carbon border border-white/10 px-3 py-2 font-mono text-sm text-teal tabular-nums">
          🕒 {{ clockText }}
        </div>
        <button
          v-if="canEnable"
          type="button"
          class="btn-secondary !py-2"
          :disabled="pushLoading"
          @click="isEnabled ? disableNotifications() : enableNotifications()"
        >
          <BellOff v-if="isEnabled" :size="16" />
          <BellRing v-else :size="16" />
          {{ pushLoading ? 'Aguarde...' : isEnabled ? 'Desativar alertas' : 'Ativar notificações' }}
        </button>
        <p v-if="pushError" class="text-xs text-sandy max-w-[220px] text-right">{{ pushError }}</p>
        <p v-else-if="isEnabled" class="text-[11px] text-teal max-w-[220px] text-right">
          Alertas 24h e 1h antes de tarefas/lembretes.
        </p>
      </div>
    </div>
  </section>

  <div v-if="loading" class="text-sm text-gray-500">Carregando workspace...</div>

  <template v-else>
    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      <StatCard
        label="A receber"
        :value="formatCurrency(kpis.entradasAReceber)"
        :icon="TrendingUp"
        accent="teal"
      />
      <StatCard
        label="A pagar"
        :value="formatCurrency(kpis.saidasAPagar)"
        :icon="Wallet"
        accent="gold"
      />
      <StatCard label="Tarefas" :value="tasksCardValue" :icon="CheckSquare" accent="slate" />
      <StatCard label="Lembretes" :value="remindersCardValue" :icon="Bell" accent="sandy" />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Próximos vencimentos -->
      <section class="card">
        <div class="flex items-center gap-2 mb-4">
          <CalendarClock :size="18" class="text-gold" />
          <h2 class="font-semibold text-white">Próximos vencimentos</h2>
        </div>
        <EmptyState
          v-if="upcomingFinances.length === 0"
          :icon="Wallet"
          message="Nenhum lançamento pendente neste mês."
        />
        <ul v-else class="divide-y divide-white/5">
          <li
            v-for="item in upcomingFinances"
            :key="item.id"
            class="py-3 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-sm text-gray-200 truncate">{{ item.description }}</p>
              <p
                class="text-xs mt-0.5"
                :class="item.isOverdue ? 'text-sandy' : 'text-gray-500'"
              >
                Vence em {{ formatDate(item.due_date) }}
                <span v-if="item.isOverdue"> · atrasado</span>
              </p>
            </div>
            <span
              class="text-sm font-semibold whitespace-nowrap"
              :class="item.isIncome ? 'text-teal' : 'text-gold'"
            >
              {{ item.isIncome ? '+' : '−' }} {{ formatCurrency(item.amount) }}
            </span>
          </li>
        </ul>
      </section>

      <!-- Faculdade & Projetos + lembretes rápidos -->
      <section class="card space-y-6">
        <div>
          <div class="flex items-center gap-2 mb-4">
            <GraduationCap :size="18" class="text-teal" />
            <h2 class="font-semibold text-white">Faculdade & projetos</h2>
          </div>

          <EmptyState
            v-if="subjects.length === 0 && projects.length === 0"
            :icon="Rocket"
            message="Nenhuma matéria ou projeto recente."
          />

          <ul v-else class="space-y-2">
            <li
              v-for="subject in subjects.slice(0, 3)"
              :key="subject.id"
              class="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5"
            >
              <GraduationCap :size="14" class="text-slate-light shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-sm text-gray-200 truncate">{{ subject.name }}</p>
                <p class="text-xs text-gray-500">
                  <template v-if="subject.start_date || subject.end_date">
                    {{ subject.start_date ? formatDate(subject.start_date) : '—' }}
                    →
                    {{ subject.end_date ? formatDate(subject.end_date) : '—' }}
                  </template>
                  <template v-else-if="subject.semester">Semestre {{ subject.semester }}</template>
                  <template v-else>Período não definido</template>
                </p>
              </div>
            </li>
            <li
              v-for="project in projects.slice(0, 3)"
              :key="project.id"
              class="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5"
            >
              <Rocket :size="14" class="text-teal shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-sm text-gray-200 truncate">{{ project.name }}</p>
                <p class="text-xs text-gray-500">
                  {{ project.companies?.name ?? 'Pessoal' }}
                  <span v-if="project.technology"> · {{ project.technology }}</span>
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div class="border-t border-white/5 pt-5">
          <div class="flex items-center gap-2 mb-3">
            <ListTodo :size="16" class="text-slate-light" />
            <h3 class="text-sm font-semibold text-white">Tarefas & lembretes</h3>
          </div>
          <EmptyState
            v-if="upcomingTasks.length === 0 && upcomingReminders.length === 0"
            :icon="CheckSquare"
            message="🎉 Tudo em dia!"
          />
          <ul v-else class="divide-y divide-white/5">
            <li
              v-for="task in [...upcomingReminders, ...upcomingTasks].slice(0, 5)"
              :key="task.id"
              class="py-2.5 flex items-center justify-between gap-3"
            >
              <div class="min-w-0">
                <p class="text-sm text-gray-200 truncate">{{ task.title }}</p>
                <p class="text-xs mt-0.5" :class="isOverdue(task.due_date) ? 'text-sandy' : 'text-gray-500'">
                  {{ task.due_date ? formatDateTime(task.due_date) : 'Sem prazo' }}
                </p>
              </div>
              <StatusBadge :label="categoryLabel[task.category]" :variant="categoryVariant[task.category]" />
            </li>
          </ul>
        </div>
      </section>
    </div>
  </template>
</template>
