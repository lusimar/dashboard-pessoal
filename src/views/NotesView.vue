<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Folder,
  MoreVertical,
  ArrowLeft,
  FolderInput,
  Copy,
  Check,
} from 'lucide-vue-next'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { formatDate } from '../composables/useFormat'
import type { Company, Note, NoteCategory, NoteStatus, NoteType } from '../types'
import PageHeader from '../components/PageHeader.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const { user } = useAuth()

const categories = ref<NoteCategory[]>([])
const notes = ref<Note[]>([])
const companies = ref<Company[]>([])
const loading = ref(true)
const saving = ref(false)

const selectedCategoryId = ref<string | null | 'uncategorized'>(null)
const menuOpenId = ref<string | null>(null)

const categoryModalOpen = ref(false)
const noteModalOpen = ref(false)
const moveModalOpen = ref(false)
const editingCategory = ref<NoteCategory | null>(null)
const editingNote = ref<Note | null>(null)
const movingNote = ref<Note | null>(null)
const copiedId = ref<string | null>(null)

const COLOR_OPTIONS = ['#28afb0', '#19647e', '#f4d35e', '#ee964b', '#a78bfa', '#f87171', '#34d399', '#60a5fa']

const typeOptions: NoteType[] = ['Draft', 'Credentials', 'LinkedIn', 'General', 'Document']
const statusOptions: NoteStatus[] = ['Active', 'In Progress', 'Published', 'Archived']

const typeLabel: Record<NoteType, string> = {
  Draft: 'Rascunho',
  Credentials: 'Acessos',
  LinkedIn: 'Post LinkedIn',
  General: 'Geral',
  Document: 'Documento',
}

const typeVariant: Record<NoteType, 'neutral' | 'info' | 'warning' | 'urgent' | 'success'> = {
  Draft: 'neutral',
  Credentials: 'urgent',
  LinkedIn: 'info',
  General: 'success',
  Document: 'warning',
}

const statusLabel: Record<NoteStatus, string> = {
  Active: 'Ativo',
  Archived: 'Arquivado',
  'In Progress': 'Em Andamento',
  Published: 'Publicado',
}

const statusVariant: Record<NoteStatus, 'success' | 'warning' | 'urgent' | 'info' | 'neutral'> = {
  Active: 'success',
  Archived: 'neutral',
  'In Progress': 'warning',
  Published: 'info',
}

const categoryForm = ref({ name: '', color: '#28afb0' })
const noteForm = ref({
  title: '',
  type: 'General' as NoteType,
  status: 'Active' as NoteStatus,
  category_id: '' as string,
  company_id: '' as string,
})
const moveCategoryId = ref('')

const noteCounts = computed(() => {
  const map = new Map<string, number>()
  let uncategorized = 0
  for (const note of notes.value) {
    if (note.category_id) {
      map.set(note.category_id, (map.get(note.category_id) ?? 0) + 1)
    } else {
      uncategorized += 1
    }
  }
  return { map, uncategorized }
})

const selectedCategory = computed(() => {
  if (!selectedCategoryId.value || selectedCategoryId.value === 'uncategorized') return null
  return categories.value.find((c) => c.id === selectedCategoryId.value) ?? null
})

const listedNotes = computed(() => {
  if (selectedCategoryId.value === 'uncategorized') {
    return notes.value.filter((n) => !n.category_id)
  }
  if (selectedCategoryId.value) {
    return notes.value.filter((n) => n.category_id === selectedCategoryId.value)
  }
  return []
})

const listTitle = computed(() => {
  if (selectedCategoryId.value === 'uncategorized') return 'Anotações avulsas'
  return selectedCategory.value?.name ?? 'Anotações'
})

async function fetchData() {
  const [catRes, notesRes, companiesRes] = await Promise.all([
    supabase.from('note_categories').select('*').order('name'),
    supabase
      .from('notes')
      .select('*, note_categories(id, name, color), companies(name)')
      .order('updated_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
  ])
  categories.value = (catRes.data as NoteCategory[]) ?? []
  notes.value = (notesRes.data as Note[]) ?? []
  companies.value = (companiesRes.data as Company[]) ?? []
  loading.value = false
}

onMounted(fetchData)

function openCategoryCreate() {
  editingCategory.value = null
  categoryForm.value = { name: '', color: '#28afb0' }
  categoryModalOpen.value = true
  menuOpenId.value = null
}

function openCategoryEdit(cat: NoteCategory) {
  editingCategory.value = cat
  categoryForm.value = { name: cat.name, color: cat.color || '#28afb0' }
  categoryModalOpen.value = true
  menuOpenId.value = null
}

async function saveCategory() {
  if (!categoryForm.value.name.trim()) return
  saving.value = true
  const payload = {
    name: categoryForm.value.name.trim(),
    color: categoryForm.value.color,
    icon: 'folder',
    updated_at: new Date().toISOString(),
  }
  if (editingCategory.value) {
    await supabase.from('note_categories').update(payload).eq('id', editingCategory.value.id)
  } else {
    await supabase.from('note_categories').insert({ ...payload, user_id: user.value!.id })
  }
  saving.value = false
  categoryModalOpen.value = false
  await fetchData()
}

async function removeCategory(cat: NoteCategory) {
  menuOpenId.value = null
  if (!confirm(`Excluir a pasta "${cat.name}"? As anotações ficarão avulsas.`)) return
  await supabase.from('note_categories').delete().eq('id', cat.id)
  if (selectedCategoryId.value === cat.id) selectedCategoryId.value = null
  await fetchData()
}

function openNoteCreate(defaults?: { category_id?: string; company_id?: string }) {
  editingNote.value = null
  noteForm.value = {
    title: '',
    type: 'General',
    status: 'Active',
    category_id:
      defaults?.category_id ??
      (selectedCategoryId.value && selectedCategoryId.value !== 'uncategorized'
        ? selectedCategoryId.value
        : ''),
    company_id: defaults?.company_id ?? '',
  }
  noteModalOpen.value = true
}

function openNoteEdit(note: Note) {
  router.push({ name: 'note-editor', params: { id: note.id } })
}

async function saveNote() {
  if (!noteForm.value.title.trim()) return
  saving.value = true
  const payload = {
    title: noteForm.value.title.trim(),
    type: noteForm.value.type,
    status: noteForm.value.status,
    category_id: noteForm.value.category_id || null,
    company_id: noteForm.value.company_id || null,
    updated_at: new Date().toISOString(),
  }

  if (editingNote.value) {
    await supabase.from('notes').update(payload).eq('id', editingNote.value.id)
    saving.value = false
    noteModalOpen.value = false
    await fetchData()
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
    await fetchData()
    return
  }

  router.push({ name: 'note-editor', params: { id: data.id } })
}

async function removeNote(note: Note) {
  if (!confirm(`Excluir "${note.title}"?`)) return
  await supabase.from('notes').delete().eq('id', note.id)
  await fetchData()
}

function openMove(note: Note) {
  movingNote.value = note
  moveCategoryId.value = note.category_id ?? ''
  moveModalOpen.value = true
}

async function saveMove() {
  if (!movingNote.value) return
  saving.value = true
  await supabase
    .from('notes')
    .update({
      category_id: moveCategoryId.value || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', movingNote.value.id)
  saving.value = false
  moveModalOpen.value = false
  await fetchData()
}

function stripHtml(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent || el.innerText || ''
}

async function copyNoteContent(note: Note) {
  const text = stripHtml(note.content ?? '')
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = note.id
    setTimeout(() => {
      if (copiedId.value === note.id) copiedId.value = null
    }, 1500)
  } catch {
    /* clipboard indisponível */
  }
}
</script>

<template>
  <div>
    <!-- Listagem interna da pasta -->
    <template v-if="selectedCategoryId !== null">
      <PageHeader :title="listTitle" subtitle="Anotações desta pasta">
        <template #actions>
          <button class="btn-ghost" @click="selectedCategoryId = null">
            <ArrowLeft :size="16" /> Voltar
          </button>
          <button class="btn-primary" @click="openNoteCreate()">
            <Plus :size="16" /> Nova anotação
          </button>
        </template>
      </PageHeader>

      <EmptyState
        v-if="!loading && listedNotes.length === 0"
        :icon="StickyNote"
        message="Nenhuma anotação nesta pasta ainda."
      />

      <div v-else class="card !p-0 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-white/5">
              <th class="px-5 py-3 font-semibold">Nome</th>
              <th class="px-5 py-3 font-semibold hidden sm:table-cell">Tipo</th>
              <th class="px-5 py-3 font-semibold hidden md:table-cell">Status</th>
              <th class="px-5 py-3 font-semibold hidden lg:table-cell">Criação</th>
              <th class="px-5 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr v-for="note in listedNotes" :key="note.id" class="hover:bg-white/[0.02]">
              <td class="px-5 py-3">
                <button class="text-left font-medium text-white hover:text-teal" @click="openNoteEdit(note)">
                  {{ note.title }}
                </button>
                <p v-if="note.companies?.name" class="text-xs text-gray-500 mt-0.5">{{ note.companies.name }}</p>
              </td>
              <td class="px-5 py-3 hidden sm:table-cell">
                <StatusBadge :label="typeLabel[note.type]" :variant="typeVariant[note.type]" />
              </td>
              <td class="px-5 py-3 hidden md:table-cell">
                <StatusBadge :label="statusLabel[note.status]" :variant="statusVariant[note.status]" />
              </td>
              <td class="px-5 py-3 text-gray-400 hidden lg:table-cell">{{ formatDate(note.created_at) }}</td>
              <td class="px-5 py-3">
                <div class="flex justify-end gap-1">
                  <button
                    v-if="note.type === 'Credentials' || note.type === 'LinkedIn'"
                    class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10"
                    :title="copiedId === note.id ? 'Copiado!' : 'Copiar conteúdo'"
                    @click="copyNoteContent(note)"
                  >
                    <Check v-if="copiedId === note.id" :size="15" class="text-teal" />
                    <Copy v-else :size="15" />
                  </button>
                  <button class="p-1.5 rounded-lg text-gray-500 hover:text-teal hover:bg-teal/10" title="Abrir editor" @click="openNoteEdit(note)">
                    <Pencil :size="15" />
                  </button>
                  <button class="p-1.5 rounded-lg text-gray-500 hover:text-gold hover:bg-gold/10" title="Mover de pasta" @click="openMove(note)">
                    <FolderInput :size="15" />
                  </button>
                  <button class="p-1.5 rounded-lg text-gray-500 hover:text-sandy hover:bg-sandy/10" title="Excluir" @click="removeNote(note)">
                    <Trash2 :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Grid de pastas -->
    <template v-else>
      <PageHeader title="Anotações" subtitle="Pastas, rascunhos, credenciais e posts">
        <template #actions>
          <button class="btn-ghost" @click="openCategoryCreate">
            <Plus :size="16" /> Nova categoria
          </button>
          <button class="btn-primary" @click="openNoteCreate()">
            <Plus :size="16" /> Nova anotação avulsa
          </button>
        </template>
      </PageHeader>

      <p v-if="loading" class="text-sm text-gray-500">Carregando...</p>

      <EmptyState
        v-else-if="categories.length === 0 && noteCounts.uncategorized === 0"
        :icon="Folder"
        message="Crie sua primeira categoria ou uma anotação avulsa."
      />

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="group relative text-left rounded-2xl bg-zinc-900 border border-white/5 p-5 hover:border-white/15 transition-colors"
          @click="selectedCategoryId = cat.id"
        >
          <div class="flex items-start gap-4">
            <div
              class="p-3 rounded-xl shrink-0"
              :style="{ backgroundColor: `${cat.color || '#28afb0'}22`, color: cat.color || '#28afb0' }"
            >
              <Folder :size="22" />
            </div>
            <div class="min-w-0 flex-1 pr-8">
              <p class="font-bold text-white uppercase tracking-wide truncate">{{ cat.name }}</p>
              <p class="text-xs text-gray-500 mt-1">
                {{ noteCounts.map.get(cat.id) ?? 0 }}
                {{ (noteCounts.map.get(cat.id) ?? 0) === 1 ? 'anotação' : 'anotações' }}
              </p>
            </div>
          </div>

          <div class="absolute top-3 right-3" @click.stop>
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"
              @click="menuOpenId = menuOpenId === cat.id ? null : cat.id"
            >
              <MoreVertical :size="16" />
            </button>
            <div
              v-if="menuOpenId === cat.id"
              class="absolute right-0 mt-1 w-36 rounded-lg bg-carbon-light border border-white/10 shadow-xl z-10 overflow-hidden"
            >
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                @click="openCategoryEdit(cat)"
              >
                <Pencil :size="14" /> Editar
              </button>
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-sm text-sandy hover:bg-sandy/10 flex items-center gap-2"
                @click="removeCategory(cat)"
              >
                <Trash2 :size="14" /> Excluir
              </button>
            </div>
          </div>
        </button>

        <button
          v-if="noteCounts.uncategorized > 0"
          type="button"
          class="text-left rounded-2xl bg-zinc-900 border border-dashed border-white/10 p-5 hover:border-white/20 transition-colors"
          @click="selectedCategoryId = 'uncategorized'"
        >
          <div class="flex items-start gap-4">
            <div class="p-3 rounded-xl bg-white/5 text-gray-400 shrink-0">
              <StickyNote :size="22" />
            </div>
            <div>
              <p class="font-bold text-white uppercase tracking-wide">Avulsas</p>
              <p class="text-xs text-gray-500 mt-1">
                {{ noteCounts.uncategorized }}
                {{ noteCounts.uncategorized === 1 ? 'anotação' : 'anotações' }}
              </p>
            </div>
          </div>
        </button>
      </div>
    </template>

    <!-- Modal categoria -->
    <AppModal
      :open="categoryModalOpen"
      :title="editingCategory ? 'Editar categoria' : 'Nova categoria'"
      @close="categoryModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="saveCategory">
        <div>
          <label class="label">Nome</label>
          <input v-model="categoryForm.name" class="input" required placeholder="Ex.: FREELANCER BLUEZ" />
        </div>
        <div>
          <label class="label">Cor</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in COLOR_OPTIONS"
              :key="color"
              type="button"
              class="w-8 h-8 rounded-full border-2 transition-transform"
              :class="categoryForm.color === color ? 'border-white scale-110' : 'border-transparent'"
              :style="{ backgroundColor: color }"
              @click="categoryForm.color = color"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-ghost" @click="categoryModalOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
        </div>
      </form>
    </AppModal>

    <!-- Modal metadados da anotação -->
    <AppModal
      :open="noteModalOpen"
      :title="editingNote ? 'Editar dados da anotação' : 'Nova anotação'"
      @close="noteModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="saveNote">
        <div>
          <label class="label">Título</label>
          <input v-model="noteForm.title" class="input" required placeholder="Nome da anotação" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">Categoria / Pasta</label>
            <select v-model="noteForm.category_id" class="input">
              <option value="">Avulsa (sem pasta)</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </div>
          <div>
            <label class="label">Empresa (opcional)</label>
            <select v-model="noteForm.company_id" class="input">
              <option value="">Nenhuma</option>
              <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="label">Tipo</label>
            <select v-model="noteForm.type" class="input">
              <option v-for="t in typeOptions" :key="t" :value="t">{{ typeLabel[t] }}</option>
            </select>
          </div>
          <div>
            <label class="label">Status</label>
            <select v-model="noteForm.status" class="input">
              <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabel[s] }}</option>
            </select>
          </div>
        </div>
        <p v-if="!editingNote" class="text-xs text-gray-500">
          Ao salvar, a página de conteúdo em tela cheia será aberta para você descrever a anotação.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-ghost" @click="noteModalOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Salvando...' : editingNote ? 'Salvar' : 'Salvar e escrever' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Modal mover -->
    <AppModal :open="moveModalOpen" title="Mover de pasta" @close="moveModalOpen = false">
      <form class="space-y-4" @submit.prevent="saveMove">
        <div>
          <label class="label">Destino</label>
          <select v-model="moveCategoryId" class="input">
            <option value="">Avulsa (sem pasta)</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="moveModalOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Salvando...' : 'Mover' }}</button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
