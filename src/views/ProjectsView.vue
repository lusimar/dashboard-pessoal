<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Rocket,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  KeyRound,
  Server,
  Database,
  Globe,
  Code2,
  CalendarClock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Mail,
  Plug,
  UserRound,
} from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { encryptSecret, decryptSecret } from '../composables/useCrypto'
import { formatCurrency, formatDate } from '../composables/useFormat'
import type { Company, LiveProject, ProjectCredential } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const NEW_COMPANY = '__new__'

const { user } = useAuth()
const projects = ref<LiveProject[]>([])
const companies = ref<Company[]>([])
const loading = ref(true)
const saving = ref(false)

const showPassword = ref(false)
const showNewCompany = ref(false)
const newCompanyName = ref('')
const creatingCompany = ref(false)
const revealedAccount = ref<Record<string, string>>({})

const projectModalOpen = ref(false)
const editingProject = ref<LiveProject | null>(null)
const projectForm = ref({
  name: '',
  company_id: '',
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

const vaultOpen = ref(false)
const vaultProject = ref<LiveProject | null>(null)
const credentials = ref<ProjectCredential[]>([])
const credLoading = ref(false)
const editingCred = ref<ProjectCredential | null>(null)
const credFormOpen = ref(false)
const revealed = ref<Record<string, boolean>>({})
const copied = ref<string>('')
const credForm = ref({
  access_type: '',
  email: '',
  encrypted_password: '',
  notes: '',
})

async function fetchData() {
  const [projectsRes, companiesRes] = await Promise.all([
    supabase.from('live_projects').select('*, companies(name)').order('created_at', { ascending: false }),
    supabase.from('companies').select('*').order('name'),
  ])
  projects.value = (projectsRes.data as LiveProject[]) ?? []
  companies.value = (companiesRes.data as Company[]) ?? []
  loading.value = false
}

onMounted(fetchData)

const totalRecurring = computed(() =>
  projects.value.reduce((sum, p) => sum + Number(p.recurring_revenue ?? 0), 0),
)

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const target = new Date(`${date}T23:59:59`).getTime()
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24))
}

function expirationBadge(project: LiveProject): { label: string; variant: 'success' | 'warning' | 'urgent' | 'neutral' } | null {
  if (!project.expiration_date) return null
  const days = daysUntil(project.expiration_date)
  if (days === null) return null
  if (days < 0) return { label: `Expirado em ${formatDate(project.expiration_date)}`, variant: 'urgent' }
  if (days <= 30) return { label: `Renova em ${days}d (${formatDate(project.expiration_date)})`, variant: 'warning' }
  return { label: `Válido até ${formatDate(project.expiration_date)}`, variant: 'success' }
}

function emptyProjectForm() {
  return {
    name: '',
    company_id: '',
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
  }
}

function openCreateProject() {
  editingProject.value = null
  projectForm.value = emptyProjectForm()
  showPassword.value = false
  showNewCompany.value = false
  newCompanyName.value = ''
  projectModalOpen.value = true
}

async function openEditProject(project: LiveProject) {
  editingProject.value = project
  showPassword.value = false
  showNewCompany.value = false
  newCompanyName.value = ''
  let plainPassword = ''
  if (project.account_password && user.value) {
    plainPassword = await decryptSecret(project.account_password, user.value.id)
  }
  projectForm.value = {
    name: project.name,
    company_id: project.company_id ?? '',
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

function onCompanySelect() {
  if (projectForm.value.company_id === NEW_COMPANY) {
    projectForm.value.company_id = ''
    showNewCompany.value = true
    newCompanyName.value = ''
  }
}

async function createCompanyInline() {
  if (!newCompanyName.value.trim() || !user.value) return
  creatingCompany.value = true
  const { data, error } = await supabase
    .from('companies')
    .insert({ name: newCompanyName.value.trim(), user_id: user.value.id })
    .select('*')
    .single()
  creatingCompany.value = false
  if (error || !data) return
  companies.value = [...companies.value, data as Company].sort((a, b) => a.name.localeCompare(b.name))
  projectForm.value.company_id = data.id
  showNewCompany.value = false
  newCompanyName.value = ''
}

async function saveProject() {
  if (!user.value) return
  saving.value = true
  const encryptedPassword = projectForm.value.account_password
    ? await encryptSecret(projectForm.value.account_password, user.value.id)
    : null
  const payload = {
    name: projectForm.value.name,
    company_id: projectForm.value.company_id || null,
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
  await fetchData()
}

async function removeProject(project: LiveProject) {
  if (!confirm(`Excluir "${project.name}"? Todas as credenciais vinculadas também serão removidas.`)) return
  await supabase.from('live_projects').delete().eq('id', project.id)
  await fetchData()
}

async function openVault(project: LiveProject) {
  vaultProject.value = project
  vaultOpen.value = true
  credFormOpen.value = false
  revealed.value = {}
  await fetchCredentials(project.id)
}

async function fetchCredentials(projectId: string) {
  credLoading.value = true
  const { data } = await supabase
    .from('project_credentials')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  credentials.value = (data as ProjectCredential[]) ?? []
  credLoading.value = false
}

function openCreateCred() {
  editingCred.value = null
  credForm.value = { access_type: '', email: '', encrypted_password: '', notes: '' }
  credFormOpen.value = true
}

function openEditCred(cred: ProjectCredential) {
  editingCred.value = cred
  credForm.value = {
    access_type: cred.access_type,
    email: cred.email,
    encrypted_password: cred.encrypted_password,
    notes: cred.notes ?? '',
  }
  credFormOpen.value = true
}

async function saveCred() {
  if (!vaultProject.value || !user.value) return
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
      project_id: vaultProject.value.id,
      user_id: user.value.id,
    })
  }
  saving.value = false
  credFormOpen.value = false
  await fetchCredentials(vaultProject.value.id)
}

async function removeCred(cred: ProjectCredential) {
  if (!confirm(`Excluir a credencial "${cred.access_type}"?`)) return
  await supabase.from('project_credentials').delete().eq('id', cred.id)
  if (vaultProject.value) await fetchCredentials(vaultProject.value.id)
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

async function revealAccountPassword(project: LiveProject) {
  if (!user.value || !project.account_password) return
  if (revealedAccount.value[project.id]) {
    const next = { ...revealedAccount.value }
    delete next[project.id]
    revealedAccount.value = next
    return
  }
  const plain = await decryptSecret(project.account_password, user.value.id)
  revealedAccount.value = { ...revealedAccount.value, [project.id]: plain }
}

const techItems = (project: LiveProject) =>
  [
    { icon: Code2, value: project.technology },
    { icon: Database, value: project.database_tech },
    { icon: Server, value: project.hosting_provider },
    { icon: Globe, value: project.domain_provider },
    { icon: Plug, value: project.integrations },
  ].filter((item) => item.value)
</script>

<template>
  <PageHeader title="Projetos" subtitle="Projetos no ar, infraestrutura e credenciais">
    <template #actions>
      <button class="btn-primary" @click="openCreateProject">
        <Plus :size="16" /> Novo projeto
      </button>
    </template>
  </PageHeader>

  <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>

  <template v-else>
    <div
      v-if="projects.length > 0"
      class="card mb-6 flex items-center justify-between gap-4"
    >
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-lg bg-gold/10 text-gold">
          <CalendarClock :size="22" />
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Receita recorrente total</p>
          <p class="text-xl font-bold text-white">{{ formatCurrency(totalRecurring) }}</p>
        </div>
      </div>
      <p class="text-sm text-gray-500">{{ projects.length }} {{ projects.length === 1 ? 'projeto' : 'projetos' }}</p>
    </div>

    <EmptyState
      v-if="projects.length === 0"
      :icon="Rocket"
      message="Nenhum projeto cadastrado. Adicione o primeiro projeto no ar."
    />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="project in projects" :key="project.id" class="card flex flex-col">
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2.5 rounded-lg bg-teal/10 shrink-0"><Rocket :size="18" class="text-teal" /></div>
            <div class="min-w-0">
              <h3 class="font-semibold text-white truncate">{{ project.name }}</h3>
              <p class="text-xs text-gray-500 truncate">{{ project.companies?.name || 'Projeto pessoal' }}</p>
            </div>
          </div>
          <div class="flex gap-1 shrink-0">
            <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEditProject(project)">
              <Pencil :size="15" />
            </button>
            <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeProject(project)">
              <Trash2 :size="15" />
            </button>
          </div>
        </div>

        <div v-if="techItems(project).length" class="flex flex-wrap gap-1.5 mb-3">
          <span
            v-for="(item, idx) in techItems(project)"
            :key="idx"
            class="inline-flex items-center gap-1 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-md px-2 py-1"
          >
            <component :is="item.icon" :size="12" class="text-slate-light" />
            {{ item.value }}
          </span>
        </div>

        <dl class="space-y-1.5 text-sm flex-1">
          <div class="flex justify-between gap-2">
            <dt class="text-gray-500">Contrato</dt>
            <dd class="text-gray-300">{{ project.contract_term || '—' }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-gray-500">Receita recorrente</dt>
            <dd class="text-gold font-semibold">{{ formatCurrency(project.recurring_revenue) }}</dd>
          </div>
          <div v-if="project.account_email" class="flex justify-between gap-2">
            <dt class="text-gray-500">Conta</dt>
            <dd class="text-gray-300 truncate">{{ project.account_email }}</dd>
          </div>
          <div v-if="project.account_password" class="flex items-center justify-between gap-2">
            <dt class="text-gray-500">Senha</dt>
            <dd class="flex items-center gap-1.5 text-gray-300 font-mono text-xs">
              <span>{{ revealedAccount[project.id] ? revealedAccount[project.id] : '••••••••' }}</span>
              <button type="button" class="p-1 rounded text-gray-500 hover:text-teal" @click="revealAccountPassword(project)">
                <EyeOff v-if="revealedAccount[project.id]" :size="13" />
                <Eye v-else :size="13" />
              </button>
              <button
                v-if="revealedAccount[project.id]"
                type="button"
                class="p-1 rounded text-gray-500 hover:text-teal"
                @click="copyToClipboard(revealedAccount[project.id], `acc-${project.id}`)"
              >
                <Check v-if="copied === `acc-${project.id}`" :size="13" class="text-teal" />
                <Copy v-else :size="13" />
              </button>
            </dd>
          </div>
          <div v-if="project.contact_name || project.contact_email || project.contact_phone" class="pt-1">
            <dt class="text-gray-500 text-xs mb-0.5">Contato cliente</dt>
            <dd class="text-gray-300 text-xs">
              <span v-if="project.contact_name">{{ project.contact_name }}</span>
              <span v-if="project.contact_name && project.contact_email"> · </span>
              <span v-if="project.contact_email">{{ project.contact_email }}</span>
              <span v-if="project.contact_phone && (project.contact_name || project.contact_email)"> · </span>
              <span v-if="project.contact_phone">{{ project.contact_phone }}</span>
            </dd>
          </div>
        </dl>

        <div v-if="expirationBadge(project)" class="mt-3">
          <StatusBadge :label="expirationBadge(project)!.label" :variant="expirationBadge(project)!.variant" />
        </div>

        <div class="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
          <a
            v-if="project.project_url"
            :href="project.project_url"
            target="_blank"
            rel="noopener"
            class="btn-ghost !text-teal hover:!bg-teal/10 flex-1"
          >
            <ExternalLink :size="15" /> Abrir
          </a>
          <button class="btn-secondary flex-1" @click="openVault(project)">
            <KeyRound :size="15" /> Credenciais
          </button>
        </div>
      </div>
    </div>
  </template>

  <AppModal
    :open="projectModalOpen"
    :title="editingProject ? 'Editar projeto' : 'Novo projeto'"
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">Empresa / Cliente</label>
            <select v-model="projectForm.company_id" class="input" @change="onCompanySelect">
              <option value="">Projeto pessoal</option>
              <option :value="NEW_COMPANY">+ Criar nova empresa...</option>
              <option v-for="company in companies" :key="company.id" :value="company.id">{{ company.name }}</option>
            </select>
            <div v-if="showNewCompany" class="mt-2 flex gap-2">
              <input
                v-model="newCompanyName"
                class="input flex-1"
                placeholder="Nome da nova empresa"
                @keydown.enter.prevent="createCompanyInline"
              />
              <button type="button" class="btn-primary shrink-0" :disabled="creatingCompany || !newCompanyName.trim()" @click="createCompanyInline">
                {{ creatingCompany ? '...' : 'Criar' }}
              </button>
              <button type="button" class="btn-ghost shrink-0" @click="showNewCompany = false">Cancelar</button>
            </div>
          </div>
          <div>
            <label class="label">URL do projeto</label>
            <input v-model="projectForm.project_url" type="url" class="input" placeholder="https://..." />
          </div>
        </div>
      </section>

      <section class="space-y-4 pt-1 border-t border-white/5">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Infraestrutura</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">Tecnologia</label>
            <input v-model="projectForm.technology" class="input" placeholder="Ex.: Vue, React, HTML" />
          </div>
          <div>
            <label class="label">Banco de dados</label>
            <input v-model="projectForm.database_tech" class="input" placeholder="Ex.: Supabase, MySQL" />
          </div>
          <div>
            <label class="label">Hospedagem</label>
            <input v-model="projectForm.hosting_provider" class="input" placeholder="Ex.: Vercel, GitHub Pages" />
          </div>
          <div>
            <label class="label">Provedor de domínio</label>
            <input v-model="projectForm.domain_provider" class="input" placeholder="Ex.: Registro.br" />
          </div>
        </div>
        <div>
          <label class="label">Integrações / APIs (opcional)</label>
          <input v-model="projectForm.integrations" class="input" placeholder="Ex.: Stripe, Mercado Pago, OpenAI, WhatsApp API" />
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
                :type="showPassword ? 'text' : 'password'"
                class="input font-mono pr-10"
                placeholder="••••••••"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-teal"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
            <p class="text-[11px] text-gray-600 mt-1">Criptografada no dispositivo antes de salvar.</p>
          </div>
        </div>
      </section>

      <section class="space-y-4 pt-1 border-t border-white/5">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
          <UserRound :size="12" /> Contato responsável (cliente, opcional)
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
            <label class="label">Vigência do contrato</label>
            <input v-model="projectForm.contract_term" class="input" placeholder="Ex.: 1 Ano, Indeterminado" />
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
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </form>
  </AppModal>

  <AppModal :open="vaultOpen" :title="`Credenciais — ${vaultProject?.name ?? ''}`" @close="vaultOpen = false">
    <div class="space-y-4">
      <p class="text-xs text-gray-500 bg-gold/10 border border-gold/20 rounded-lg px-3 py-2">
        Dados sensíveis protegidos por RLS (visíveis só para você). Evite reutilizar senhas.
      </p>

      <div v-if="credLoading" class="text-sm text-gray-500">Carregando...</div>

      <template v-else>
        <EmptyState v-if="credentials.length === 0 && !credFormOpen" :icon="KeyRound" message="Nenhuma credencial cadastrada." />

        <ul v-if="credentials.length" class="space-y-3">
          <li v-for="cred in credentials" :key="cred.id" class="bg-carbon border border-white/10 rounded-lg p-3.5">
            <div class="flex items-start justify-between gap-2 mb-2">
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
                <KeyRound :size="14" /> {{ cred.access_type }}
              </span>
              <div class="flex gap-1 shrink-0">
                <button class="p-1 rounded text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEditCred(cred)">
                  <Pencil :size="13" />
                </button>
                <button class="p-1 rounded text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="removeCred(cred)">
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <Mail :size="14" class="text-gray-500 shrink-0" />
              <span class="text-gray-300 truncate flex-1">{{ cred.email }}</span>
              <button class="p-1 rounded text-gray-500 hover:text-teal" title="Copiar e-mail" @click="copyToClipboard(cred.email, `email-${cred.id}`)">
                <Check v-if="copied === `email-${cred.id}`" :size="14" class="text-teal" />
                <Copy v-else :size="14" />
              </button>
            </div>

            <div class="flex items-center gap-2 text-sm mt-1.5">
              <KeyRound :size="14" class="text-gray-500 shrink-0" />
              <span class="text-gray-300 font-mono truncate flex-1">
                {{ revealed[cred.id] ? cred.encrypted_password : '••••••••••' }}
              </span>
              <button class="p-1 rounded text-gray-500 hover:text-teal" :title="revealed[cred.id] ? 'Ocultar' : 'Mostrar'" @click="revealed[cred.id] = !revealed[cred.id]">
                <EyeOff v-if="revealed[cred.id]" :size="14" />
                <Eye v-else :size="14" />
              </button>
              <button class="p-1 rounded text-gray-500 hover:text-teal" title="Copiar senha" @click="copyToClipboard(cred.encrypted_password, `pass-${cred.id}`)">
                <Check v-if="copied === `pass-${cred.id}`" :size="14" class="text-teal" />
                <Copy v-else :size="14" />
              </button>
            </div>

            <p v-if="cred.notes" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap">{{ cred.notes }}</p>
          </li>
        </ul>

        <form v-if="credFormOpen" class="space-y-3 bg-carbon border border-white/10 rounded-lg p-4" @submit.prevent="saveCred">
          <p class="text-sm font-semibold text-white">{{ editingCred ? 'Editar credencial' : 'Nova credencial' }}</p>
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
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-ghost" @click="credFormOpen = false">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
          </div>
        </form>

        <button v-if="!credFormOpen" class="btn-secondary w-full" @click="openCreateCred">
          <Plus :size="15" /> Adicionar credencial
        </button>
      </template>
    </div>
  </AppModal>
</template>
