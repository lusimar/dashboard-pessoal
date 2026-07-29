<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Banknote,
  Check,
  Copy,
  ExternalLink,
  Gift,
  MapPin,
  Plus,
  Save,
  Trash2,
  User,
} from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import type { JobApplication, JobApplicationStatus, JobChecklist } from '../types'
import NoteRichEditor from '../components/NoteRichEditor.vue'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const job = ref<JobApplication | null>(null)
const checklist = ref<JobChecklist[]>([])
const loading = ref(true)
const saving = ref(false)
const savedFlash = ref(false)
const loadError = ref('')
const copiedField = ref<string | null>(null)
const newTask = ref('')
const addingTask = ref(false)

let notesSaveTimer: ReturnType<typeof setTimeout> | null = null
let metaSaveTimer: ReturnType<typeof setTimeout> | null = null
let skipNotesWatch = true
let skipMetaWatch = true

const statuses: JobApplicationStatus[] = [
  'Wishlist',
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
  'Hired',
]

const statusLabel: Record<JobApplicationStatus, string> = {
  Wishlist: 'Interesse',
  Applied: 'Candidatado',
  Interviewing: 'Entrevista',
  Offer: 'Proposta',
  Rejected: 'Recusado',
  Hired: 'Contratado',
}

const statusVariant: Record<JobApplicationStatus, 'neutral' | 'info' | 'warning' | 'urgent' | 'success'> = {
  Wishlist: 'neutral',
  Applied: 'info',
  Interviewing: 'warning',
  Offer: 'success',
  Rejected: 'urgent',
  Hired: 'success',
}

const form = ref({
  company_name: '',
  role: '',
  salary: '',
  benefits: '',
  location: '',
  contact_name: '',
  contact_info: '',
  notes: '',
  status: 'Wishlist' as JobApplicationStatus,
  applied_at: '',
})

const jobId = computed(() => String(route.params.id))

const checklistDone = computed(() => checklist.value.filter((i) => i.is_completed).length)

const contactIsLink = computed(() => {
  const info = form.value.contact_info.trim()
  return /^https?:\/\//i.test(info) || /^mailto:/i.test(info) || info.includes('linkedin.com')
})

const contactHref = computed(() => {
  const info = form.value.contact_info.trim()
  if (!info) return ''
  if (/^https?:\/\//i.test(info) || /^mailto:/i.test(info)) return info
  if (info.includes('linkedin.com')) return info.startsWith('http') ? info : `https://${info}`
  if (info.includes('@')) return `mailto:${info}`
  return ''
})

async function load() {
  loading.value = true
  loadError.value = ''
  skipNotesWatch = true
  skipMetaWatch = true

  const [jobRes, listRes] = await Promise.all([
    supabase.from('job_applications').select('*').eq('id', jobId.value).maybeSingle(),
    supabase
      .from('job_checklists')
      .select('*')
      .eq('job_application_id', jobId.value)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (jobRes.error || !jobRes.data) {
    loadError.value = 'Candidatura não encontrada.'
    job.value = null
    loading.value = false
    return
  }

  const data = jobRes.data as JobApplication
  job.value = data
  checklist.value = (listRes.data as JobChecklist[]) ?? []
  form.value = {
    company_name: data.company_name,
    role: data.role ?? '',
    salary: data.salary ?? '',
    benefits: data.benefits ?? '',
    location: data.location ?? '',
    contact_name: data.contact_name ?? '',
    contact_info: data.contact_info ?? '',
    notes: data.notes ?? '',
    status: data.status,
    applied_at: data.applied_at ?? '',
  }

  loading.value = false
  // evita save no hydrate
  requestAnimationFrame(() => {
    skipNotesWatch = false
    skipMetaWatch = false
  })
}

onMounted(load)
watch(jobId, load)

onBeforeUnmount(() => {
  if (notesSaveTimer) clearTimeout(notesSaveTimer)
  if (metaSaveTimer) clearTimeout(metaSaveTimer)
})

function flashSaved() {
  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 1600)
}

async function persist(partial?: Partial<typeof form.value>) {
  if (!job.value || !form.value.company_name.trim()) return
  saving.value = true

  const source = { ...form.value, ...partial }
  const { error } = await supabase
    .from('job_applications')
    .update({
      company_name: source.company_name.trim(),
      role: source.role.trim() || null,
      salary: source.salary.trim() || null,
      benefits: source.benefits.trim() || null,
      location: source.location.trim() || null,
      contact_name: source.contact_name.trim() || null,
      contact_info: source.contact_info.trim() || null,
      notes: source.notes || '',
      status: source.status,
      applied_at: source.applied_at || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.value.id)

  saving.value = false
  if (!error) flashSaved()
}

async function saveNow() {
  if (notesSaveTimer) {
    clearTimeout(notesSaveTimer)
    notesSaveTimer = null
  }
  if (metaSaveTimer) {
    clearTimeout(metaSaveTimer)
    metaSaveTimer = null
  }
  await persist()
}

watch(
  () => form.value.notes,
  () => {
    if (skipNotesWatch || !job.value) return
    if (notesSaveTimer) clearTimeout(notesSaveTimer)
    notesSaveTimer = setTimeout(() => {
      notesSaveTimer = null
      void persist()
    }, 800)
  },
)

watch(
  () => [
    form.value.company_name,
    form.value.role,
    form.value.salary,
    form.value.benefits,
    form.value.location,
    form.value.contact_name,
    form.value.contact_info,
    form.value.status,
    form.value.applied_at,
  ],
  () => {
    if (skipMetaWatch || !job.value) return
    if (metaSaveTimer) clearTimeout(metaSaveTimer)
    metaSaveTimer = setTimeout(() => {
      metaSaveTimer = null
      void persist()
    }, 1000)
  },
)

async function addChecklistItem() {
  const task = newTask.value.trim()
  if (!task || !job.value || !user.value || addingTask.value) return
  addingTask.value = true

  const sort_order = checklist.value.length
  const { data, error } = await supabase
    .from('job_checklists')
    .insert({
      user_id: user.value.id,
      job_application_id: job.value.id,
      task,
      is_completed: false,
      sort_order,
    })
    .select('*')
    .single()

  addingTask.value = false
  if (error || !data) return

  checklist.value.push(data as JobChecklist)
  newTask.value = ''
}

async function toggleChecklist(item: JobChecklist) {
  const next = !item.is_completed
  item.is_completed = next
  const { error } = await supabase
    .from('job_checklists')
    .update({ is_completed: next })
    .eq('id', item.id)
  if (error) item.is_completed = !next
}

async function removeChecklist(item: JobChecklist) {
  const { error } = await supabase.from('job_checklists').delete().eq('id', item.id)
  if (error) return
  checklist.value = checklist.value.filter((i) => i.id !== item.id)
}

async function copyText(value: string, field: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copiedField.value = field
    setTimeout(() => {
      if (copiedField.value === field) copiedField.value = null
    }, 1500)
  } catch {
    /* clipboard indisponível */
  }
}

function goBack() {
  router.push({ name: 'jobs' })
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] flex flex-col -mx-4 sm:-mx-6 lg:-mx-8 -my-8">
    <header class="sticky top-0 z-20 border-b border-white/5 bg-carbon/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-4">
      <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" class="btn-ghost !px-2" @click="goBack">
            <ArrowLeft :size="18" />
          </button>
          <div class="min-w-0">
            <p class="text-[11px] uppercase tracking-widest text-gray-500">Candidatura</p>
            <p class="text-sm text-gray-300 truncate">{{ form.company_name || 'Sem empresa' }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="saving" class="text-xs text-gray-500">Salvando...</span>
          <span v-else-if="savedFlash" class="text-xs text-teal">Salvo</span>
          <button type="button" class="btn-primary" :disabled="saving || loading" @click="saveNow">
            <Save :size="16" />
            {{ saving ? 'Salvando...' : savedFlash ? 'Salvo!' : 'Salvar agora' }}
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 px-4 sm:px-6 lg:px-8 py-6">
      <div class="max-w-6xl mx-auto">
        <p v-if="loading" class="text-sm text-gray-500">Carregando...</p>
        <p v-else-if="loadError" class="text-sm text-sandy">{{ loadError }}</p>

        <div v-else class="space-y-6">
          <!-- Header: empresa & contato -->
          <section class="rounded-xl border border-white/5 bg-carbon-light/60 p-5 sm:p-6 space-y-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0 flex-1 space-y-3">
                <div>
                  <label class="label">Empresa</label>
                  <input
                    v-model="form.company_name"
                    class="input !text-2xl !font-bold !py-3 !bg-transparent !border-white/10"
                    placeholder="Nome da empresa"
                  />
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="label">Cargo / vaga</label>
                    <input v-model="form.role" class="input" placeholder="Ex.: Frontend Developer" />
                  </div>
                  <div>
                    <label class="label">Status</label>
                    <select v-model="form.status" class="input">
                      <option v-for="s in statuses" :key="s" :value="s">{{ statusLabel[s] }}</option>
                    </select>
                  </div>
                </div>
              </div>
              <StatusBadge :label="statusLabel[form.status]" :variant="statusVariant[form.status]" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label class="label inline-flex items-center gap-1.5">
                  <Banknote :size="12" /> Salário
                </label>
                <input v-model="form.salary" class="input" placeholder="R$ 4.000,00" />
              </div>
              <div>
                <label class="label inline-flex items-center gap-1.5">
                  <Gift :size="12" /> Benefícios
                </label>
                <input v-model="form.benefits" class="input" placeholder="VA, VR, plano..." />
              </div>
              <div>
                <label class="label inline-flex items-center gap-1.5">
                  <MapPin :size="12" /> Localização
                </label>
                <input v-model="form.location" class="input" placeholder="Remoto / cidade" />
              </div>
              <div>
                <label class="label">Data da candidatura</label>
                <input v-model="form.applied_at" type="date" class="input" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <label class="label inline-flex items-center gap-1.5">
                  <User :size="12" /> Contato
                </label>
                <div class="flex gap-2">
                  <input v-model="form.contact_name" class="input" placeholder="Nome do recrutador" />
                  <button
                    type="button"
                    class="btn-ghost !px-3 shrink-0"
                    title="Copiar nome"
                    :disabled="!form.contact_name"
                    @click="copyText(form.contact_name, 'name')"
                  >
                    <Check v-if="copiedField === 'name'" :size="16" class="text-teal" />
                    <Copy v-else :size="16" />
                  </button>
                </div>
              </div>
              <div>
                <label class="label">Info do contato</label>
                <div class="flex gap-2">
                  <input
                    v-model="form.contact_info"
                    class="input"
                    placeholder="LinkedIn, e-mail ou telefone"
                  />
                  <a
                    v-if="contactIsLink && contactHref"
                    :href="contactHref"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-ghost !px-3 shrink-0"
                    title="Abrir link"
                  >
                    <ExternalLink :size="16" />
                  </a>
                  <button
                    type="button"
                    class="btn-ghost !px-3 shrink-0"
                    title="Copiar"
                    :disabled="!form.contact_info"
                    @click="copyText(form.contact_info, 'info')"
                  >
                    <Check v-if="copiedField === 'info'" :size="16" class="text-teal" />
                    <Copy v-else :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="form.salary || form.benefits || form.location"
              class="flex flex-wrap gap-2"
            >
              <span
                v-if="form.salary"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-teal/10 text-teal border border-teal/20"
              >
                <Banknote :size="12" /> {{ form.salary }}
              </span>
              <span
                v-if="form.benefits"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white/5 text-gray-300 border border-white/10"
              >
                <Gift :size="12" /> {{ form.benefits }}
              </span>
              <span
                v-if="form.location"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate/20 text-slate-light border border-slate/30"
              >
                <MapPin :size="12" /> {{ form.location }}
              </span>
            </div>
          </section>

          <!-- Split: checklist + anotações -->
          <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            <section class="lg:col-span-2 rounded-xl border border-white/5 bg-carbon-light/40 p-5 space-y-4">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <h2 class="text-sm font-semibold text-white">Checklist</h2>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ checklistDone }}/{{ checklist.length }} concluídos
                  </p>
                </div>
              </div>

              <form class="flex gap-2" @submit.prevent="addChecklistItem">
                <input
                  v-model="newTask"
                  class="input"
                  placeholder="Nova tarefa — Enter para adicionar"
                  autocomplete="off"
                />
                <button type="submit" class="btn-primary !px-3 shrink-0" :disabled="addingTask || !newTask.trim()">
                  <Plus :size="16" />
                </button>
              </form>

              <ul v-if="checklist.length" class="space-y-1.5">
                <li
                  v-for="item in checklist"
                  :key="item.id"
                  class="group flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <button
                    type="button"
                    class="shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors"
                    :class="
                      item.is_completed
                        ? 'bg-teal border-teal text-carbon'
                        : 'border-white/20 text-transparent hover:border-teal/50'
                    "
                    :aria-checked="item.is_completed"
                    role="checkbox"
                    @click="toggleChecklist(item)"
                  >
                    <Check :size="12" :stroke-width="3" />
                  </button>
                  <span
                    class="flex-1 text-sm min-w-0 break-words"
                    :class="item.is_completed ? 'text-gray-500 line-through' : 'text-gray-200'"
                  >
                    {{ item.task }}
                  </span>
                  <button
                    type="button"
                    class="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-sandy hover:bg-sandy/10 transition-opacity"
                    title="Remover"
                    @click="removeChecklist(item)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </li>
              </ul>
              <p v-else class="text-xs text-gray-600 text-center py-6">
                Nenhuma tarefa. Adicione etapas da seleção.
              </p>
            </section>

            <section class="lg:col-span-3 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <h2 class="text-sm font-semibold text-white">Anotações</h2>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Entrevistas, testes técnicos e rascunhos — autosave
                  </p>
                </div>
              </div>
              <NoteRichEditor
                v-model="form.notes"
                tall
                placeholder="Anote perguntas da entrevista, instruções do teste técnico, respostas..."
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
