<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, Copy, Save } from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import type { Company, Note, NoteCategory, NoteStatus, NoteType } from '../types'
import NoteRichEditor from '../components/NoteRichEditor.vue'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const router = useRouter()

const note = ref<Note | null>(null)
const categories = ref<NoteCategory[]>([])
const companies = ref<Company[]>([])
const loading = ref(true)
const saving = ref(false)
const savedFlash = ref(false)
const copied = ref(false)
const loadError = ref('')

const form = ref({
  title: '',
  content: '',
  type: 'General' as NoteType,
  status: 'Active' as NoteStatus,
  category_id: '',
  company_id: '',
})

const typeOptions: NoteType[] = ['Draft', 'Credentials', 'LinkedIn', 'General', 'Document']
const statusOptions: NoteStatus[] = ['Active', 'In Progress', 'Published', 'Archived']

const typeLabel: Record<NoteType, string> = {
  Draft: 'Rascunho',
  Credentials: 'Acessos',
  LinkedIn: 'Post LinkedIn',
  General: 'Geral',
  Document: 'Documento',
}

const statusLabel: Record<NoteStatus, string> = {
  Active: 'Ativo',
  Archived: 'Arquivado',
  'In Progress': 'Em Andamento',
  Published: 'Publicado',
}

const placeholder = computed(() => {
  if (form.value.type === 'LinkedIn') return 'Escreva o post com negrito/itálico para colar no LinkedIn...'
  if (form.value.type === 'Credentials') return 'E-mails, senhas, links de acesso...'
  return 'Escreva o conteúdo da anotação...'
})

const noteId = computed(() => String(route.params.id))

async function load() {
  loading.value = true
  loadError.value = ''
  const [noteRes, catRes, companiesRes] = await Promise.all([
    supabase
      .from('notes')
      .select('*, note_categories(id, name, color), companies(name)')
      .eq('id', noteId.value)
      .maybeSingle(),
    supabase.from('note_categories').select('*').order('name'),
    supabase.from('companies').select('id, name').order('name'),
  ])

  categories.value = (catRes.data as NoteCategory[]) ?? []
  companies.value = (companiesRes.data as Company[]) ?? []

  if (noteRes.error || !noteRes.data) {
    loadError.value = 'Anotação não encontrada.'
    note.value = null
    loading.value = false
    return
  }

  const data = noteRes.data as Note
  note.value = data
  form.value = {
    title: data.title,
    content: data.content ?? '',
    type: data.type,
    status: data.status,
    category_id: data.category_id ?? '',
    company_id: data.company_id ?? '',
  }
  loading.value = false
}

onMounted(load)
watch(noteId, load)

async function save() {
  if (!note.value || !form.value.title.trim()) return
  saving.value = true
  const { error } = await supabase
    .from('notes')
    .update({
      title: form.value.title.trim(),
      content: form.value.content || '',
      type: form.value.type,
      status: form.value.status,
      category_id: form.value.category_id || null,
      company_id: form.value.company_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', note.value.id)

  saving.value = false
  if (error) return

  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 1600)
}

function goBack() {
  if (note.value?.company_id) {
    router.push({ name: 'companies' })
    return
  }
  router.push({ name: 'notes' })
}

function stripHtml(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent || el.innerText || ''
}

async function copyContent() {
  try {
    await navigator.clipboard.writeText(stripHtml(form.value.content))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* clipboard indisponível */
  }
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
            <p class="text-[11px] uppercase tracking-widest text-gray-500">Editor de anotação</p>
            <p class="text-sm text-gray-300 truncate">{{ form.title || 'Sem título' }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="form.type === 'Credentials' || form.type === 'LinkedIn'"
            type="button"
            class="btn-ghost"
            @click="copyContent"
          >
            <Check v-if="copied" :size="16" class="text-teal" />
            <Copy v-else :size="16" />
            {{ copied ? 'Copiado' : 'Copiar' }}
          </button>
          <button type="button" class="btn-primary" :disabled="saving || loading" @click="save">
            <Save :size="16" />
            {{ saving ? 'Salvando...' : savedFlash ? 'Salvo!' : 'Salvar conteúdo' }}
          </button>
        </div>
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
              placeholder="Título da anotação"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="label">Categoria</label>
              <select v-model="form.category_id" class="input">
                <option value="">Avulsa (sem pasta)</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
              </select>
            </div>
            <div>
              <label class="label">Empresa</label>
              <select v-model="form.company_id" class="input">
                <option value="">Nenhuma</option>
                <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="label">Tipo</label>
              <select v-model="form.type" class="input">
                <option v-for="t in typeOptions" :key="t" :value="t">{{ typeLabel[t] }}</option>
              </select>
            </div>
            <div>
              <label class="label">Status</label>
              <select v-model="form.status" class="input">
                <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabel[s] }}</option>
              </select>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <StatusBadge :label="typeLabel[form.type]" variant="info" />
            <StatusBadge :label="statusLabel[form.status]" variant="success" />
          </div>

          <div>
            <label class="label">Conteúdo</label>
            <NoteRichEditor v-model="form.content" tall :placeholder="placeholder" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
