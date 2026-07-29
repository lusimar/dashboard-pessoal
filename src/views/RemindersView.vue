<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Plus, Pencil, Trash2, Circle, CheckCircle2 } from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { formatDateTime, isOverdue } from '../composables/useFormat'
import type { Task, TaskStatus } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const { user } = useAuth()
const reminders = ref<Task[]>([])
const loading = ref(true)
const saving = ref(false)
const modalOpen = ref(false)
const saveError = ref('')
const editing = ref<Task | null>(null)

const form = ref({
  title: '',
  due_date: '',
  status: 'Pending' as TaskStatus,
})

async function fetchData() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('category', 'Lembrete')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error(error)
    saveError.value =
      error.message.includes('category') || error.code === '23514'
        ? 'Categoria Lembrete não habilitada no banco. Execute o SQL supabase/13_college_period_notes.sql'
        : error.message
  } else {
    saveError.value = ''
  }

  reminders.value = (data as Task[]) ?? []
  loading.value = false
}

onMounted(fetchData)

const openReminders = computed(() => reminders.value.filter((t) => t.status !== 'Completed'))
const doneReminders = computed(() => reminders.value.filter((t) => t.status === 'Completed'))

function stripHtml(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || el.innerText || '').trim()
}

function openCreate() {
  editing.value = null
  form.value = { title: '', due_date: '', status: 'Pending' }
  saveError.value = ''
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
    category: 'Lembrete' as const,
    company_id: null,
    subject_id: null,
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
    saveError.value =
      error.message.includes('category') || error.code === '23514'
        ? 'Não foi possível criar o lembrete: execute supabase/09_task_lembrete.sql ou 13_college_period_notes.sql no Supabase.'
        : error.message
    return
  }

  modalOpen.value = false
  if (data?.id) {
    router.push({ name: 'task-editor', params: { id: data.id } })
  } else {
    await fetchData()
  }
}

async function toggleDone(task: Task) {
  const next: TaskStatus = task.status === 'Completed' ? 'Pending' : 'Completed'
  await supabase.from('tasks').update({ status: next }).eq('id', task.id)
  await fetchData()
}

async function remove(task: Task) {
  if (!confirm(`Excluir lembrete "${task.title}"?`)) return
  await supabase.from('tasks').delete().eq('id', task.id)
  await fetchData()
}
</script>

<template>
  <PageHeader title="Lembretes" subtitle="Avisos e compromissos separados das tarefas">
    <template #actions>
      <button class="btn-primary" @click="openCreate">
        <Plus :size="16" /> Novo lembrete
      </button>
    </template>
  </PageHeader>

  <p v-if="saveError && !modalOpen" class="mb-4 text-sm text-sandy bg-sandy/10 border border-sandy/20 rounded-lg px-3 py-2">
    {{ saveError }}
  </p>

  <div v-if="loading" class="text-sm text-gray-500">Carregando...</div>
  <EmptyState
    v-else-if="reminders.length === 0"
    :icon="Bell"
    message="Nenhum lembrete ainda. Crie o primeiro."
  />

  <div v-else class="space-y-8">
    <section>
      <div class="flex items-center gap-2 mb-4">
        <Circle :size="16" class="text-gold" />
        <h2 class="text-sm font-semibold text-white">Ativos</h2>
        <span class="text-xs text-gray-500 bg-white/5 rounded-full px-2 py-0.5">{{ openReminders.length }}</span>
      </div>
      <p v-if="openReminders.length === 0" class="text-xs text-gray-600 py-4">Nenhum lembrete ativo.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <article v-for="task in openReminders" :key="task.id" class="card !p-4">
          <div class="flex items-start justify-between gap-2">
            <button type="button" class="text-left text-sm font-medium text-white hover:text-teal" @click="openEdit(task)">
              {{ task.title }}
            </button>
            <div class="flex gap-0.5 shrink-0">
              <button class="p-1 rounded text-gray-500 hover:text-teal hover:bg-teal/10" title="Concluir" @click="toggleDone(task)">
                <CheckCircle2 :size="14" />
              </button>
              <button class="p-1 rounded text-gray-500 hover:text-teal hover:bg-teal/10" @click="openEdit(task)">
                <Pencil :size="13" />
              </button>
              <button class="p-1 rounded text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="remove(task)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
          <p v-if="task.description" class="text-xs text-gray-500 mt-1.5 line-clamp-2">{{ stripHtml(task.description) }}</p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge label="Lembrete" variant="warning" />
            <span
              v-if="task.due_date"
              class="text-xs"
              :class="isOverdue(task.due_date) ? 'text-sandy font-medium' : 'text-gray-500'"
            >
              {{ formatDateTime(task.due_date) }}
              <span v-if="isOverdue(task.due_date)"> · atrasado</span>
            </span>
          </div>
        </article>
      </div>
    </section>

    <section v-if="doneReminders.length">
      <div class="flex items-center gap-2 mb-4">
        <CheckCircle2 :size="16" class="text-teal" />
        <h2 class="text-sm font-semibold text-white">Concluídos</h2>
      </div>
      <div class="space-y-2">
        <article
          v-for="task in doneReminders"
          :key="task.id"
          class="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-carbon-light/50 border border-white/5"
        >
          <button type="button" class="text-sm text-gray-500 line-through hover:text-teal" @click="openEdit(task)">
            {{ task.title }}
          </button>
          <div class="flex gap-1">
            <button class="p-1 rounded text-gray-500 hover:text-gold hover:bg-gold/10" title="Reabrir" @click="toggleDone(task)">
              <Circle :size="14" />
            </button>
            <button class="p-1 rounded text-gray-500 hover:text-sandy hover:bg-sandy/10" @click="remove(task)">
              <Trash2 :size="13" />
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>

  <AppModal :open="modalOpen" title="Novo lembrete" @close="modalOpen = false">
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label">Título *</label>
        <input v-model="form.title" required class="input" placeholder="O que lembrar?" />
      </div>
      <div>
        <label class="label">Quando</label>
        <input v-model="form.due_date" type="datetime-local" class="input" />
      </div>
      <p v-if="saveError" class="text-sm text-sandy">{{ saveError }}</p>
      <p class="text-xs text-gray-500">Ao salvar, a descrição em tela cheia será aberta.</p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="modalOpen = false">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando...' : 'Salvar e escrever' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
