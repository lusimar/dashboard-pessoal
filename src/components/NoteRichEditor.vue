<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { Extension } from '@tiptap/core'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
  Link2,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
} from 'lucide-vue-next'

const MAX_INDENT = 8

const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute('data-indent')
              const n = raw ? Number.parseInt(raw, 10) : 0
              return Number.isFinite(n) ? Math.min(MAX_INDENT, Math.max(0, n)) : 0
            },
            renderHTML: (attributes) => {
              const level = Number(attributes.indent) || 0
              if (!level) return {}
              return {
                'data-indent': String(level),
                style: `margin-left: ${level * 1.5}rem`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      indent:
        () =>
        ({ editor, chain }) => {
          const type = editor.isActive('heading') ? 'heading' : 'paragraph'
          const current = Number(editor.getAttributes(type).indent) || 0
          return chain()
            .focus()
            .updateAttributes(type, { indent: Math.min(MAX_INDENT, current + 1) })
            .run()
        },
      outdent:
        () =>
        ({ editor, chain }) => {
          const type = editor.isActive('heading') ? 'heading' : 'paragraph'
          const current = Number(editor.getAttributes(type).indent) || 0
          return chain()
            .focus()
            .updateAttributes(type, { indent: Math.max(0, current - 1) })
            .run()
        },
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    /** Editor alto para página de conteúdo em tela cheia */
    tall?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: 'Escreva sua anotação...',
    tall: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2] },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-teal underline' },
    }),
    Placeholder.configure({ placeholder: props.placeholder }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    Indent,
  ],
  content: props.modelValue || '',
  editorProps: {
    attributes: {
      class: props.tall
        ? 'prose prose-invert prose-sm max-w-none min-h-[calc(100vh-280px)] px-5 py-5 focus:outline-none text-gray-200 text-base'
        : 'prose prose-invert prose-sm max-w-none min-h-[280px] px-4 py-3 focus:outline-none text-gray-200',
    },
  },
  onUpdate: ({ editor: ed }) => {
    emit('update:modelValue', ed.getHTML())
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return
    const current = editor.value.getHTML()
    const next = value || ''
    if (next !== current) {
      editor.value.commands.setContent(next, { emitUpdate: false })
    }
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function toggleLink() {
  if (!editor.value) return
  const previous = editor.value.getAttributes('link').href as string | undefined
  const url = window.prompt('URL do link', previous || 'https://')
  if (url === null) return
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function indent() {
  if (!editor.value) return
  if (editor.value.can().sinkListItem('listItem')) {
    editor.value.chain().focus().sinkListItem('listItem').run()
    return
  }
  editor.value.chain().focus().indent().run()
}

function outdent() {
  if (!editor.value) return
  if (editor.value.can().liftListItem('listItem')) {
    editor.value.chain().focus().liftListItem('listItem').run()
    return
  }
  editor.value.chain().focus().outdent().run()
}

function btnClass(active: boolean) {
  return active
    ? 'bg-teal/20 text-teal border-teal/40'
    : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
}
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-carbon overflow-hidden" :class="tall ? 'min-h-[calc(100vh-240px)]' : ''">
    <div
      v-if="editor"
      class="flex flex-wrap gap-1 px-2 py-2 border-b border-white/5 bg-carbon-light sticky top-0 z-10"
    >
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('bold'))"
        title="Negrito"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <Bold :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('italic'))"
        title="Itálico"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <Italic :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('heading', { level: 1 }))"
        title="Título H1"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        <Heading1 :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('heading', { level: 2 }))"
        title="Título H2"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        <Heading2 :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('bulletList'))"
        title="Lista"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <List :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('orderedList'))"
        title="Lista numerada"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('codeBlock'))"
        title="Bloco de código"
        @click="editor.chain().focus().toggleCodeBlock().run()"
      >
        <Code :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive('link'))"
        title="Link"
        @click="toggleLink"
      >
        <Link2 :size="15" />
      </button>

      <span class="w-px h-6 bg-white/10 mx-1 self-center" />

      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive({ textAlign: 'left' }))"
        title="Alinhar à esquerda"
        @click="editor.chain().focus().setTextAlign('left').run()"
      >
        <AlignLeft :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive({ textAlign: 'center' }))"
        title="Centralizar"
        @click="editor.chain().focus().setTextAlign('center').run()"
      >
        <AlignCenter :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive({ textAlign: 'right' }))"
        title="Alinhar à direita"
        @click="editor.chain().focus().setTextAlign('right').run()"
      >
        <AlignRight :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border"
        :class="btnClass(editor.isActive({ textAlign: 'justify' }))"
        title="Justificar"
        @click="editor.chain().focus().setTextAlign('justify').run()"
      >
        <AlignJustify :size="15" />
      </button>

      <span class="w-px h-6 bg-white/10 mx-1 self-center" />

      <button
        type="button"
        class="p-1.5 rounded border border-transparent text-gray-400 hover:text-white hover:bg-white/5"
        title="Aumentar recuo"
        @click="indent"
      >
        <IndentIncrease :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border border-transparent text-gray-400 hover:text-white hover:bg-white/5"
        title="Diminuir recuo"
        @click="outdent"
      >
        <IndentDecrease :size="15" />
      </button>

      <span class="w-px h-6 bg-white/10 mx-1 self-center" />

      <button
        type="button"
        class="p-1.5 rounded border border-transparent text-gray-400 hover:text-white hover:bg-white/5"
        title="Desfazer"
        @click="editor.chain().focus().undo().run()"
      >
        <Undo2 :size="15" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded border border-transparent text-gray-400 hover:text-white hover:bg-white/5"
        title="Refazer"
        @click="editor.chain().focus().redo().run()"
      >
        <Redo2 :size="15" />
      </button>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style>
.tiptap p.is-editor-empty:first-child::before {
  color: #6b7280;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.tiptap h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0.5rem 0;
}
.tiptap h2 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0.4rem 0;
}
.tiptap ul {
  list-style: disc;
  padding-left: 1.25rem;
}
.tiptap ol {
  list-style: decimal;
  padding-left: 1.25rem;
}
.tiptap pre {
  background: #0b0c0e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
  overflow-x: auto;
}
.tiptap code {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}
.tiptap [style*='text-align: center'] {
  text-align: center;
}
.tiptap [style*='text-align: right'] {
  text-align: right;
}
.tiptap [style*='text-align: justify'] {
  text-align: justify;
}
</style>
