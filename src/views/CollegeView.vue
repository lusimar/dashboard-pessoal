<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { GraduationCap, Plus, Pencil, Trash2, ExternalLink, BookOpen, StickyNote } from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { formatDate } from '../composables/useFormat'
import type { CollegeSubject } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const { user } = useAuth()
const subjects = ref<CollegeSubject[]>([])
const loading = ref(true)
const saving = ref(false)
const modalOpen = ref(false)
const editing = ref<CollegeSubject | null>(null)
const saveError = ref('')

const form = ref({
  name: '',
  start_date: '',
  end_date: '',
  professor: '',
  notes_link: '',
})

async function fetchSubjects() {
  const { data } = await supabase
    .from('college_subjects')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('name')
  subjects.value = (data as CollegeSubject[]) ?? []
  loading.value = false
}

onMounted(fetchSubjects)

function periodLabel(subject: CollegeSubject): string {
  if (subject.start_date || subject.end_date) {
    const start = subject.start_date ? formatDate(subject.start_date) : '—'
    const end = subject.end_date ? formatDate(subject.end_date) : '—'
    return `${start} → ${end}`
  }
  if (subject.semester) return `Semestre ${subject.semester}`
  return 'Período não definido'
}

const byPeriod = computed(() => {
  const groups = new Map<string, CollegeSubject[]>()
  for (const subject of subjects.value) {
    const key = periodLabel(subject)
    const list = groups.get(key) ?? []
    list.push(subject)
    groups.set(key, list)
  }
  return groups
})

function stripHtml(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || el.innerText || '').trim()
}

function openCreate() {
  editing.value = null
  saveError.value = ''
  form.value = { name: '', start_date: '', end_date: '', professor: '', notes_link: '' }
  modalOpen.value = true
}

function openMeta(subject: CollegeSubject) {
  editing.value = subject
  saveError.value = ''
  form.value = {
    name: subject.name,
    start_date: subject.start_date ?? '',
    end_date: subject.end_date ?? '',
    professor: subject.professor ?? '',
    notes_link: subject.notes_link ?? '',
  }
  modalOpen.value = true
}

function openNotes(subject: CollegeSubject) {
  router.push({ name: 'college-editor', params: { id: subject.id } })
}

async function save() {
  if (!form.value.name.trim() || !user.value) return
  saving.value = true
  saveError.value = ''
  const payload = {
    name: form.value.name.trim(),
    semester: '',
    start_date: form.value.start_date || null,
    end_date: form.value.end_date || null,
    professor: form.value.professor || null,
    notes_link: form.value.notes_link || null,
  }

  if (editing.value) {
    const { error } = await supabase.from('college_subjects').update(payload).eq('id', editing.value.id)
    saving.value = false
    if (error) {
      saveError.value = error.message
      return
    }
    modalOpen.value = false
    await fetchSubjects()
    return
  }

  const { data, error } = await supabase
    .from('college_subjects')
    .insert({ ...payload, notes_content: '', user_id: user.value.id })
    .select('id')
    .single()

  saving.value = false
  if (error) {
    saveError.value =
      error.message.includes('start_date') || error.message.includes('notes_content')
        ? 'Execute o SQL supabase/13_college_period_notes.sql no Supabase.'
        : error.message
    return
  }

  modalOpen.value = false
  if (data?.id) router.push({ name: 'college-editor', params: { id: data.id } })
  else await fetchSubjects()
}

async function remove(subject: CollegeSubject) {
  if (!confirm(`Excluir "${subject.name}"? Tarefas vinculadas também serão removidas.`)) return
  await supabase.from('college_subjects').delete().eq('id', subject.id)
  await fetchSubjects()
}
</script>

<template>
  <PageHeader title="Faculdade" subtitle="Matérias, período letivo e anotações">
    <template #actions>
      <button class="btn-primary" @click="openCreate">
        <Plus :size="16" /> Nova matéria
      </button>
    </template>
  </PageHeader>

  <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>
  <EmptyState
    v-else-if="subjects.length === 0"
    :icon="GraduationCap"
    message="Nenhuma matéria cadastrada ainda."
  />

  <div v-else class="space-y-8">
    <section v-for="[period, list] in byPeriod" :key="period">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-light mb-3">
        {{ period }}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="subject in list" :key="subject.id" class="card flex flex-col">
          <div class="flex items-start justify-between gap-2 mb-3">
            <button type="button" class="flex items-center gap-3 min-w-0 text-left" @click="openNotes(subject)">
              <div class="p-2.5 rounded-lg bg-teal/10 shrink-0">
                <BookOpen :size="18" class="text-teal" />
              </div>
              <h3 class="font-semibold text-white truncate hover:text-teal">{{ subject.name }}</h3>
            </button>
            <div class="flex gap-1 shrink-0">
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" title="Editar dados" @click="openMeta(subject)">
                <Pencil :size="15" />
              </button>
              <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="remove(subject)">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>

          <p class="text-sm text-gray-400">
            {{ subject.professor ? `Prof. ${subject.professor}` : 'Professor não informado' }}
          </p>
          <p class="text-xs text-gray-500 mt-1">{{ periodLabel(subject) }}</p>
          <p v-if="subject.notes_content" class="text-xs text-gray-500 mt-2 line-clamp-2">
            {{ stripHtml(subject.notes_content) }}
          </p>

          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="btn-secondary !py-1.5 flex-1" @click="openNotes(subject)">
              <StickyNote :size="14" /> Anotações
            </button>
            <a
              v-if="subject.notes_link"
              :href="subject.notes_link"
              target="_blank"
              rel="noopener"
              class="btn-ghost !py-1.5"
            >
              <ExternalLink :size="14" /> Link
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>

  <AppModal :open="modalOpen" :title="editing ? 'Editar matéria' : 'Nova matéria'" @close="modalOpen = false">
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label">Nome *</label>
        <input v-model="form.name" required class="input" placeholder="Ex.: Cálculo II" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Data de início</label>
          <input v-model="form.start_date" type="date" class="input" />
        </div>
        <div>
          <label class="label">Data final</label>
          <input v-model="form.end_date" type="date" class="input" />
        </div>
      </div>
      <div>
        <label class="label">Professor</label>
        <input v-model="form.professor" class="input" placeholder="Nome do professor" />
      </div>
      <div>
        <label class="label">Link externo (opcional)</label>
        <input v-model="form.notes_link" type="url" class="input" placeholder="https://..." />
      </div>
      <p v-if="saveError" class="text-sm text-sandy">{{ saveError }}</p>
      <p v-if="!editing" class="text-xs text-gray-500">
        Ao salvar, a página de anotações em tela cheia será aberta.
      </p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="modalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando...' : editing ? 'Salvar' : 'Salvar e escrever' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
