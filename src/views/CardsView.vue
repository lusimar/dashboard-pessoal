<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CreditCard, Plus, ChevronLeft, ChevronRight, LayoutGrid, WalletCards } from 'lucide-vue-next'
import { useCards } from '../composables/useCards'
import { formatCurrency } from '../composables/useFormat'
import type { BankCard, BankCardType, CardStatementStatus } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import CardDetailWorkspace from '../components/CardDetailWorkspace.vue'

const {
  cards,
  loading,
  viewYear,
  viewMonth,
  viewLabel,
  prevMonth,
  nextMonth,
  fetchCards,
  statementFor,
  historyFor,
  upsertStatement,
  saveCard,
  removeCard,
} = useCards()

const selectedId = ref<string | null>(null)
const selected = computed(() => cards.value.find((c) => c.id === selectedId.value) ?? null)

const modalOpen = ref(false)
const editing = ref<BankCard | null>(null)
const saving = ref(false)

const form = ref({
  name: '',
  bank: '',
  type: 'Credit' as BankCardType,
  due_day: '' as string | number,
  closing_day: '' as string | number,
})

const totalPending = computed(() =>
  cards.value.reduce((sum, card) => {
    const st = statementFor(card)
    if (!st || st.status !== 'Pending') return sum
    return sum + Number(st.amount)
  }, 0),
)

onMounted(fetchCards)

function openWorkspace(card: BankCard) {
  selectedId.value = card.id
}

function openCreate() {
  editing.value = null
  form.value = { name: '', bank: '', type: 'Credit', due_day: '', closing_day: '' }
  modalOpen.value = true
}

function openEdit(card: BankCard) {
  editing.value = card
  form.value = {
    name: card.name,
    bank: card.bank ?? '',
    type: card.type,
    due_day: card.due_day,
    closing_day: card.closing_day ?? '',
  }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  await saveCard(
    {
      name: form.value.name,
      bank: form.value.bank || null,
      type: form.value.type,
      due_day: Number(form.value.due_day),
      closing_day: form.value.closing_day === '' ? null : Number(form.value.closing_day),
    },
    editing.value?.id,
  )
  saving.value = false
  modalOpen.value = false
}

async function handleRemove(card: BankCard) {
  if (!confirm(`Excluir o cartão "${card.name}"? Todo o histórico de faturas será removido.`)) return
  await removeCard(card)
  if (selectedId.value === card.id) selectedId.value = null
}

async function handleSaveStatement(payload: {
  amount: number
  status: CardStatementStatus
  due_date: string
}) {
  if (!selected.value) return
  await upsertStatement(selected.value, payload)
}
</script>

<template>
  <!-- Lista -->
  <template v-if="!selected">
    <PageHeader title="Cartões" subtitle="Faturas mensais historizadas por cartão">
      <template #actions>
        <button class="btn-primary" @click="openCreate">
          <Plus :size="16" /> Novo cartão
        </button>
      </template>
    </PageHeader>

    <!-- Seletor de mês -->
    <div class="flex items-center justify-between gap-4 mb-6 card border border-slate/30">
      <button class="btn-ghost !px-2" :title="'Mês anterior'" @click="prevMonth">
        <ChevronLeft :size="20" />
      </button>
      <div class="text-center">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Competência</p>
        <p class="text-lg font-bold text-white capitalize">{{ viewLabel }}</p>
      </div>
      <button class="btn-ghost !px-2" :title="'Próximo mês'" @click="nextMonth">
        <ChevronRight :size="20" />
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>

    <template v-else>
      <div
        v-if="cards.length > 0"
        class="card mb-6 flex items-center justify-between gap-4 border border-slate/30"
      >
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-lg bg-slate/20 text-slate-light">
            <WalletCards :size="22" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Faturas pendentes ({{ viewLabel }})
            </p>
            <p class="text-xl font-bold text-gold">{{ formatCurrency(totalPending) }}</p>
          </div>
        </div>
        <p class="text-sm text-gray-500">{{ cards.length }} cartão(ões)</p>
      </div>

      <EmptyState
        v-if="cards.length === 0"
        :icon="CreditCard"
        message="Nenhum cartão cadastrado. Adicione crédito ou débito para acompanhar as faturas."
      />

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <button
          v-for="card in cards"
          :key="card.id"
          class="card text-left border border-slate/30 hover:border-teal/40 transition-colors group"
          @click="openWorkspace(card)"
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2.5 rounded-lg bg-slate/20 shrink-0 group-hover:bg-teal/10 transition-colors">
              <CreditCard :size="18" class="text-slate-light group-hover:text-teal transition-colors" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-semibold text-white truncate">{{ card.name }}</h3>
              <p class="text-xs text-gray-500 truncate">{{ card.bank || 'Banco não informado' }}</p>
            </div>
            <LayoutGrid :size="16" class="text-gray-600 group-hover:text-teal transition-colors" />
          </div>

          <div class="flex flex-wrap items-center gap-2 mb-3">
            <StatusBadge
              :label="card.type === 'Credit' ? 'Crédito' : 'Débito'"
              :variant="card.type === 'Credit' ? 'info' : 'success'"
            />
            <span class="text-xs text-gold font-semibold">Vence dia {{ card.due_day }}</span>
          </div>

          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500">Fatura {{ viewLabel }}</span>
            <span class="text-gold font-semibold">
              {{ formatCurrency(statementFor(card)?.amount ?? 0) }}
            </span>
          </div>
          <div class="mt-2">
            <StatusBadge
              v-if="statementFor(card)"
              :label="statementFor(card)!.status === 'Paid' ? 'Paga' : 'Pendente'"
              :variant="statementFor(card)!.status === 'Paid' ? 'success' : 'warning'"
            />
            <span v-else class="text-xs text-gray-600">Sem fatura neste mês</span>
          </div>
        </button>
      </div>
    </template>
  </template>

  <!-- Workspace -->
  <CardDetailWorkspace
    v-else
    :card="selected"
    :view-year="viewYear"
    :view-month="viewMonth"
    :statement="statementFor(selected)"
    :history="historyFor(selected)"
    @back="selectedId = null"
    @edit="openEdit(selected)"
    @save-statement="handleSaveStatement"
  />

  <!-- Seletor de mês também no workspace -->
  <div
    v-if="selected"
    class="fixed bottom-6 right-6 flex items-center gap-2 card !p-2 border border-slate/40 shadow-xl z-20"
  >
    <button class="btn-ghost !px-2" @click="prevMonth"><ChevronLeft :size="18" /></button>
    <span class="text-sm font-semibold text-white capitalize px-2 min-w-[9rem] text-center">{{ viewLabel }}</span>
    <button class="btn-ghost !px-2" @click="nextMonth"><ChevronRight :size="18" /></button>
  </div>

  <AppModal :open="modalOpen" :title="editing ? 'Editar cartão' : 'Novo cartão'" @close="modalOpen = false">
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label">Nome do cartão *</label>
        <input v-model="form.name" required class="input" placeholder="Ex.: Mercado Pago, Inter" />
      </div>
      <div>
        <label class="label">Banco</label>
        <input v-model="form.bank" class="input" placeholder="Ex.: Nubank, Inter, Itaú" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Tipo *</label>
          <select v-model="form.type" class="input">
            <option value="Credit">Crédito</option>
            <option value="Debit">Débito</option>
          </select>
        </div>
        <div>
          <label class="label">Dia do vencimento *</label>
          <input v-model="form.due_day" type="number" min="1" max="31" required class="input" placeholder="Ex.: 10" />
        </div>
      </div>
      <div>
        <label class="label">Dia do fechamento</label>
        <input v-model="form.closing_day" type="number" min="1" max="31" class="input" placeholder="Ex.: 3 (opcional)" />
      </div>
      <div v-if="editing" class="flex justify-between gap-2 pt-2">
        <button type="button" class="btn-ghost !text-sandy hover:!bg-sandy/10" @click="handleRemove(editing); modalOpen = false">
          Excluir cartão
        </button>
        <div class="flex gap-2">
          <button type="button" class="btn-ghost" @click="modalOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
        </div>
      </div>
      <div v-else class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="modalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
      </div>
    </form>
  </AppModal>
</template>
