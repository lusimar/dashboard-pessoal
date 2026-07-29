<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowLeft,
  CreditCard,
  LayoutGrid,
  ScrollText,
  Pencil,
  CheckCircle2,
  Circle,
} from 'lucide-vue-next'
import { formatCurrency, formatDate } from '../composables/useFormat'
import { periodLabel, statementDueDate } from '../composables/useCards'
import type { BankCard, CardStatement, CardStatementStatus } from '../types'
import StatusBadge from './StatusBadge.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps<{
  card: BankCard
  viewYear: number
  viewMonth: number
  statement: CardStatement | undefined
  history: CardStatement[]
}>()

const emit = defineEmits<{
  back: []
  edit: []
  saveStatement: [payload: { amount: number; status: CardStatementStatus; due_date: string }]
}>()

const activeTab = ref<'overview' | 'history'>('overview')

const amount = ref('')
const dueDate = ref('')
const status = ref<CardStatementStatus>('Pending')
const saving = ref(false)

watch(
  () => [props.card.id, props.viewYear, props.viewMonth, props.statement] as const,
  () => {
    amount.value = props.statement ? String(props.statement.amount) : ''
    status.value = props.statement?.status ?? 'Pending'
    dueDate.value =
      props.statement?.due_date ?? statementDueDate(props.card, props.viewYear, props.viewMonth)
  },
  { immediate: true },
)

const period = computed(() => periodLabel(props.viewYear, props.viewMonth))

async function save() {
  saving.value = true
  emit('saveStatement', {
    amount: amount.value === '' ? 0 : Number(amount.value),
    status: status.value,
    due_date: dueDate.value,
  })
}

watch(
  () => props.statement,
  () => {
    saving.value = false
  },
)

async function togglePaid() {
  status.value = status.value === 'Paid' ? 'Pending' : 'Paid'
  await save()
}

function historyLabel(st: CardStatement) {
  return periodLabel(st.year, st.month)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div class="flex items-center gap-3 min-w-0">
      <button class="btn-ghost !px-2" @click="emit('back')">
        <ArrowLeft :size="18" />
      </button>
      <div class="p-2.5 rounded-lg bg-teal/10 shrink-0">
        <CreditCard :size="20" class="text-teal" />
      </div>
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-white truncate">{{ card.name }}</h1>
        <p class="text-xs text-gray-500">{{ card.bank || 'Banco não informado' }} · {{ period }}</p>
      </div>
    </div>
    <button class="btn-ghost" @click="emit('edit')"><Pencil :size="15" /> Editar cartão</button>
  </div>

  <div class="flex gap-1 p-1 bg-carbon-light rounded-lg border border-white/5 w-fit mb-6">
    <button
      v-for="tab in [
        { key: 'overview', label: 'Visão geral', icon: LayoutGrid },
        { key: 'history', label: 'Histórico de faturas', icon: ScrollText },
      ]"
      :key="tab.key"
      class="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
      :class="activeTab === tab.key ? 'bg-teal text-carbon' : 'text-gray-400 hover:text-white'"
      @click="activeTab = tab.key as typeof activeTab"
    >
      <component :is="tab.icon" :size="15" />
      {{ tab.label }}
    </button>
  </div>

  <!-- Visão geral -->
  <div v-if="activeTab === 'overview'" class="space-y-6">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card border border-slate/30">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Valor da fatura</p>
        <p class="text-xl font-bold text-gold mt-1">{{ formatCurrency(Number(amount) || 0) }}</p>
      </div>
      <div class="card border border-slate/30">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Vencimento</p>
        <p class="text-xl font-bold text-white mt-1">{{ formatDate(dueDate) }}</p>
      </div>
      <div class="card border border-slate/30">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</p>
        <div class="mt-2">
          <StatusBadge
            :label="status === 'Paid' ? 'Paga' : 'Pendente'"
            :variant="status === 'Paid' ? 'success' : 'warning'"
          />
        </div>
      </div>
    </div>

    <section class="card border border-slate/30 space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <StatusBadge
          :label="card.type === 'Credit' ? 'Crédito' : 'Débito'"
          :variant="card.type === 'Credit' ? 'info' : 'success'"
        />
        <span class="text-xs text-gray-400">Fecha dia {{ card.closing_day ?? '—' }}</span>
        <span class="text-xs text-gold font-semibold">Vence dia {{ card.due_day }}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Valor da fatura ({{ period }})</label>
          <input v-model="amount" type="number" step="0.01" min="0" class="input" placeholder="0,00" />
        </div>
        <div>
          <label class="label">Data de vencimento</label>
          <input v-model="dueDate" type="date" class="input" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2 pt-2">
        <button type="button" class="btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Salvando...' : 'Salvar fatura do mês' }}
        </button>
        <button
          type="button"
          class="btn-secondary inline-flex items-center gap-2"
          :disabled="saving"
          @click="togglePaid"
        >
          <CheckCircle2 v-if="status !== 'Paid'" :size="15" />
          <Circle v-else :size="15" />
          {{ status === 'Paid' ? 'Marcar como pendente' : 'Marcar como paga' }}
        </button>
      </div>
      <p class="text-xs text-gray-500">
        Faturas pendentes entram automaticamente em Finanças → Saídas (a pagar), ordenadas pelo vencimento.
      </p>
    </section>
  </div>

  <!-- Histórico -->
  <div v-else>
    <EmptyState
      v-if="history.length === 0"
      :icon="ScrollText"
      message="Nenhuma fatura registrada ainda para este cartão."
    />
    <div v-else class="card !p-0 overflow-x-auto border border-slate/30">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-white/5">
            <th class="px-5 py-3.5 font-semibold">Período</th>
            <th class="px-5 py-3.5 font-semibold">Valor</th>
            <th class="px-5 py-3.5 font-semibold">Vencimento</th>
            <th class="px-5 py-3.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr
            v-for="st in history"
            :key="st.id"
            class="hover:bg-white/[0.02]"
            :class="{
              'bg-teal/5': st.year === viewYear && st.month === viewMonth,
            }"
          >
            <td class="px-5 py-3.5 text-gray-200 capitalize">{{ historyLabel(st) }}</td>
            <td class="px-5 py-3.5 font-semibold text-gold">{{ formatCurrency(st.amount) }}</td>
            <td class="px-5 py-3.5 text-gray-400">{{ formatDate(st.due_date) }}</td>
            <td class="px-5 py-3.5">
              <StatusBadge
                :label="st.status === 'Paid' ? 'Paga' : 'Pendente'"
                :variant="st.status === 'Paid' ? 'success' : 'warning'"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
