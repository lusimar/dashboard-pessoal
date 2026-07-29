<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  ExternalLink,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { useFinances, type FinanceMonthItem } from '../composables/useFinances'
import { statusOfMonthItem, type LedgerCategory } from '../composables/useFinanceMonth'
import { formatCurrency, formatDate } from '../composables/useFormat'
import type { Finance, FinanceCategory } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const { user } = useAuth()
const {
  finances,
  companies,
  loading,
  viewLabel,
  prevMonth,
  nextMonth,
  fetchData,
  monthItems,
  kpis,
} = useFinances()

const saving = ref(false)
const modalOpen = ref(false)
const editing = ref<Finance | null>(null)
const filter = ref<'all' | 'pending' | 'paid'>('all')

const categories: FinanceCategory[] = [
  'Fixed Expense',
  'Subscription',
  'Freelance Income',
  'Personal Income',
  'Other',
]

const categoryLabel: Record<LedgerCategory, string> = {
  'Fixed Expense': 'Despesa fixa',
  Subscription: 'Assinatura',
  'Freelance Income': 'Renda freelance',
  'Personal Income': 'Renda pessoal',
  Other: 'Outro',
  'Card Invoice': 'Fatura de Cartão',
}

const incomeCategories: FinanceCategory[] = ['Freelance Income', 'Personal Income']

const categoryColor: Record<LedgerCategory, string> = {
  'Fixed Expense': 'bg-sandy',
  Subscription: 'bg-slate-light',
  'Freelance Income': 'bg-teal',
  'Personal Income': 'bg-teal-light',
  Other: 'bg-gold',
  'Card Invoice': 'bg-slate',
}

const paymentMethods = ['Inter', 'Nubank', 'PicPay', 'Boleto', 'Pix', 'Cartão de crédito', 'Outro']

const form = ref({
  description: '',
  amount: '' as string | number,
  due_date: '',
  payment_date: '',
  category: 'Fixed Expense' as FinanceCategory,
  company_id: '',
  url: '',
  payment_method: '',
  status: 'Active' as 'Active' | 'Cancelled',
})

const filtered = computed(() => {
  if (filter.value === 'pending') return monthItems.value.filter((f) => !f.paidThisMonth)
  if (filter.value === 'paid') return monthItems.value.filter((f) => f.paidThisMonth)
  return monthItems.value
})

function openCreate() {
  editing.value = null
  form.value = {
    description: '',
    amount: '',
    due_date: '',
    payment_date: '',
    category: 'Fixed Expense',
    company_id: '',
    url: '',
    payment_method: '',
    status: 'Active',
  }
  modalOpen.value = true
}

function openEdit(item: FinanceMonthItem) {
  if (!item.dbId) return
  const finance = finances.value.find((f) => f.id === item.dbId)
  if (!finance) return
  editing.value = finance
  form.value = {
    description: finance.description,
    amount: finance.amount,
    due_date: finance.due_date,
    payment_date: finance.payment_date ?? '',
    category: finance.category,
    company_id: finance.company_id ?? '',
    url: finance.url ?? '',
    payment_method: finance.payment_method ?? '',
    status: finance.status ?? 'Active',
  }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  const payload = {
    description: form.value.description,
    amount: Number(form.value.amount),
    due_date: form.value.due_date,
    payment_date: form.value.payment_date || null,
    category: form.value.category,
    company_id: form.value.company_id || null,
    url: form.value.url || null,
    payment_method: form.value.payment_method || null,
    status: form.value.status,
  }
  if (editing.value) {
    await supabase.from('finances').update(payload).eq('id', editing.value.id)
  } else {
    await supabase.from('finances').insert({ ...payload, user_id: user.value!.id })
  }
  saving.value = false
  modalOpen.value = false
  await fetchData()
}

async function markPaid(item: FinanceMonthItem) {
  const today = new Date().toISOString().slice(0, 10)

  if (item.source === 'card') {
    const statementId = item.id.replace(/^card:/, '')
    await supabase.from('card_statements').update({ status: 'Paid' }).eq('id', statementId)
    await fetchData()
    return
  }

  if (item.dbId) {
    await supabase
      .from('finances')
      .update({ payment_date: today, due_date: item.due_date })
      .eq('id', item.dbId)
  } else {
    await supabase.from('finances').insert({
      description: item.description,
      amount: item.amount,
      due_date: item.due_date,
      payment_date: today,
      category: item.category === 'Card Invoice' ? 'Other' : item.category,
      company_id: item.company_id,
      url: item.url,
      status: 'Active',
      user_id: user.value!.id,
    })
  }
  await fetchData()
}

async function remove(item: FinanceMonthItem) {
  if (!item.dbId || !item.canDelete) return
  if (!confirm(`Excluir "${item.description}"?`)) return
  await supabase.from('finances').delete().eq('id', item.dbId)
  await fetchData()
}
</script>

<template>
  <PageHeader title="Finanças" subtitle="Escopo mensal estrito · vencimentos mais próximos primeiro">
    <template #actions>
      <button class="btn-primary" @click="openCreate">
        <Plus :size="16" /> Novo lançamento
      </button>
    </template>
  </PageHeader>

  <!-- Seletor de mês -->
  <div class="flex items-center justify-between gap-4 mb-6 card border border-slate/30">
    <button class="btn-ghost !px-2" title="Mês anterior" @click="prevMonth">
      <ChevronLeft :size="20" />
    </button>
    <div class="text-center">
      <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Competência</p>
      <p class="text-lg font-bold text-white capitalize">{{ viewLabel }}</p>
    </div>
    <button class="btn-ghost !px-2" title="Próximo mês" @click="nextMonth">
      <ChevronRight :size="20" />
    </button>
  </div>

  <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>

  <template v-else>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Recebidos"
        :value="formatCurrency(kpis.recebidos)"
        :icon="CircleDollarSign"
        accent="teal"
      />
      <StatCard
        label="Entradas (a receber)"
        :value="formatCurrency(kpis.entradasAReceber)"
        :icon="TrendingUp"
        accent="slate"
      />
      <StatCard
        label="Saídas (a pagar)"
        :value="formatCurrency(kpis.saidasAPagar)"
        :icon="TrendingDown"
        accent="sandy"
      />
      <StatCard
        label="Saldo previsto"
        :value="formatCurrency(kpis.saldoPrevisto)"
        :icon="Wallet"
        accent="gold"
      />
    </div>

    <p class="text-xs text-gray-500 mb-4">
      Recebidos = entradas já pagas no mês.
      Entradas (a receber) = apenas pendentes.
      Saldo previsto =
      (receitas pagas + pendentes) − (despesas pagas + pendentes + faturas de cartão).
      Itens de agosto só aparecem na competência agosto. Vencidos no mês ficam como
      <span class="text-sandy">Atrasado / Pendente</span>.
    </p>

    <div class="flex gap-2 mb-6">
      <button
        v-for="option in [
          { key: 'all', label: 'Todos' },
          { key: 'pending', label: 'Pendentes' },
          { key: 'paid', label: 'Pagos neste mês' },
        ]"
        :key="option.key"
        class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
        :class="
          filter === option.key
            ? 'bg-teal/10 text-teal border-teal/30'
            : 'text-gray-400 border-white/10 hover:border-white/25'
        "
        @click="filter = option.key as typeof filter"
      >
        {{ option.label }}
      </button>
    </div>

    <EmptyState v-if="filtered.length === 0" :icon="Wallet" message="Nenhum lançamento nesta competência." />

    <div v-else class="card !p-0 overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-white/5">
            <th class="px-5 py-3.5 font-semibold">Descrição</th>
            <th class="px-5 py-3.5 font-semibold">Categoria</th>
            <th class="px-5 py-3.5 font-semibold">Valor</th>
            <th class="px-5 py-3.5 font-semibold">Vencimento</th>
            <th class="px-5 py-3.5 font-semibold">Status</th>
            <th class="px-5 py-3.5 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr v-for="item in filtered" :key="item.id" class="hover:bg-white/[0.02]">
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-2 flex-wrap">
                <a
                  v-if="item.url"
                  :href="item.url"
                  target="_blank"
                  rel="noopener"
                  class="text-gray-200 hover:text-teal inline-flex items-center gap-1.5"
                >
                  {{ item.description }} <ExternalLink :size="13" class="text-gray-500" />
                </a>
                <span v-else class="text-gray-200">{{ item.description }}</span>
                <span
                  v-if="item.source === 'company' || item.source === 'addendum'"
                  class="text-[10px] font-semibold uppercase tracking-wider text-teal border border-teal/40 rounded px-1.5 py-0.5"
                >
                  Auto
                </span>
                <span
                  v-if="item.source === 'card'"
                  class="text-[10px] font-semibold uppercase tracking-wider text-slate-light border border-slate/40 rounded px-1.5 py-0.5"
                >
                  Cartão
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span v-if="item.companies?.name">{{ item.companies.name }}</span>
                <span v-if="item.payment_method" class="inline-flex items-center gap-1">
                  <CreditCard :size="12" class="text-slate-light" /> {{ item.payment_method }}
                </span>
              </p>
            </td>
            <td class="px-5 py-3.5">
              <span class="inline-flex items-center gap-2 text-gray-300">
                <span class="w-2 h-2 rounded-full" :class="categoryColor[item.category]" />
                {{ categoryLabel[item.category] }}
              </span>
            </td>
            <td
              class="px-5 py-3.5 font-semibold whitespace-nowrap"
              :class="item.isIncome ? 'text-teal' : 'text-sandy'"
            >
              {{ item.isIncome ? '+' : '−' }} {{ formatCurrency(item.amount) }}
            </td>
            <td class="px-5 py-3.5 text-gray-400">{{ formatDate(item.due_date) }}</td>
            <td class="px-5 py-3.5">
              <StatusBadge
                :label="
                  item.paidThisMonth && item.payment_date
                    ? `Pago em ${formatDate(item.payment_date)}`
                    : statusOfMonthItem(item).label
                "
                :variant="statusOfMonthItem(item).variant"
              />
            </td>
            <td class="px-5 py-3.5">
              <div class="flex justify-end gap-1">
                <button
                  v-if="!item.paidThisMonth"
                  class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10"
                  title="Marcar como pago neste mês"
                  @click="markPaid(item)"
                >
                  <CheckCircle2 :size="15" />
                </button>
                <button
                  v-if="item.canEdit"
                  class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10"
                  @click="openEdit(item)"
                >
                  <Pencil :size="15" />
                </button>
                <button
                  v-if="item.canDelete"
                  class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10"
                  @click="remove(item)"
                >
                  <Trash2 :size="15" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>

  <AppModal :open="modalOpen" :title="editing ? 'Editar lançamento' : 'Novo lançamento'" @close="modalOpen = false">
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label">Descrição *</label>
        <input v-model="form.description" required class="input" placeholder="Ex.: Aluguel, Spotify, Salário..." />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Valor (R$) *</label>
          <input v-model="form.amount" type="number" step="0.01" min="0" required class="input" placeholder="0,00" />
        </div>
        <div>
          <label class="label">Categoria *</label>
          <select v-model="form.category" class="input">
            <option v-for="category in categories" :key="category" :value="category">
              {{ categoryLabel[category] }}
            </option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Vencimento *</label>
          <input v-model="form.due_date" type="date" required class="input" />
          <p
            v-if="incomeCategories.includes(form.category) || form.category === 'Subscription' || form.category === 'Fixed Expense'"
            class="text-xs text-gray-500 mt-1"
          >
            O dia do mês se repete em cada competência enquanto o status estiver Ativo.
          </p>
        </div>
        <div>
          <label class="label">Data de pagamento</label>
          <input v-model="form.payment_date" type="date" class="input" />
        </div>
      </div>
      <div>
        <label class="label">Empresa</label>
        <select v-model="form.company_id" class="input">
          <option value="">Nenhuma</option>
          <option v-for="company in companies" :key="company.id" :value="company.id">{{ company.name }}</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Forma de pagamento / banco</label>
          <input
            v-model="form.payment_method"
            list="payment-methods"
            class="input"
            placeholder="Ex.: Inter, Nubank, PicPay"
          />
          <datalist id="payment-methods">
            <option v-for="method in paymentMethods" :key="method" :value="method" />
          </datalist>
        </div>
        <div>
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="Active">Ativo</option>
            <option value="Cancelled">Cancelado</option>
          </select>
        </div>
      </div>
      <div>
        <label class="label">URL do serviço / app</label>
        <input v-model="form.url" type="url" class="input" placeholder="https://..." />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="modalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
