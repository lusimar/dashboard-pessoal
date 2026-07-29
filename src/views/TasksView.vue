<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CheckSquare, Plus, Pencil, Trash2, Circle, LoaderCircle, CheckCircle2 } from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { formatDateTime, isOverdue } from '../composables/useFormat'
import type { CollegeSubject, Company, Task, TaskCategory, TaskStatus } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const { user } = useAuth()
const tasks = ref<Task[]>([])
const companies = ref<Company[]>([])
const subjects = ref<CollegeSubject[]>([])
const loading = ref(true)
const saving = ref(false)
const modalOpen = ref(false)
const editing = ref<Task | null>(null)
const filterCategory = ref<'all' | Exclude<TaskCategory, 'Lembrete'>>('all')
const saveError = ref('')

const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Completed']
const categories: Exclude<TaskCategory, 'Lembrete'>[] = ['Personal', 'College', 'Job', 'Freelance']

const statusMeta: Record<TaskStatus, { label: string; icon: typeof Circle; accent: string }> = {
  Pending: { label: 'Pendente', icon: Circle, accent: 'text-gold' },
  'In Progress': { label: 'Em andamento', icon: LoaderCircle, accent: 'text-slate-light' },
  Completed: { label: 'Concluída', icon: CheckCircle2, accent: 'text-teal' },
}

const categoryLabel: Record<Exclude<TaskCategory, 'Lembrete'>, string> = {
  Personal: 'Pessoal',
  College: 'Faculdade',
  Job: 'Trabalho',
  Freelance: 'Freelance',
}

const categoryVariant: Record<Exclude<TaskCategory, 'Lembrete'>, 'neutral' | 'info' | 'warning' | 'urgent'> = {
  Personal: 'neutral',
  College: 'info',
  Job: 'warning',
  Freelance: 'urgent',
}

const form = ref({
  title: '',
  due_date: '',
  status: 'Pending' as TaskStatus,
  category: 'Personal' as Exclude<TaskCategory, 'Lembrete'>,
  company_id: '',
  subject_id: '',
})

async function fetchData() {
  const [tasksRes, companiesRes, subjectsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, companies(name), college_subjects(name)')
      .neq('category', 'Lembrete')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('companies').select('*').order('name'),
    supabase.from('college_subjects').select('*').order('name'),
  ])
  tasks.value = (tasksRes.data as Task[]) ?? []
  companies.value = (companiesRes.data as Company[]) ?? []
  subjects.value = (subjectsRes.data as CollegeSubject[]) ?? []
  loading.value = false
}

onMounted(fetchData)

const filtered = computed(() =>
  filterCategory.value === 'all' ? tasks.value : tasks.value.filter((t) => t.category === filterCategory.value),
)

const byStatus = computed(() => {
  const groups: Record<TaskStatus, Task[]> = { Pending: [], 'In Progress': [], Completed: [] }
  for (const task of filtered.value) groups[task.status].push(task)
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
  form.value = {
    title: '',
    due_date: '',
    status: 'Pending',
    category: 'Personal',
    company_id: '',
    subject_id: '',
  }
  modalOpen.value = true
}

function openEdit(task: Task) {
  router.push({ name: 'task-editor', params: { id: task.id } })
}

async function save() {
  if (!form.value.title.trim() || !user.value) return
  saving.value = true
  saveError.value = ''
  const payload = {
    title: form.value.title.trim(),
    due_date: form.value.due_date ? new Date(form.value.due_date).toISOString() : null,
    status: form.value.status,
    category: form.value.category,
    company_id:
      form.value.category === 'Freelance' || form.value.category === 'Job'
        ? form.value.company_id || null
        : null,
    subject_id: form.value.category === 'College' ? form.value.subject_id || null : null,
  }

  if (editing.value) {
    const { error } = await supabase.from('tasks').update(payload).eq('id', editing.value.id)
    saving.value = false
    if (error) {
      saveError.value = error.message
      return
    }
    modalOpen.value = false
    await fetchData()
    return
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...payload, description: '', user_id: user.value.id })
    .select('id')
    .single()

  saving.value = false
  if (error) {
    saveError.value = error.message
    return
  }

  modalOpen.value = false
  if (data?.id) router.push({ name: 'task-editor', params: { id: data.id } })
  else await fetchData()
}

async function moveTo(task: Task, status: TaskStatus) {
  await supabase.from('tasks').update({ status }).eq('id', task.id)
  await fetchData()
}

async function remove(task: Task) {
  if (!confirm(`Excluir "${task.title}"?`)) return
  await supabase.from('tasks').delete().eq('id', task.id)
  await fetchData()
}
</script>

<template>
  <PageHeader title="Tarefas" subtitle="Pessoal, faculdade, trabalho e freelas">
    <template #actions>
      <button class="btn-primary" @click="openCreate">
        <Plus :size="16" /> Nova tarefa
      </button>
    </template>
  </PageHeader>

  <div class="flex flex-wrap gap-2 mb-6">
    <button
      class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
      :class="filterCategory === 'all' ? 'bg-teal/10 text-teal border-teal/30' : 'text-gray-400 border-white/10 hover:border-white/25'"
      @click="filterCategory = 'all'"
    >
      Todas
    </button>
    <button
      v-for="category in categories"
      :key="category"
      class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
      :class="filterCategory === category ? 'bg-teal/10 text-teal border-teal/30' : 'text-gray-400 border-white/10 hover:border-white/25'"
      @click="filterCategory = category"
    >
      {{ categoryLabel[category] }}
    </button>
  </div>

  <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>
  <EmptyState v-else-if="filtered.length === 0" :icon="CheckSquare" message="Nenhuma tarefa encontrada." />

  <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
    <section v-for="status in statuses" :key="status" class="bg-carbon-light/50 border border-white/5 rounded-xl p-4">
      <div class="flex items-center gap-2 mb-4">
        <component :is="statusMeta[status].icon" :size="16" :class="statusMeta[status].accent" />
        <h2 class="text-sm font-semibold text-white">{{ statusMeta[status].label }}</h2>
        <span class="ml-auto text-xs text-gray-500 bg-white/5 rounded-full px-2 py-0.5">
          {{ byStatus[status].length }}
        </span>
      </div>

      <p v-if="byStatus[status].length === 0" class="text-xs text-gray-600 text-center py-6">Nada aqui.</p>

      <div class="space-y-3">
        <article v-for="task in byStatus[status]" :key="task.id" class="card !p-4">
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="text-left text-sm font-medium text-gray-100 hover:text-teal"
              :class="{ 'line-through text-gray-500': task.status === 'Completed' }"
              @click="openEdit(task)"
            >
              {{ task.title }}
            </button>
            <div class="flex gap-0.5 shrink-0">
              <button class="p-1 rounded text-gray-500 hover:text-teal hover:bg-teal/10" title="Abrir descrição" @click="openEdit(task)">
                <Pencil :size="13" />
              </button>
              <button class="p-1 rounded text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="remove(task)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>

          <p v-if="task.description" class="text-xs text-gray-500 mt-1.5 line-clamp-2">
            {{ stripHtml(task.description) }}
          </p>

          <div class="flex flex-wrap items-center gap-2 mt-3">
            <StatusBadge
              v-if="task.category !== 'Lembrete'"
              :label="categoryLabel[task.category as Exclude<TaskCategory, 'Lembrete'>]"
              :variant="categoryVariant[task.category as Exclude<TaskCategory, 'Lembrete'>]"
            />
            <span
              v-if="task.companies?.name || task.college_subjects?.name"
              class="text-[11px] text-gray-500 truncate"
            >
              {{ task.companies?.name ?? task.college_subjects?.name }}
            </span>
          </div>

          <p
            v-if="task.due_date"
            class="text-xs mt-2"
            :class="task.status !== 'Completed' && isOverdue(task.due_date) ? 'text-sandy font-medium' : 'text-gray-500'"
          >
            {{ formatDateTime(task.due_date) }}
            <span v-if="task.status !== 'Completed' && isOverdue(task.due_date)"> · atrasada</span>
          </p>

          <div class="flex gap-1.5 mt-3 pt-3 border-t border-white/5">
            <button
              v-for="target in statuses.filter((s) => s !== task.status)"
              :key="target"
              class="text-[11px] font-medium px-2 py-1 rounded-md bg-white/5 text-gray-400 hover:text-white hover:bg-slate/40 transition-colors"
              @click="moveTo(task, target)"
            >
              → {{ statusMeta[target].label }}
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>

  <AppModal :open="modalOpen" :title="editing ? 'Editar tarefa' : 'Nova tarefa'" @close="modalOpen = false">
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label">Título *</label>
        <input v-model="form.title" required class="input" placeholder="O que precisa ser feito?" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Categoria *</label>
          <select v-model="form.category" class="input">
            <option v-for="category in categories" :key="category" :value="category">
              {{ categoryLabel[category] }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option v-for="status in statuses" :key="status" :value="status">{{ statusMeta[status].label }}</option>
          </select>
        </div>
      </div>
      <div v-if="form.category === 'Freelance' || form.category === 'Job'">
        <label class="label">Empresa</label>
        <select v-model="form.company_id" class="input">
          <option value="">Nenhuma</option>
          <option v-for="company in companies" :key="company.id" :value="company.id">{{ company.name }}</option>
        </select>
      </div>
      <div v-if="form.category === 'College'">
        <label class="label">Matéria</label>
        <select v-model="form.subject_id" class="input">
          <option value="">Nenhuma</option>
          <option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
        </select>
      </div>
      <div>
        <label class="label">Prazo</label>
        <input v-model="form.due_date" type="datetime-local" class="input" />
      </div>
      <p v-if="saveError" class="text-sm text-sandy">{{ saveError }}</p>
      <p v-if="!editing" class="text-xs text-gray-500">
        Ao salvar, a página de descrição em tela cheia será aberta.
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
