<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Banknote,
} from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { formatDate } from '../composables/useFormat'
import type { JobApplication, JobApplicationStatus } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const { user } = useAuth()

const jobs = ref<JobApplication[]>([])
const loading = ref(true)
const saving = ref(false)
const modalOpen = ref(false)
const saveError = ref('')
const filterStatus = ref<'all' | JobApplicationStatus>('all')

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

const statusAccent: Record<JobApplicationStatus, string> = {
  Wishlist: '#9ca3af',
  Applied: '#1e7796',
  Interviewing: '#f4d35e',
  Offer: '#28afb0',
  Rejected: '#ee964b',
  Hired: '#28afb0',
}

const form = ref({
  company_name: '',
  role: '',
  salary: '',
  benefits: '',
  location: '',
  contact_name: '',
  contact_info: '',
  status: 'Wishlist' as JobApplicationStatus,
  applied_at: '',
})

const filteredJobs = computed(() =>
  filterStatus.value === 'all'
    ? jobs.value
    : jobs.value.filter((j) => j.status === filterStatus.value),
)

async function fetchData() {
  const { data } = await supabase
    .from('job_applications')
    .select('*, job_checklists(id, is_completed)')
    .order('updated_at', { ascending: false })

  jobs.value = (data as JobApplication[]) ?? []
  loading.value = false
}

onMounted(fetchData)

function checklistProgress(job: JobApplication) {
  const items = job.job_checklists ?? []
  if (items.length === 0) return null
  const done = items.filter((i) => i.is_completed).length
  return `${done}/${items.length}`
}

function openCreate() {
  saveError.value = ''
  form.value = {
    company_name: '',
    role: '',
    salary: '',
    benefits: '',
    location: '',
    contact_name: '',
    contact_info: '',
    status: 'Wishlist',
    applied_at: '',
  }
  modalOpen.value = true
}

function openDetail(job: JobApplication) {
  router.push({ name: 'job-editor', params: { id: job.id } })
}

async function save() {
  if (!form.value.company_name.trim() || !user.value) return
  saving.value = true
  saveError.value = ''

  const payload = {
    company_name: form.value.company_name.trim(),
    role: form.value.role.trim() || null,
    salary: form.value.salary.trim() || null,
    benefits: form.value.benefits.trim() || null,
    location: form.value.location.trim() || null,
    contact_name: form.value.contact_name.trim() || null,
    contact_info: form.value.contact_info.trim() || null,
    status: form.value.status,
    applied_at: form.value.applied_at || null,
    notes: '',
    user_id: user.value.id,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('job_applications')
    .insert(payload)
    .select('id')
    .single()

  saving.value = false
  if (error) {
    saveError.value = error.message
    return
  }

  modalOpen.value = false
  if (data?.id) router.push({ name: 'job-editor', params: { id: data.id } })
  else await fetchData()
}

async function updateStatus(job: JobApplication, status: JobApplicationStatus) {
  if (job.status === status) return
  const previous = job.status
  job.status = status
  const { error } = await supabase
    .from('job_applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', job.id)
  if (error) job.status = previous
}

async function remove(job: JobApplication) {
  if (!confirm(`Excluir candidatura em "${job.company_name}"?`)) return
  await supabase.from('job_applications').delete().eq('id', job.id)
  await fetchData()
}
</script>

<template>
  <PageHeader title="Candidaturas" subtitle="Pipeline de recrutamento e acompanhamento de vagas">
    <template #actions>
      <button class="btn-primary" @click="openCreate">
        <Plus :size="16" /> Nova candidatura
      </button>
    </template>
  </PageHeader>

  <div v-if="!loading && jobs.length > 0" class="flex flex-wrap gap-2 mb-6">
    <button
      class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
      :class="filterStatus === 'all' ? 'bg-teal/10 text-teal border-teal/30' : 'text-gray-400 border-white/10 hover:border-white/25'"
      @click="filterStatus = 'all'"
    >
      Todas
    </button>
    <button
      v-for="s in statuses"
      :key="s"
      class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
      :class="filterStatus === s ? 'bg-teal/10 text-teal border-teal/30' : 'text-gray-400 border-white/10 hover:border-white/25'"
      @click="filterStatus = s"
    >
      {{ statusLabel[s] }}
    </button>
  </div>

  <p v-if="loading" class="text-sm text-gray-500">Carregando...</p>

  <EmptyState
    v-else-if="jobs.length === 0"
    :icon="Briefcase"
    message="Nenhuma candidatura ainda. Adicione a primeira vaga."
  />

  <EmptyState
    v-else-if="filteredJobs.length === 0"
    :icon="Briefcase"
    message="Nenhuma candidatura neste status."
  />

  <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
    <article
      v-for="job in filteredJobs"
      :key="job.id"
      class="group relative text-left rounded-2xl bg-zinc-900 border border-white/5 p-5 hover:border-white/15 transition-colors cursor-pointer"
      @click="openDetail(job)"
    >
      <div class="flex items-start gap-4">
        <div
          class="p-3 rounded-xl shrink-0"
          :style="{
            backgroundColor: `${statusAccent[job.status]}22`,
            color: statusAccent[job.status],
          }"
        >
          <Briefcase :size="22" />
        </div>

        <div class="min-w-0 flex-1 pr-14">
          <p class="font-bold text-white uppercase tracking-wide truncate">{{ job.company_name }}</p>
          <p v-if="job.role" class="text-sm text-gray-400 mt-0.5 truncate">{{ job.role }}</p>

          <div class="mt-3" @click.stop>
            <label class="sr-only">Status</label>
            <select
              class="input !py-1.5 !text-xs !w-auto min-w-[9.5rem]"
              :value="job.status"
              @change="updateStatus(job, ($event.target as HTMLSelectElement).value as JobApplicationStatus)"
            >
              <option v-for="s in statuses" :key="s" :value="s">{{ statusLabel[s] }}</option>
            </select>
          </div>

          <div class="flex flex-wrap items-center gap-2 mt-3">
            <StatusBadge :label="statusLabel[job.status]" :variant="statusVariant[job.status]" />
            <StatusBadge
              v-if="checklistProgress(job)"
              :label="`Checklist ${checklistProgress(job)}`"
              variant="info"
            />
          </div>

          <div class="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-xs text-gray-500">
            <span v-if="job.salary" class="inline-flex items-center gap-1">
              <Banknote :size="12" class="text-teal/70" /> {{ job.salary }}
            </span>
            <span v-if="job.location" class="inline-flex items-center gap-1">
              <MapPin :size="12" class="text-slate-light/70" /> {{ job.location }}
            </span>
            <span v-if="job.applied_at">{{ formatDate(job.applied_at) }}</span>
          </div>
        </div>
      </div>

      <div class="absolute top-3 right-3 flex gap-0.5" @click.stop>
        <button
          type="button"
          class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10"
          title="Abrir"
          @click="openDetail(job)"
        >
          <Pencil :size="15" />
        </button>
        <button
          type="button"
          class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10"
          title="Excluir"
          @click="remove(job)"
        >
          <Trash2 :size="15" />
        </button>
      </div>
    </article>
  </div>

  <AppModal :open="modalOpen" title="Nova candidatura" size="lg" @close="modalOpen = false">
    <form class="space-y-4" @submit.prevent="save">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="label">Empresa *</label>
          <input v-model="form.company_name" required class="input" placeholder="Nome da empresa" />
        </div>
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
        <div>
          <label class="label">Salário</label>
          <input v-model="form.salary" class="input" placeholder="R$ 4.000,00 ou faixa" />
        </div>
        <div>
          <label class="label">Localização</label>
          <input v-model="form.location" class="input" placeholder="Remoto, São Paulo - SP..." />
        </div>
        <div class="sm:col-span-2">
          <label class="label">Benefícios</label>
          <input v-model="form.benefits" class="input" placeholder="VA, VR, plano de saúde..." />
        </div>
        <div>
          <label class="label">Contato</label>
          <input v-model="form.contact_name" class="input" placeholder="Recrutador ou Tech Lead" />
        </div>
        <div>
          <label class="label">Info do contato</label>
          <input v-model="form.contact_info" class="input" placeholder="LinkedIn, e-mail ou telefone" />
        </div>
        <div>
          <label class="label">Data da candidatura</label>
          <input v-model="form.applied_at" type="date" class="input" />
        </div>
      </div>
      <p v-if="saveError" class="text-sm text-sandy">{{ saveError }}</p>
      <p class="text-xs text-gray-500">Ao salvar, a tela de detalhes com checklist e anotações será aberta.</p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="modalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando...' : 'Salvar e abrir' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
