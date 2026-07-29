<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save } from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { formatDate } from '../composables/useFormat'
import type { CollegeSubject } from '../types'
import NoteRichEditor from '../components/NoteRichEditor.vue'

const route = useRoute()
const router = useRouter()

const subject = ref<CollegeSubject | null>(null)
const loading = ref(true)
const saving = ref(false)
const savedFlash = ref(false)
const loadError = ref('')

const form = ref({
  name: '',
  start_date: '',
  end_date: '',
  professor: '',
  notes_link: '',
  notes_content: '',
})

const subjectId = computed(() => String(route.params.id))

const periodLabel = computed(() => {
  if (form.value.start_date || form.value.end_date) {
    return `${form.value.start_date ? formatDate(form.value.start_date) : '—'} → ${form.value.end_date ? formatDate(form.value.end_date) : '—'}`
  }
  return 'Período não definido'
})

async function load() {
  loading.value = true
  loadError.value = ''
  const { data, error } = await supabase
    .from('college_subjects')
    .select('*')
    .eq('id', subjectId.value)
    .maybeSingle()

  if (error || !data) {
    loadError.value = error?.message?.includes('notes_content')
      ? 'Execute supabase/13_college_period_notes.sql no Supabase.'
      : 'Matéria não encontrada.'
    subject.value = null
    loading.value = false
    return
  }

  const row = data as CollegeSubject
  subject.value = row
  form.value = {
    name: row.name,
    start_date: row.start_date ?? '',
    end_date: row.end_date ?? '',
    professor: row.professor ?? '',
    notes_link: row.notes_link ?? '',
    notes_content: row.notes_content ?? '',
  }
  loading.value = false
}

onMounted(load)
watch(subjectId, load)

async function save() {
  if (!subject.value || !form.value.name.trim()) return
  saving.value = true
  const { error } = await supabase
    .from('college_subjects')
    .update({
      name: form.value.name.trim(),
      start_date: form.value.start_date || null,
      end_date: form.value.end_date || null,
      professor: form.value.professor || null,
      notes_link: form.value.notes_link || null,
      notes_content: form.value.notes_content || '',
      semester: '',
    })
    .eq('id', subject.value.id)

  saving.value = false
  if (error) {
    loadError.value = error.message
    return
  }
  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 1600)
}

function goBack() {
  router.push({ name: 'college' })
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] flex flex-col -mx-4 sm:-mx-6 lg:-mx-8 -my-8">
    <header class="sticky top-0 z-20 border-b border-white/5 bg-carbon/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-4">
      <div class="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" class="btn-ghost !px-2" @click="goBack">
            <ArrowLeft :size="18" />
          </button>
          <div class="min-w-0">
            <p class="text-[11px] uppercase tracking-widest text-gray-500">Anotações da matéria</p>
            <p class="text-sm text-gray-300 truncate">{{ form.name || 'Sem título' }}</p>
          </div>
        </div>
        <button type="button" class="btn-primary" :disabled="saving || loading" @click="save">
          <Save :size="16" />
          {{ saving ? 'Salvando...' : savedFlash ? 'Salvo!' : 'Salvar anotações' }}
        </button>
      </div>
    </header>

    <div class="flex-1 px-4 sm:px-6 lg:px-8 py-6">
      <div class="max-w-5xl mx-auto">
        <p v-if="loading" class="text-sm text-gray-500">Carregando...</p>
        <p v-else-if="loadError && !subject" class="text-sm text-sandy">{{ loadError }}</p>

        <div v-else class="space-y-5">
          <div>
            <label class="label">Matéria</label>
            <input v-model="form.name" class="input !text-xl !font-semibold !py-3" placeholder="Nome da matéria" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="label">Data de início</label>
              <input v-model="form.start_date" type="date" class="input" />
            </div>
            <div>
              <label class="label">Data final</label>
              <input v-model="form.end_date" type="date" class="input" />
            </div>
            <div>
              <label class="label">Professor</label>
              <input v-model="form.professor" class="input" placeholder="Nome do professor" />
            </div>
            <div>
              <label class="label">Link externo</label>
              <input v-model="form.notes_link" type="url" class="input" placeholder="https://..." />
            </div>
          </div>

          <p class="text-xs text-gray-500">{{ periodLabel }}</p>
          <p v-if="loadError" class="text-sm text-sandy">{{ loadError }}</p>

          <div>
            <label class="label">Anotações</label>
            <NoteRichEditor
              v-model="form.notes_content"
              tall
              placeholder="Resumos, links, tópicos da aula..."
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
