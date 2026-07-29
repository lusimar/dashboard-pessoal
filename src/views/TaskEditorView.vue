<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save } from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import type { CollegeSubject, Company, Task, TaskCategory, TaskStatus } from '../types'
import NoteRichEditor from '../components/NoteRichEditor.vue'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const router = useRouter()

const task = ref<Task | null>(null)
const companies = ref<Company[]>([])
const subjects = ref<CollegeSubject[]>([])
const loading = ref(true)
const saving = ref(false)
const savedFlash = ref(false)
const loadError = ref('')

const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Completed']
const taskCategories: Exclude<TaskCategory, 'Lembrete'>[] = ['Personal', 'College', 'Job', 'Freelance']
const isReminder = computed(() => form.value.category === 'Lembrete')

const statusLabel: Record<TaskStatus, string> = {
  Pending: 'Pendente',
  'In Progress': 'Em andamento',
  Completed: 'Concluída',
}

const categoryLabel: Record<TaskCategory, string> = {
  Personal: 'Pessoal',
  College: 'Faculdade',
  Job: 'Trabalho',
  Freelance: 'Freelance',
  Lembrete: 'Lembrete',
}

const categoryVariant: Record<TaskCategory, 'neutral' | 'info' | 'warning' | 'urgent'> = {
  Personal: 'neutral',
  College: 'info',
  Job: 'warning',
  Freelance: 'urgent',
  Lembrete: 'warning',
}

const form = ref({
  title: '',
  description: '',
  due_date: '',
  status: 'Pending' as TaskStatus,
  category: 'Personal' as TaskCategory,
  company_id: '',
  subject_id: '',
})

const taskId = computed(() => String(route.params.id))

async function load() {
  loading.value = true
  loadError.value = ''
  const [taskRes, companiesRes, subjectsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, companies(name), college_subjects(name)')
      .eq('id', taskId.value)
      .maybeSingle(),
    supabase.from('companies').select('*').order('name'),
    supabase.from('college_subjects').select('*').order('name'),
  ])

  companies.value = (companiesRes.data as Company[]) ?? []
  subjects.value = (subjectsRes.data as CollegeSubject[]) ?? []

  if (taskRes.error || !taskRes.data) {
    loadError.value = 'Tarefa não encontrada.'
    task.value = null
    loading.value = false
    return
  }

  const data = taskRes.data as Task
  task.value = data
  form.value = {
    title: data.title,
    description: data.description ?? '',
    due_date: data.due_date ? data.due_date.slice(0, 16) : '',
    status: data.status,
    category: data.category,
    company_id: data.company_id ?? '',
    subject_id: data.subject_id ?? '',
  }
  loading.value = false
}

onMounted(load)
watch(taskId, load)

async function save() {
  if (!task.value || !form.value.title.trim()) return
  saving.value = true
  const { error } = await supabase
    .from('tasks')
    .update({
      title: form.value.title.trim(),
      description: form.value.description || null,
      due_date: form.value.due_date ? new Date(form.value.due_date).toISOString() : null,
      status: form.value.status,
      category: form.value.category,
      company_id:
        form.value.category === 'Freelance' || form.value.category === 'Job'
          ? form.value.company_id || null
          : null,
      subject_id: form.value.category === 'College' ? form.value.subject_id || null : null,
    })
    .eq('id', task.value.id)

  saving.value = false
  if (error) return
  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 1600)
}

function goBack() {
  router.push({ name: form.value.category === 'Lembrete' ? 'reminders' : 'tasks' })
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
            <p class="text-[11px] uppercase tracking-widest text-gray-500">
              {{ isReminder ? 'Editor de lembrete' : 'Editor de tarefa' }}
            </p>
            <p class="text-sm text-gray-300 truncate">{{ form.title || 'Sem título' }}</p>
          </div>
        </div>
        <button type="button" class="btn-primary" :disabled="saving || loading" @click="save">
          <Save :size="16" />
          {{ saving ? 'Salvando...' : savedFlash ? 'Salvo!' : 'Salvar descrição' }}
        </button>
      </div>
    </header>

    <div class="flex-1 px-4 sm:px-6 lg:px-8 py-6">
      <div class="max-w-5xl mx-auto">
        <p v-if="loading" class="text-sm text-gray-500">Carregando...</p>
        <p v-else-if="loadError" class="text-sm text-sandy">{{ loadError }}</p>

        <div v-else class="space-y-5">
          <div>
            <label class="label">Título</label>
            <input
              v-model="form.title"
              class="input !text-xl !font-semibold !py-3"
              placeholder="Título da tarefa"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="label">Categoria</label>
              <select v-if="!isReminder" v-model="form.category" class="input">
                <option v-for="c in taskCategories" :key="c" :value="c">{{ categoryLabel[c] }}</option>
              </select>
              <input v-else class="input" disabled value="Lembrete" />
            </div>
            <div>
              <label class="label">Status</label>
              <select v-model="form.status" class="input">
                <option v-for="s in statuses" :key="s" :value="s">{{ statusLabel[s] }}</option>
              </select>
            </div>
            <div v-if="form.category === 'Freelance' || form.category === 'Job'">
              <label class="label">Empresa</label>
              <select v-model="form.company_id" class="input">
                <option value="">Nenhuma</option>
                <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div v-if="form.category === 'College'">
              <label class="label">Matéria</label>
              <select v-model="form.subject_id" class="input">
                <option value="">Nenhuma</option>
                <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label class="label">Prazo</label>
              <input v-model="form.due_date" type="datetime-local" class="input" />
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <StatusBadge :label="categoryLabel[form.category]" :variant="categoryVariant[form.category]" />
            <StatusBadge :label="statusLabel[form.status]" variant="info" />
          </div>

          <div>
            <label class="label">Descrição</label>
            <NoteRichEditor
              v-model="form.description"
              tall
              placeholder="Detalhes da tarefa, checklist, links..."
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
