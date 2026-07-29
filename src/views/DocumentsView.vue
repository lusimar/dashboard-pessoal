<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileText, Plus, Pencil, Trash2, ExternalLink, CheckCircle2 } from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { formatDate, isOverdue } from '../composables/useFormat'
import type { Company, Invoice, InvoiceType } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const { user } = useAuth()
const invoices = ref<Invoice[]>([])
const companies = ref<Company[]>([])
const loading = ref(true)
const saving = ref(false)
const modalOpen = ref(false)
const editing = ref<Invoice | null>(null)
const filterType = ref<'all' | InvoiceType>('all')

const types: InvoiceType[] = ['DAS', 'Invoice', 'Receipt', 'Contract', 'Other']
const typeLabel: Record<InvoiceType, string> = {
  DAS: 'DAS',
  Invoice: 'Nota Fiscal',
  Receipt: 'Recibo',
  Contract: 'Contrato',
  Other: 'Outro',
}
const typeAccent: Record<InvoiceType, string> = {
  DAS: 'text-sandy bg-sandy/10 border-sandy/30',
  Invoice: 'text-teal bg-teal/10 border-teal/30',
  Receipt: 'text-gold bg-gold/10 border-gold/30',
  Contract: 'text-slate-light bg-slate/20 border-slate/40',
  Other: 'text-gray-300 bg-white/5 border-white/10',
}
const typeDot: Record<InvoiceType, string> = {
  DAS: 'bg-sandy',
  Invoice: 'bg-teal',
  Receipt: 'bg-gold',
  Contract: 'bg-slate-light',
  Other: 'bg-gray-500',
}

const form = ref({
  title: '',
  document_link: '',
  company_id: '',
  type: 'Invoice' as InvoiceType,
  due_date: '',
  payment_date: '',
})

async function fetchData() {
  const [invoicesRes, companiesRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, companies(name)')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('companies').select('*').order('name'),
  ])
  invoices.value = (invoicesRes.data as Invoice[]) ?? []
  companies.value = (companiesRes.data as Company[]) ?? []
  loading.value = false
}

onMounted(fetchData)

const counts = computed(() => {
  const map: Record<InvoiceType, number> = {
    DAS: 0,
    Invoice: 0,
    Receipt: 0,
    Contract: 0,
    Other: 0,
  }
  for (const inv of invoices.value) map[inv.type] = (map[inv.type] ?? 0) + 1
  return map
})

const filtered = computed(() =>
  filterType.value === 'all' ? invoices.value : invoices.value.filter((i) => i.type === filterType.value),
)

function openCreate(type?: InvoiceType) {
  editing.value = null
  form.value = {
    title: '',
    document_link: '',
    company_id: '',
    type: type ?? 'Invoice',
    due_date: '',
    payment_date: '',
  }
  modalOpen.value = true
}

function openEdit(invoice: Invoice) {
  editing.value = invoice
  form.value = {
    title: invoice.title,
    document_link: invoice.document_link,
    company_id: invoice.company_id ?? '',
    type: invoice.type,
    due_date: invoice.due_date ?? '',
    payment_date: invoice.payment_date ?? '',
  }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  const payload = {
    title: form.value.title,
    document_link: form.value.document_link,
    company_id: form.value.company_id || null,
    type: form.value.type,
    due_date: form.value.due_date || null,
    payment_date: form.value.payment_date || null,
  }
  if (editing.value) {
    await supabase.from('invoices').update(payload).eq('id', editing.value.id)
  } else {
    await supabase.from('invoices').insert({ ...payload, user_id: user.value!.id })
  }
  saving.value = false
  modalOpen.value = false
  await fetchData()
}

async function markPaid(invoice: Invoice) {
  await supabase
    .from('invoices')
    .update({ payment_date: new Date().toISOString().slice(0, 10) })
    .eq('id', invoice.id)
  await fetchData()
}

async function remove(invoice: Invoice) {
  if (!confirm(`Excluir "${invoice.title}"?`)) return
  await supabase.from('invoices').delete().eq('id', invoice.id)
  await fetchData()
}

function statusOf(invoice: Invoice): { label: string; variant: 'success' | 'warning' | 'urgent' | 'neutral' } {
  if (invoice.payment_date) return { label: `Pago em ${formatDate(invoice.payment_date)}`, variant: 'success' }
  if (isOverdue(invoice.due_date)) return { label: 'Vencido', variant: 'urgent' }
  if (invoice.due_date) return { label: 'Pendente', variant: 'warning' }
  return { label: 'Sem vencimento', variant: 'neutral' }
}

function selectType(type: InvoiceType) {
  filterType.value = filterType.value === type ? 'all' : type
}
</script>

<template>
  <PageHeader title="Documentos" subtitle="Notas fiscais, DAS, recibos e contratos">
    <template #actions>
      <button class="btn-primary" @click="openCreate()">
        <Plus :size="16" /> Novo documento
      </button>
    </template>
  </PageHeader>

  <!-- Cards por tipo -->
  <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
    <button
      v-for="type in types"
      :key="type"
      type="button"
      class="rounded-xl border p-4 text-left transition-colors"
      :class="[
        typeAccent[type],
        filterType === type ? 'ring-2 ring-teal/50' : 'hover:border-white/20',
      ]"
      @click="selectType(type)"
    >
      <p class="text-xs font-semibold uppercase tracking-wider opacity-80">{{ typeLabel[type] }}</p>
      <p class="text-2xl font-bold mt-1">{{ counts[type] }}</p>
      <p class="text-[11px] mt-1 opacity-70">
        {{ counts[type] === 1 ? 'documento' : 'documentos' }}
      </p>
    </button>
  </div>

  <div class="flex items-center justify-between gap-3 mb-4">
    <p class="text-sm text-gray-400">
      <template v-if="filterType === 'all'">Todos os documentos</template>
      <template v-else>{{ typeLabel[filterType] }}</template>
      · {{ filtered.length }}
    </p>
    <button v-if="filterType !== 'all'" type="button" class="btn-ghost !py-1" @click="filterType = 'all'">
      Limpar filtro
    </button>
  </div>

  <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>
  <EmptyState v-else-if="filtered.length === 0" :icon="FileText" message="Nenhum documento encontrado." />

  <div v-else class="card !p-0 overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-white/5">
          <th class="px-5 py-3.5 font-semibold">Documento</th>
          <th class="px-5 py-3.5 font-semibold">Tipo</th>
          <th class="px-5 py-3.5 font-semibold">Empresa</th>
          <th class="px-5 py-3.5 font-semibold">Vencimento</th>
          <th class="px-5 py-3.5 font-semibold">Status</th>
          <th class="px-5 py-3.5 font-semibold text-right">Ações</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-white/5">
        <tr v-for="invoice in filtered" :key="invoice.id" class="hover:bg-white/[0.02]">
          <td class="px-5 py-3.5">
            <a
              :href="invoice.document_link"
              target="_blank"
              rel="noopener"
              class="text-gray-200 hover:text-teal inline-flex items-center gap-1.5"
            >
              {{ invoice.title }} <ExternalLink :size="13" class="text-gray-500" />
            </a>
          </td>
          <td class="px-5 py-3.5">
            <span class="inline-flex items-center gap-2 text-gray-300">
              <span class="w-2 h-2 rounded-full" :class="typeDot[invoice.type]" />
              {{ typeLabel[invoice.type] }}
            </span>
          </td>
          <td class="px-5 py-3.5 text-gray-400">{{ invoice.companies?.name ?? 'Geral' }}</td>
          <td class="px-5 py-3.5 text-gray-400">{{ formatDate(invoice.due_date) }}</td>
          <td class="px-5 py-3.5">
            <StatusBadge :label="statusOf(invoice).label" :variant="statusOf(invoice).variant" />
          </td>
          <td class="px-5 py-3.5">
            <div class="flex justify-end gap-1">
              <button
                v-if="!invoice.payment_date && invoice.due_date"
                class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10"
                title="Marcar como pago"
                @click="markPaid(invoice)"
              >
                <CheckCircle2 :size="15" />
              </button>
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEdit(invoice)">
                <Pencil :size="15" />
              </button>
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="remove(invoice)">
                <Trash2 :size="15" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <AppModal :open="modalOpen" :title="editing ? 'Editar documento' : 'Novo documento'" @close="modalOpen = false">
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label">Título *</label>
        <input v-model="form.title" required class="input" placeholder="Ex.: NF Junho/2026" />
      </div>
      <div>
        <label class="label">Link do documento *</label>
        <input v-model="form.document_link" type="url" required class="input" placeholder="https://..." />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Tipo</label>
          <select v-model="form.type" class="input">
            <option v-for="type in types" :key="type" :value="type">{{ typeLabel[type] }}</option>
          </select>
        </div>
        <div>
          <label class="label">Empresa</label>
          <select v-model="form.company_id" class="input">
            <option value="">Geral (sem empresa)</option>
            <option v-for="company in companies" :key="company.id" :value="company.id">{{ company.name }}</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Vencimento</label>
          <input v-model="form.due_date" type="date" class="input" />
        </div>
        <div>
          <label class="label">Data de pagamento</label>
          <input v-model="form.payment_date" type="date" class="input" />
        </div>
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
