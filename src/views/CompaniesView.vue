<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ArrowLeft,
  FileText,
  FolderClosed,
  Rocket,
  LayoutGrid,
  CalendarClock,
  FileSignature,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Mail,
  Server,
  Database,
  Globe,
  Code2,
  ScrollText,
  StickyNote,
  Plug,
  UserRound,
} from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { useCompanies } from '../composables/useCompanies'
import { encryptSecret, decryptSecret } from '../composables/useCrypto'
import { formatCurrency, formatDate, isOverdue } from '../composables/useFormat'
import type {
  Company,
  ContractAddendum,
  Invoice,
  InvoiceType,
  LiveProject,
  Note,
  NoteStatus,
  NoteType,
  ProjectCredential,
} from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import CreateAddendumModal from '../components/CreateAddendumModal.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { user } = useAuth()
const { companies, loading, fetchCompanies } = useCompanies()

const selectedId = ref<string | null>(null)
const activeTab = ref<'overview' | 'documents' | 'infra' | 'notes'>('overview')

const selected = computed<Company | null>(
  () => companies.value.find((c) => c.id === selectedId.value) ?? null,
)

onMounted(fetchCompanies)

function openWorkspace(company: Company) {
  selectedId.value = company.id
  activeTab.value = 'overview'
}

// ---- helpers de documento ----
const typeLabel: Record<InvoiceType, string> = {
  DAS: 'DAS',
  Invoice: 'Nota fiscal',
  Receipt: 'Recibo',
  Contract: 'Contrato',
  Other: 'Outro',
}
const typeVariant: Record<InvoiceType, 'success' | 'warning' | 'urgent' | 'info' | 'neutral'> = {
  DAS: 'urgent',
  Invoice: 'success',
  Receipt: 'warning',
  Contract: 'info',
  Other: 'neutral',
}

function contractDocs(company: Company): Invoice[] {
  return (company.invoices ?? []).filter((i) => i.type === 'Contract')
}
function financialDocs(company: Company): Invoice[] {
  return (company.invoices ?? [])
    .filter((i) => i.type !== 'Contract')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
}
function invoiceStatus(inv: Invoice): { label: string; variant: 'success' | 'warning' | 'urgent' | 'neutral' } {
  if (inv.payment_date) return { label: `Pago ${formatDate(inv.payment_date)}`, variant: 'success' }
  if (isOverdue(inv.due_date)) return { label: 'Vencido', variant: 'urgent' }
  if (inv.due_date) return { label: 'Pendente', variant: 'warning' }
  return { label: 'Sem vencimento', variant: 'neutral' }
}

// ---- métricas ----
function addendumTotal(addendum: ContractAddendum): number {
  return Number(addendum.period ?? 0) * Number(addendum.added_value ?? 0)
}
function addendumsTotal(company: Company): number {
  return (company.contract_addendums ?? []).reduce((s, a) => s + addendumTotal(a), 0)
}
/** Total base do contrato = duração (meses) × valor mensal */
function baseContractValue(company: Company): number {
  return Number(company.contract_duration ?? 0) * Number(company.agreed_value ?? 0)
}
function totalContractValue(company: Company): number {
  return baseContractValue(company) + addendumsTotal(company)
}
function recurringTotal(company: Company): number {
  return (company.live_projects ?? []).reduce((s, p) => s + Number(p.recurring_revenue ?? 0), 0)
}
function periodLabel(company: Company): string {
  if (company.start_date && company.end_date) {
    return `${formatDate(company.start_date)} — ${formatDate(company.end_date)}`
  }
  if (company.start_date) return `A partir de ${formatDate(company.start_date)}`
  if (company.end_date) return `Até ${formatDate(company.end_date)}`
  return 'Período não definido'
}

// =====================================================
// CRUD Empresa
// =====================================================
const companyModalOpen = ref(false)
const editingCompany = ref<Company | null>(null)
const saving = ref(false)
const companyForm = ref({
  name: '',
  contract_link: '',
  contract_duration: '' as string | number,
  agreed_value: '' as string | number,
  start_date: '',
  end_date: '',
  payment_day: '' as string | number,
})

const formBaseTotal = computed(() => {
  const months = Number(companyForm.value.contract_duration) || 0
  const monthly = Number(companyForm.value.agreed_value) || 0
  return months * monthly
})

function openCreateCompany() {
  editingCompany.value = null
  companyForm.value = {
    name: '',
    contract_link: '',
    contract_duration: '',
    agreed_value: '',
    start_date: '',
    end_date: '',
    payment_day: '',
  }
  companyModalOpen.value = true
}
function openEditCompany(company: Company) {
  editingCompany.value = company
  companyForm.value = {
    name: company.name,
    contract_link: company.contract_link ?? '',
    contract_duration: company.contract_duration ?? '',
    agreed_value: company.agreed_value ?? '',
    start_date: company.start_date ?? '',
    end_date: company.end_date ?? '',
    payment_day: company.payment_day ?? '',
  }
  companyModalOpen.value = true
}
async function saveCompany() {
  saving.value = true
  const payload = {
    name: companyForm.value.name,
    contract_link: companyForm.value.contract_link || null,
    contract_duration: companyForm.value.contract_duration === '' ? null : Number(companyForm.value.contract_duration),
    agreed_value: companyForm.value.agreed_value === '' ? null : Number(companyForm.value.agreed_value),
    start_date: companyForm.value.start_date || null,
    end_date: companyForm.value.end_date || null,
    payment_day: companyForm.value.payment_day === '' ? null : Number(companyForm.value.payment_day),
  }
  if (editingCompany.value) {
    await supabase.from('companies').update(payload).eq('id', editingCompany.value.id)
  } else {
    await supabase.from('companies').insert({ ...payload, user_id: user.value!.id })
  }
  saving.value = false
  companyModalOpen.value = false
  await fetchCompanies()
}
async function removeCompany(company: Company) {
  if (!confirm(`Excluir "${company.name}"? Documentos, projetos, aditivos e finanças vinculados também serão removidos.`)) return
  await supabase.from('companies').delete().eq('id', company.id)
  if (selectedId.value === company.id) selectedId.value = null
  await fetchCompanies()
}

// =====================================================
// Aditivos
// =====================================================
const addendumModalOpen = ref(false)
const editingAddendum = ref<ContractAddendum | null>(null)

function openCreateAddendum() {
  editingAddendum.value = null
  addendumModalOpen.value = true
}
function openEditAddendum(addendum: ContractAddendum) {
  editingAddendum.value = addendum
  addendumModalOpen.value = true
}
async function removeAddendum(addendum: ContractAddendum) {
  if (!confirm('Excluir este aditivo?')) return
  await supabase.from('contract_addendums').delete().eq('id', addendum.id)
  await fetchCompanies()
}

// =====================================================
// Documentos (contexto da empresa, company_id travado)
// =====================================================
const docModalOpen = ref(false)
const editingDoc = ref<Invoice | null>(null)
const docTypes: InvoiceType[] = ['DAS', 'Invoice', 'Receipt', 'Contract', 'Other']
const docForm = ref({
  title: '',
  document_link: '',
  type: 'Invoice' as InvoiceType,
  due_date: '',
  payment_date: '',
})

function openCreateDoc(presetType: InvoiceType = 'Invoice') {
  editingDoc.value = null
  docForm.value = { title: '', document_link: '', type: presetType, due_date: '', payment_date: '' }
  docModalOpen.value = true
}
function openEditDoc(doc: Invoice) {
  editingDoc.value = doc
  docForm.value = {
    title: doc.title,
    document_link: doc.document_link,
    type: doc.type,
    due_date: doc.due_date ?? '',
    payment_date: doc.payment_date ?? '',
  }
  docModalOpen.value = true
}
async function saveDoc() {
  if (!selected.value) return
  saving.value = true
  const payload = {
    title: docForm.value.title,
    document_link: docForm.value.document_link,
    type: docForm.value.type,
    due_date: docForm.value.due_date || null,
    payment_date: docForm.value.payment_date || null,
    company_id: selected.value.id, // travado no contexto da empresa
  }
  if (editingDoc.value) {
    await supabase.from('invoices').update(payload).eq('id', editingDoc.value.id)
  } else {
    await supabase.from('invoices').insert({ ...payload, user_id: user.value!.id })
  }
  saving.value = false
  docModalOpen.value = false
  await fetchCompanies()
}
async function markDocPaid(doc: Invoice) {
  await supabase.from('invoices').update({ payment_date: new Date().toISOString().slice(0, 10) }).eq('id', doc.id)
  await fetchCompanies()
}
async function removeDoc(doc: Invoice) {
  if (!confirm(`Excluir "${doc.title}"?`)) return
  await supabase.from('invoices').delete().eq('id', doc.id)
  await fetchCompanies()
}

// =====================================================
// Projetos (contexto da empresa, company_id travado)
// =====================================================
const projectModalOpen = ref(false)
const editingProject = ref<LiveProject | null>(null)
const showProjectPassword = ref(false)
const projectForm = ref({
  name: '',
  project_url: '',
  technology: '',
  database_tech: '',
  hosting_provider: '',
  domain_provider: '',
  contract_term: '',
  recurring_revenue: '' as string | number,
  expiration_date: '',
  integrations: '',
  account_email: '',
  account_password: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
})

function openCreateProject() {
  editingProject.value = null
  showProjectPassword.value = false
  projectForm.value = {
    name: '',
    project_url: '',
    technology: '',
    database_tech: '',
    hosting_provider: '',
    domain_provider: '',
    contract_term: '',
    recurring_revenue: '',
    expiration_date: '',
    integrations: '',
    account_email: '',
    account_password: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  }
  projectModalOpen.value = true
}
async function openEditProject(project: LiveProject) {
  editingProject.value = project
  showProjectPassword.value = false
  let plainPassword = ''
  if (project.account_password && user.value) {
    plainPassword = await decryptSecret(project.account_password, user.value.id)
  }
  projectForm.value = {
    name: project.name,
    project_url: project.project_url ?? '',
    technology: project.technology ?? '',
    database_tech: project.database_tech ?? '',
    hosting_provider: project.hosting_provider ?? '',
    domain_provider: project.domain_provider ?? '',
    contract_term: project.contract_term ?? '',
    recurring_revenue: project.recurring_revenue ?? '',
    expiration_date: project.expiration_date ?? '',
    integrations: project.integrations ?? '',
    account_email: project.account_email ?? '',
    account_password: plainPassword,
    contact_name: project.contact_name ?? '',
    contact_email: project.contact_email ?? '',
    contact_phone: project.contact_phone ?? '',
  }
  projectModalOpen.value = true
}
async function saveProject() {
  if (!selected.value || !user.value) return
  saving.value = true
  const encryptedPassword = projectForm.value.account_password
    ? await encryptSecret(projectForm.value.account_password, user.value.id)
    : null
  const payload = {
    name: projectForm.value.name,
    company_id: selected.value.id,
    project_url: projectForm.value.project_url || null,
    technology: projectForm.value.technology || null,
    database_tech: projectForm.value.database_tech || null,
    hosting_provider: projectForm.value.hosting_provider || null,
    domain_provider: projectForm.value.domain_provider || null,
    contract_term: projectForm.value.contract_term || null,
    recurring_revenue: projectForm.value.recurring_revenue === '' ? 0 : Number(projectForm.value.recurring_revenue),
    expiration_date: projectForm.value.expiration_date || null,
    integrations: projectForm.value.integrations.trim() || null,
    account_email: projectForm.value.account_email.trim() || null,
    account_password: encryptedPassword,
    contact_name: projectForm.value.contact_name.trim() || null,
    contact_email: projectForm.value.contact_email.trim() || null,
    contact_phone: projectForm.value.contact_phone.trim() || null,
  }
  if (editingProject.value) {
    await supabase.from('live_projects').update(payload).eq('id', editingProject.value.id)
  } else {
    await supabase.from('live_projects').insert({ ...payload, user_id: user.value.id })
  }
  saving.value = false
  projectModalOpen.value = false
  await fetchCompanies()
}
async function removeProject(project: LiveProject) {
  if (!confirm(`Excluir "${project.name}"? As credenciais vinculadas também serão removidas.`)) return
  await supabase.from('live_projects').delete().eq('id', project.id)
  await fetchCompanies()
}

const techItems = (project: LiveProject) =>
  [
    { icon: Code2, value: project.technology },
    { icon: Database, value: project.database_tech },
    { icon: Server, value: project.hosting_provider },
    { icon: Globe, value: project.domain_provider },
    { icon: Plug, value: project.integrations },
  ].filter((item) => item.value)

function projectExpiration(p: LiveProject): { label: string; variant: 'success' | 'warning' | 'urgent' } | null {
  if (!p.expiration_date) return null
  const days = Math.ceil((new Date(`${p.expiration_date}T23:59:59`).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `Expirado ${formatDate(p.expiration_date)}`, variant: 'urgent' }
  if (days <= 30) return { label: `Renova em ${days}d`, variant: 'warning' }
  return { label: `Até ${formatDate(p.expiration_date)}`, variant: 'success' }
}

// =====================================================
// Credenciais
// =====================================================
const credModalOpen = ref(false)
const editingCred = ref<ProjectCredential | null>(null)
const credProjectId = ref<string | null>(null)
const revealed = ref<Record<string, boolean>>({})
const copied = ref('')
const credForm = ref({ access_type: '', email: '', encrypted_password: '', notes: '' })

function openCreateCred(projectId: string) {
  editingCred.value = null
  credProjectId.value = projectId
  credForm.value = { access_type: '', email: '', encrypted_password: '', notes: '' }
  credModalOpen.value = true
}
function openEditCred(cred: ProjectCredential) {
  editingCred.value = cred
  credProjectId.value = cred.project_id
  credForm.value = {
    access_type: cred.access_type,
    email: cred.email,
    encrypted_password: cred.encrypted_password,
    notes: cred.notes ?? '',
  }
  credModalOpen.value = true
}
async function saveCred() {
  if (!credProjectId.value) return
  saving.value = true
  const payload = {
    access_type: credForm.value.access_type,
    email: credForm.value.email,
    encrypted_password: credForm.value.encrypted_password,
    notes: credForm.value.notes || null,
  }
  if (editingCred.value) {
    await supabase.from('project_credentials').update(payload).eq('id', editingCred.value.id)
  } else {
    await supabase.from('project_credentials').insert({
      ...payload,
      project_id: credProjectId.value,
      user_id: user.value!.id,
    })
  }
  saving.value = false
  credModalOpen.value = false
  await fetchCompanies()
}
async function removeCred(cred: ProjectCredential) {
  if (!confirm(`Excluir a credencial "${cred.access_type}"?`)) return
  await supabase.from('project_credentials').delete().eq('id', cred.id)
  await fetchCompanies()
}
async function copyToClipboard(value: string, key: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = key
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    /* clipboard indisponível */
  }
}

// ---- Anotações da empresa ----
const noteModalOpen = ref(false)
const editingNote = ref<Note | null>(null)
const noteForm = ref({
  title: '',
  type: 'Credentials' as NoteType,
  status: 'Active' as NoteStatus,
})

const noteTypeLabel: Record<NoteType, string> = {
  Draft: 'Rascunho',
  Credentials: 'Acessos',
  LinkedIn: 'Post LinkedIn',
  General: 'Geral',
  Document: 'Documento',
}
const noteTypeVariant: Record<NoteType, 'neutral' | 'info' | 'warning' | 'urgent' | 'success'> = {
  Draft: 'neutral',
  Credentials: 'urgent',
  LinkedIn: 'info',
  General: 'success',
  Document: 'warning',
}
const noteStatusLabel: Record<NoteStatus, string> = {
  Active: 'Ativo',
  Archived: 'Arquivado',
  'In Progress': 'Em Andamento',
  Published: 'Publicado',
}
const noteStatusVariant: Record<NoteStatus, 'success' | 'warning' | 'urgent' | 'info' | 'neutral'> = {
  Active: 'success',
  Archived: 'neutral',
  'In Progress': 'warning',
  Published: 'info',
}

function openCreateCompanyNote() {
  editingNote.value = null
  noteForm.value = { title: '', type: 'Credentials', status: 'Active' }
  noteModalOpen.value = true
}

function openEditCompanyNote(note: Note) {
  router.push({ name: 'note-editor', params: { id: note.id } })
}

async function saveCompanyNote() {
  if (!selected.value || !noteForm.value.title.trim()) return
  saving.value = true
  const payload = {
    title: noteForm.value.title.trim(),
    type: noteForm.value.type,
    status: noteForm.value.status,
    company_id: selected.value.id,
    updated_at: new Date().toISOString(),
  }

  if (editingNote.value) {
    await supabase.from('notes').update(payload).eq('id', editingNote.value.id)
    saving.value = false
    noteModalOpen.value = false
    await fetchCompanies()
    return
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({ ...payload, content: '', user_id: user.value!.id })
    .select('id')
    .single()

  saving.value = false
  noteModalOpen.value = false

  if (error || !data) {
    await fetchCompanies()
    return
  }

  router.push({ name: 'note-editor', params: { id: data.id } })
}

async function removeCompanyNote(note: Note) {
  if (!confirm(`Excluir "${note.title}"?`)) return
  await supabase.from('notes').delete().eq('id', note.id)
  await fetchCompanies()
}

function stripHtml(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent || el.innerText || ''
}

async function copyNotePlain(note: Note) {
  await copyToClipboard(stripHtml(note.content ?? ''), `note-${note.id}`)
}
</script>

<template>
  <!-- =========================== LISTA DE EMPRESAS =========================== -->
  <template v-if="!selected">
    <PageHeader title="Empresas" subtitle="Workspace unificado: contratos, documentos e infraestrutura">
      <template #actions>
        <button class="btn-primary" @click="openCreateCompany">
          <Plus :size="16" /> Nova empresa
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>
    <EmptyState
      v-else-if="companies.length === 0"
      :icon="Building2"
      message="Nenhuma empresa cadastrada ainda. Adicione seu primeiro cliente."
    />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <button
        v-for="company in companies"
        :key="company.id"
        class="card text-left hover:border-teal/40 transition-colors group"
        @click="openWorkspace(company)"
      >
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2.5 rounded-lg bg-slate/20 shrink-0 group-hover:bg-teal/10 transition-colors">
            <Building2 :size="18" class="text-slate-light group-hover:text-teal transition-colors" />
          </div>
          <h3 class="font-semibold text-white truncate flex-1">{{ company.name }}</h3>
          <LayoutGrid :size="16" class="text-gray-600 group-hover:text-teal transition-colors" />
        </div>

        <div class="flex items-center justify-between text-sm mb-3">
          <span class="text-gray-500">Valor total do contrato</span>
          <span class="text-gold font-semibold">{{ formatCurrency(totalContractValue(company)) }}</span>
        </div>

        <div class="flex flex-wrap gap-2 text-xs">
          <span class="inline-flex items-center gap-1 text-gray-400 bg-white/5 rounded-md px-2 py-1">
            <FileText :size="12" class="text-gold" /> {{ (company.invoices ?? []).length }} docs
          </span>
          <span class="inline-flex items-center gap-1 text-gray-400 bg-white/5 rounded-md px-2 py-1">
            <Rocket :size="12" class="text-teal" /> {{ (company.live_projects ?? []).length }} projetos
          </span>
          <span class="inline-flex items-center gap-1 text-gray-400 bg-white/5 rounded-md px-2 py-1">
            <FileSignature :size="12" class="text-sandy" /> {{ (company.contract_addendums ?? []).length }} aditivos
          </span>
        </div>
      </button>
    </div>
  </template>

  <!-- =========================== WORKSPACE DA EMPRESA =========================== -->
  <template v-else>
    <!-- Cabeçalho -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-3 min-w-0">
        <button class="btn-ghost !px-2" @click="selectedId = null">
          <ArrowLeft :size="18" />
        </button>
        <div class="p-2.5 rounded-lg bg-teal/10 shrink-0">
          <Building2 :size="20" class="text-teal" />
        </div>
        <div class="min-w-0">
          <h1 class="text-xl font-bold text-white truncate">{{ selected.name }}</h1>
          <p class="text-xs text-gray-500">
            <template v-if="selected.contract_duration">{{ selected.contract_duration }} {{ selected.contract_duration === 1 ? 'mês' : 'meses' }}</template>
            <template v-else>Sem duração</template>
            · {{ periodLabel(selected) }}
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost" @click="openEditCompany(selected)"><Pencil :size="15" /> Editar</button>
        <button class="btn-ghost !text-sandy hover:!bg-sandy/10" @click="removeCompany(selected)">
          <Trash2 :size="15" /> Excluir
        </button>
      </div>
    </div>

    <!-- Abas -->
    <div class="flex gap-1 p-1 bg-carbon-light rounded-lg border border-white/5 w-fit mb-6 flex-wrap">
      <button
        v-for="tab in [
          { key: 'overview', label: 'Visão geral', icon: LayoutGrid },
          { key: 'documents', label: 'Documentos', icon: FolderClosed },
          { key: 'infra', label: 'Infraestrutura', icon: Rocket },
          { key: 'notes', label: 'Anotações & Acessos', icon: StickyNote },
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

    <!-- ---------------- TAB: VISÃO GERAL ---------------- -->
    <div v-if="activeTab === 'overview'" class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="card">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Valor mensal</p>
          <p class="text-xl font-bold text-white mt-1">{{ formatCurrency(selected.agreed_value) }}</p>
        </div>
        <div class="card">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Duração</p>
          <p class="text-xl font-bold text-slate-light mt-1">
            {{ selected.contract_duration != null ? `${selected.contract_duration} ${selected.contract_duration === 1 ? 'mês' : 'meses'}` : '—' }}
          </p>
        </div>
        <div class="card">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Total base (duração × mensal)</p>
          <p class="text-xl font-bold text-teal mt-1">{{ formatCurrency(baseContractValue(selected)) }}</p>
        </div>
        <div class="card">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Total do contrato (+ aditivos)</p>
          <p class="text-xl font-bold text-gold mt-1">{{ formatCurrency(totalContractValue(selected)) }}</p>
        </div>
      </div>

      <div class="card">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Período do freela</p>
        <p class="text-sm text-gray-200">{{ periodLabel(selected) }}</p>
        <p v-if="selected.contract_duration" class="text-xs text-gray-500 mt-1">
          {{ selected.contract_duration }} {{ selected.contract_duration === 1 ? 'mês' : 'meses' }}
          · {{ formatCurrency(selected.agreed_value) }}/mês
          · Total base {{ formatCurrency(baseContractValue(selected)) }}
        </p>
      </div>

      <!-- Aditivos -->
      <section class="card">
        <div class="flex items-center justify-between gap-2 mb-4">
          <div class="flex items-center gap-2">
            <FileSignature :size="18" class="text-sandy" />
            <h2 class="font-semibold text-white">Aditivos de contrato</h2>
          </div>
          <button class="btn-primary" @click="openCreateAddendum"><Plus :size="15" /> Novo aditivo</button>
        </div>

        <EmptyState
          v-if="(selected.contract_addendums ?? []).length === 0"
          :icon="FileSignature"
          message="Nenhum aditivo registrado para esta empresa."
        />

        <ul v-else class="divide-y divide-white/5">
          <li
            v-for="addendum in selected.contract_addendums"
            :key="addendum.id"
            class="py-4 flex flex-wrap items-center justify-between gap-4"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="text-lg font-bold text-teal">+ {{ formatCurrency(addendumTotal(addendum)) }}</span>
                <span v-if="addendum.period" class="text-sm text-gray-400">
                  {{ addendum.period }} {{ addendum.period === 1 ? 'mês' : 'meses' }}
                  · {{ formatCurrency(addendum.added_value) }}/mês
                </span>
              </div>
              <p v-if="addendum.description" class="text-xs text-gray-500 mt-1">{{ addendum.description }}</p>
              <div class="flex items-center gap-4 mt-2 text-xs">
                <span v-if="addendum.start_date || addendum.end_date" class="inline-flex items-center gap-1 text-gray-400">
                  <CalendarClock :size="12" />
                  <template v-if="addendum.start_date && addendum.end_date">
                    {{ formatDate(addendum.start_date) }} — {{ formatDate(addendum.end_date) }}
                  </template>
                  <template v-else-if="addendum.end_date">Termina em {{ formatDate(addendum.end_date) }}</template>
                  <template v-else>A partir de {{ formatDate(addendum.start_date) }}</template>
                </span>
                <span v-if="addendum.payment_day" class="inline-flex items-center gap-1 font-semibold text-gold">
                  <CalendarClock :size="12" /> Dia {{ addendum.payment_day }}
                </span>
                <a
                  v-if="addendum.document_link"
                  :href="addendum.document_link"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 text-teal hover:text-teal-light"
                >
                  <ExternalLink :size="12" /> Documento
                </a>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEditAddendum(addendum)">
                <Pencil :size="15" />
              </button>
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeAddendum(addendum)">
                <Trash2 :size="15" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- ---------------- TAB: DOCUMENTOS ---------------- -->
    <div v-else-if="activeTab === 'documents'" class="space-y-6">
      <div class="flex justify-end">
        <button class="btn-primary" @click="openCreateDoc()"><Plus :size="15" /> Novo documento</button>
      </div>

      <!-- 📁 Contratos -->
      <section class="card">
        <div class="flex items-center gap-2 mb-4">
          <ScrollText :size="18" class="text-slate-light" />
          <h2 class="font-semibold text-white">Contratos</h2>
        </div>

        <div class="space-y-2">
          <a
            v-if="selected.contract_link"
            :href="selected.contract_link"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-3 p-3 rounded-lg bg-carbon border border-white/10 hover:border-teal/40 transition-colors"
          >
            <FileText :size="16" class="text-slate-light" />
            <span class="text-sm text-gray-200 flex-1">Contrato base</span>
            <ExternalLink :size="14" class="text-teal" />
          </a>

          <div
            v-for="doc in contractDocs(selected)"
            :key="doc.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-carbon border border-white/10"
          >
            <FileText :size="16" class="text-slate-light" />
            <a :href="doc.document_link" target="_blank" rel="noopener" class="text-sm text-gray-200 hover:text-teal flex-1 truncate">
              {{ doc.title }}
            </a>
            <button class="p-1 rounded text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEditDoc(doc)"><Pencil :size="13" /></button>
            <button class="p-1 rounded text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeDoc(doc)"><Trash2 :size="13" /></button>
          </div>

          <!-- Documentos de aditivos -->
          <a
            v-for="addendum in (selected.contract_addendums ?? []).filter((a) => a.document_link)"
            :key="`add-${addendum.id}`"
            :href="addendum.document_link!"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-3 p-3 rounded-lg bg-carbon border border-white/10 hover:border-teal/40 transition-colors"
          >
            <FileSignature :size="16" class="text-sandy" />
            <span class="text-sm text-gray-200 flex-1 truncate">Aditivo · + {{ formatCurrency(addendumTotal(addendum)) }}</span>
            <ExternalLink :size="14" class="text-teal" />
          </a>

          <p
            v-if="!selected.contract_link && contractDocs(selected).length === 0 && (selected.contract_addendums ?? []).filter((a) => a.document_link).length === 0"
            class="text-sm text-gray-600 py-4 text-center"
          >
            Nenhum contrato vinculado.
          </p>
        </div>
      </section>

      <!-- 📁 Notas & DAS -->
      <section class="card !p-0 overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-4 border-b border-white/5">
          <FolderClosed :size="18" class="text-gold" />
          <h2 class="font-semibold text-white">Notas fiscais & DAS</h2>
        </div>

        <EmptyState v-if="financialDocs(selected).length === 0" :icon="FileText" message="Nenhum documento financeiro." />

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-white/5">
              <th class="px-5 py-3 font-semibold">Documento</th>
              <th class="px-5 py-3 font-semibold">Tipo</th>
              <th class="px-5 py-3 font-semibold">Vencimento</th>
              <th class="px-5 py-3 font-semibold">Status</th>
              <th class="px-5 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr v-for="doc in financialDocs(selected)" :key="doc.id" class="hover:bg-white/[0.02]">
              <td class="px-5 py-3">
                <a :href="doc.document_link" target="_blank" rel="noopener" class="text-gray-200 hover:text-teal inline-flex items-center gap-1.5">
                  {{ doc.title }} <ExternalLink :size="13" class="text-gray-500" />
                </a>
              </td>
              <td class="px-5 py-3">
                <StatusBadge :label="typeLabel[doc.type]" :variant="typeVariant[doc.type]" />
              </td>
              <td class="px-5 py-3" :class="isOverdue(doc.due_date, doc.payment_date) ? 'text-sandy font-medium' : 'text-gray-400'">
                {{ formatDate(doc.due_date) }}
              </td>
              <td class="px-5 py-3">
                <StatusBadge :label="invoiceStatus(doc).label" :variant="invoiceStatus(doc).variant" />
              </td>
              <td class="px-5 py-3">
                <div class="flex justify-end gap-1">
                  <button
                    v-if="!doc.payment_date && doc.due_date"
                    class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10"
                    title="Marcar como pago"
                    @click="markDocPaid(doc)"
                  >
                    <CheckCircle2 :size="15" />
                  </button>
                  <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEditDoc(doc)"><Pencil :size="15" /></button>
                  <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeDoc(doc)"><Trash2 :size="15" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- ---------------- TAB: INFRAESTRUTURA ---------------- -->
    <div v-else-if="activeTab === 'infra'" class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div class="card flex items-center gap-3 flex-1">
          <div class="p-3 rounded-lg bg-gold/10 text-gold"><CalendarClock :size="20" /></div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Receita recorrente</p>
            <p class="text-lg font-bold text-white">{{ formatCurrency(recurringTotal(selected)) }}</p>
          </div>
        </div>
        <button class="btn-primary shrink-0" @click="openCreateProject"><Plus :size="15" /> Novo projeto</button>
      </div>

      <EmptyState
        v-if="(selected.live_projects ?? []).length === 0"
        :icon="Rocket"
        message="Nenhum projeto/infraestrutura vinculado a esta empresa."
      />

      <div v-for="project in selected.live_projects" :key="project.id" class="card">
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2.5 rounded-lg bg-teal/10 shrink-0"><Rocket :size="18" class="text-teal" /></div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-white truncate">{{ project.name }}</h3>
                <a v-if="project.project_url" :href="project.project_url" target="_blank" rel="noopener" class="text-teal hover:text-teal-light">
                  <ExternalLink :size="14" />
                </a>
              </div>
              <p class="text-xs text-gold font-semibold">{{ formatCurrency(project.recurring_revenue) }} / recorrente</p>
            </div>
          </div>
          <div class="flex gap-1 shrink-0">
            <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEditProject(project)"><Pencil :size="15" /></button>
            <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeProject(project)"><Trash2 :size="15" /></button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 mb-3">
          <span
            v-for="(item, idx) in techItems(project)"
            :key="idx"
            class="inline-flex items-center gap-1 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-md px-2 py-1"
          >
            <component :is="item.icon" :size="12" class="text-slate-light" />
            {{ item.value }}
          </span>
          <StatusBadge
            v-if="projectExpiration(project)"
            :label="projectExpiration(project)!.label"
            :variant="projectExpiration(project)!.variant"
          />
        </div>

        <!-- Credenciais -->
        <div class="mt-4 pt-4 border-t border-white/5">
          <div class="flex items-center justify-between mb-3">
            <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-300">
              <KeyRound :size="14" class="text-gold" /> Credenciais
            </span>
            <button class="btn-ghost !py-1" @click="openCreateCred(project.id)"><Plus :size="14" /> Adicionar</button>
          </div>

          <p v-if="(project.project_credentials ?? []).length === 0" class="text-xs text-gray-600">Nenhuma credencial cadastrada.</p>

          <ul v-else class="space-y-2">
            <li v-for="cred in project.project_credentials" :key="cred.id" class="bg-carbon border border-white/10 rounded-lg p-3">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
                  <KeyRound :size="13" /> {{ cred.access_type }}
                </span>
                <div class="flex gap-1">
                  <button class="p-1 rounded text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEditCred(cred)"><Pencil :size="12" /></button>
                  <button class="p-1 rounded text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeCred(cred)"><Trash2 :size="12" /></button>
                </div>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <Mail :size="13" class="text-gray-500 shrink-0" />
                <span class="text-gray-300 truncate flex-1">{{ cred.email }}</span>
                <button class="p-1 rounded text-gray-500 hover:text-teal" @click="copyToClipboard(cred.email, `email-${cred.id}`)">
                  <Check v-if="copied === `email-${cred.id}`" :size="13" class="text-teal" />
                  <Copy v-else :size="13" />
                </button>
              </div>
              <div class="flex items-center gap-2 text-sm mt-1">
                <KeyRound :size="13" class="text-gray-500 shrink-0" />
                <span class="text-gray-300 font-mono truncate flex-1">
                  {{ revealed[cred.id] ? cred.encrypted_password : '••••••••••' }}
                </span>
                <button class="p-1 rounded text-gray-500 hover:text-teal" @click="revealed[cred.id] = !revealed[cred.id]">
                  <EyeOff v-if="revealed[cred.id]" :size="13" />
                  <Eye v-else :size="13" />
                </button>
                <button class="p-1 rounded text-gray-500 hover:text-teal" @click="copyToClipboard(cred.encrypted_password, `pass-${cred.id}`)">
                  <Check v-if="copied === `pass-${cred.id}`" :size="13" class="text-teal" />
                  <Copy v-else :size="13" />
                </button>
              </div>
              <p v-if="cred.notes" class="text-xs text-gray-500 mt-1.5 whitespace-pre-wrap">{{ cred.notes }}</p>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ---------------- TAB: ANOTAÇÕES & ACESSOS ---------------- -->
    <div v-else-if="activeTab === 'notes'" class="space-y-6">
      <div class="flex justify-end">
        <button class="btn-primary" @click="openCreateCompanyNote">
          <Plus :size="15" /> Nova anotação / acesso
        </button>
      </div>

      <EmptyState
        v-if="(selected.notes ?? []).length === 0"
        :icon="StickyNote"
        message="Nenhuma anotação vinculada. Cadastre credenciais, links do Drive e acessos aqui."
      />

      <div v-else class="space-y-3">
        <article
          v-for="note in selected.notes"
          :key="note.id"
          class="card"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
              <h3 class="font-semibold text-white">{{ note.title }}</h3>
              <div class="flex flex-wrap gap-2 mt-2">
                <StatusBadge :label="noteTypeLabel[note.type]" :variant="noteTypeVariant[note.type]" />
                <StatusBadge :label="noteStatusLabel[note.status]" :variant="noteStatusVariant[note.status]" />
                <span class="text-xs text-gray-500 self-center">{{ formatDate(note.created_at) }}</span>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button
                class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10"
                title="Copiar conteúdo"
                @click="copyNotePlain(note)"
              >
                <Check v-if="copied === `note-${note.id}`" :size="15" class="text-teal" />
                <Copy v-else :size="15" />
              </button>
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" title="Abrir editor" @click="openEditCompanyNote(note)">
                <Pencil :size="15" />
              </button>
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeCompanyNote(note)">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
          <div
            v-if="note.content"
            class="prose prose-invert prose-sm max-w-none text-gray-300 bg-carbon border border-white/5 rounded-lg px-4 py-3 note-html cursor-pointer"
            v-html="note.content"
            @click="openEditCompanyNote(note)"
          />
          <button
            v-else
            type="button"
            class="text-sm text-gray-500 hover:text-teal"
            @click="openEditCompanyNote(note)"
          >
            Sem conteúdo — clique para escrever
          </button>
        </article>
      </div>
    </div>
  </template>

  <!-- =========================== MODAIS =========================== -->
  <!-- Empresa -->
  <AppModal :open="companyModalOpen" :title="editingCompany ? 'Editar empresa' : 'Nova empresa'" @close="companyModalOpen = false">
    <form class="space-y-4" @submit.prevent="saveCompany">
      <div>
        <label class="label">Nome *</label>
        <input v-model="companyForm.name" required class="input" placeholder="Nome da empresa/cliente" />
      </div>
      <div>
        <label class="label">Link do contrato base</label>
        <input v-model="companyForm.contract_link" type="url" class="input" placeholder="https://drive.google.com/..." />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Data de início</label>
          <input v-model="companyForm.start_date" type="date" class="input" />
        </div>
        <div>
          <label class="label">Data final</label>
          <input v-model="companyForm.end_date" type="date" class="input" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Duração (meses) *</label>
          <input
            v-model="companyForm.contract_duration"
            type="number"
            min="1"
            step="1"
            required
            class="input"
            placeholder="Ex.: 6"
          />
        </div>
        <div>
          <label class="label">Valor mensal (R$) *</label>
          <input
            v-model="companyForm.agreed_value"
            type="number"
            step="0.01"
            min="0"
            required
            class="input"
            placeholder="0,00"
          />
        </div>
      </div>
      <div class="rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-3 flex items-center justify-between gap-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-gold">Total do período</span>
        <span class="text-lg font-bold text-gold">
          {{ formatCurrency(formBaseTotal) }}
          <span class="text-xs font-normal text-gold/70 ml-1">
            ({{ companyForm.contract_duration || 0 }} × {{ formatCurrency(Number(companyForm.agreed_value) || 0) }})
          </span>
        </span>
      </div>
      <div>
        <label class="label">Dia de pagamento mensal *</label>
        <input
          v-model="companyForm.payment_day"
          type="number"
          min="1"
          max="31"
          required
          class="input"
          placeholder="Ex.: 22"
        />
        <p class="text-xs text-gray-500 mt-1">Esse dia gera automaticamente a entrada em Finanças enquanto o contrato estiver ativo.</p>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="companyModalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
      </div>
    </form>
  </AppModal>

  <!-- Aditivo -->
  <CreateAddendumModal
    v-if="selected"
    :open="addendumModalOpen"
    :company-id="selected.id"
    :company-name="selected.name"
    :editing="editingAddendum"
    @close="addendumModalOpen = false"
    @saved="fetchCompanies"
  />

  <!-- Documento (company_id travado) -->
  <AppModal :open="docModalOpen" :title="editingDoc ? 'Editar documento' : `Novo documento — ${selected?.name ?? ''}`" @close="docModalOpen = false">
    <form class="space-y-4" @submit.prevent="saveDoc">
      <div>
        <label class="label">Título *</label>
        <input v-model="docForm.title" required class="input" placeholder="Ex.: NF Junho/2026" />
      </div>
      <div>
        <label class="label">Link do documento *</label>
        <input v-model="docForm.document_link" type="url" required class="input" placeholder="https://drive.google.com/..." />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Tipo</label>
          <select v-model="docForm.type" class="input">
            <option v-for="type in docTypes" :key="type" :value="type">{{ typeLabel[type] }}</option>
          </select>
        </div>
        <div>
          <label class="label">Empresa (fixada)</label>
          <input :value="selected?.name" disabled class="input opacity-60 cursor-not-allowed" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Vencimento</label>
          <input v-model="docForm.due_date" type="date" class="input" />
        </div>
        <div>
          <label class="label">Data de pagamento</label>
          <input v-model="docForm.payment_date" type="date" class="input" />
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="docModalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
      </div>
    </form>
  </AppModal>

  <!-- Projeto (company_id travado) -->
  <AppModal
    :open="projectModalOpen"
    :title="editingProject ? 'Editar projeto' : `Novo projeto — ${selected?.name ?? ''}`"
    size="xl"
    @close="projectModalOpen = false"
  >
    <form class="space-y-5" @submit.prevent="saveProject">
      <section class="space-y-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Dados básicos</p>
        <div>
          <label class="label">Nome *</label>
          <input v-model="projectForm.name" required class="input" placeholder="Ex.: PROJETO VIDA" />
        </div>
        <div>
          <label class="label">URL do projeto</label>
          <input v-model="projectForm.project_url" type="url" class="input" placeholder="https://..." />
        </div>
      </section>

      <section class="space-y-4 pt-1 border-t border-white/5">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Infraestrutura</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">Tecnologia</label>
            <input v-model="projectForm.technology" class="input" placeholder="Ex.: Vue, React" />
          </div>
          <div>
            <label class="label">Banco de dados</label>
            <input v-model="projectForm.database_tech" class="input" placeholder="Ex.: Supabase" />
          </div>
          <div>
            <label class="label">Hospedagem</label>
            <input v-model="projectForm.hosting_provider" class="input" placeholder="Ex.: Vercel" />
          </div>
          <div>
            <label class="label">Provedor de domínio</label>
            <input v-model="projectForm.domain_provider" class="input" placeholder="Ex.: Registro.br" />
          </div>
        </div>
        <div>
          <label class="label">Integrações / APIs (opcional)</label>
          <input v-model="projectForm.integrations" class="input" placeholder="Ex.: Stripe, Mercado Pago, OpenAI" />
        </div>
      </section>

      <section class="space-y-4 pt-1 border-t border-white/5">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
          <KeyRound :size="12" /> Conta da integração (opcional)
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">E-mail da conta</label>
            <input v-model="projectForm.account_email" type="email" class="input" placeholder="conta@exemplo.com" />
          </div>
          <div>
            <label class="label">Senha da conta</label>
            <div class="relative">
              <input
                v-model="projectForm.account_password"
                :type="showProjectPassword ? 'text' : 'password'"
                class="input font-mono pr-10"
                placeholder="••••••••"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-teal"
                @click="showProjectPassword = !showProjectPassword"
              >
                <EyeOff v-if="showProjectPassword" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
            <p class="text-[11px] text-gray-600 mt-1">Criptografada no dispositivo antes de salvar.</p>
          </div>
        </div>
      </section>

      <section class="space-y-4 pt-1 border-t border-white/5">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
          <UserRound :size="12" /> Contato responsável (opcional)
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="label">Nome</label>
            <input v-model="projectForm.contact_name" class="input" placeholder="Nome do contato" />
          </div>
          <div>
            <label class="label">E-mail</label>
            <input v-model="projectForm.contact_email" type="email" class="input" placeholder="contato@cliente.com" />
          </div>
          <div>
            <label class="label">Telefone</label>
            <input v-model="projectForm.contact_phone" type="tel" class="input" placeholder="(11) 99999-9999" />
          </div>
        </div>
      </section>

      <section class="space-y-4 pt-1 border-t border-white/5">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Contrato</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">Vigência</label>
            <input v-model="projectForm.contract_term" class="input" placeholder="Ex.: 1 Ano" />
          </div>
          <div>
            <label class="label">Receita recorrente (R$)</label>
            <input v-model="projectForm.recurring_revenue" type="number" step="0.01" min="0" class="input" placeholder="0,00" />
          </div>
        </div>
        <div>
          <label class="label">Data de expiração / renovação</label>
          <input v-model="projectForm.expiration_date" type="date" class="input" />
        </div>
      </section>

      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="projectModalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
      </div>
    </form>
  </AppModal>

  <!-- Credencial -->
  <AppModal :open="credModalOpen" :title="editingCred ? 'Editar credencial' : 'Nova credencial'" @close="credModalOpen = false">
    <form class="space-y-4" @submit.prevent="saveCred">
      <div>
        <label class="label">Tipo de acesso *</label>
        <input v-model="credForm.access_type" required class="input" placeholder="Ex.: Admin Email, Painel Hospedagem" />
      </div>
      <div>
        <label class="label">E-mail / usuário *</label>
        <input v-model="credForm.email" required class="input" placeholder="acesso@exemplo.com" />
      </div>
      <div>
        <label class="label">Senha / chave *</label>
        <input v-model="credForm.encrypted_password" required class="input font-mono" placeholder="••••••••" />
      </div>
      <div>
        <label class="label">Notas</label>
        <textarea v-model="credForm.notes" rows="2" class="input resize-none" placeholder="Observações de acesso (opcional)" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="credModalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
      </div>
    </form>
  </AppModal>

  <AppModal
    :open="noteModalOpen"
    :title="editingNote ? 'Editar dados da anotação' : 'Nova anotação / acesso'"
    @close="noteModalOpen = false"
  >
    <form class="space-y-4" @submit.prevent="saveCompanyNote">
      <div>
        <label class="label">Título</label>
        <input v-model="noteForm.title" class="input" required placeholder="Ex.: Acessos Figma / Salesforce" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Tipo</label>
          <select v-model="noteForm.type" class="input">
            <option v-for="(label, key) in noteTypeLabel" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="label">Status</label>
          <select v-model="noteForm.status" class="input">
            <option v-for="(label, key) in noteStatusLabel" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
      </div>
      <p class="text-xs text-gray-500">
        Ao salvar, a página de conteúdo em tela cheia será aberta para descrever credenciais e acessos.
      </p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="noteModalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando...' : 'Salvar e escrever' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
