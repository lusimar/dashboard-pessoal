<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { supabase } from '../composables/useSupabase'
import { useAuth } from '../composables/useAuth'
import { formatCurrency } from '../composables/useFormat'
import type { ContractAddendum } from '../types'
import AppModal from './AppModal.vue'

const props = defineProps<{
  open: boolean
  companyId: string
  companyName: string
  editing?: ContractAddendum | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { user } = useAuth()
const saving = ref(false)

const form = ref({
  added_value: '' as string | number,
  period: '' as string | number,
  start_date: '',
  end_date: '',
  payment_day: '' as string | number,
  description: '',
  document_link: '',
})

const formTotal = computed(() => {
  const months = Number(form.value.period) || 0
  const monthly = Number(form.value.added_value) || 0
  return months * monthly
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.editing) {
      form.value = {
        added_value: props.editing.added_value,
        period: props.editing.period ?? '',
        start_date: props.editing.start_date ?? '',
        end_date: props.editing.end_date ?? '',
        payment_day: props.editing.payment_day ?? '',
        description: props.editing.description ?? '',
        document_link: props.editing.document_link ?? '',
      }
    } else {
      form.value = {
        added_value: '',
        period: '',
        start_date: '',
        end_date: '',
        payment_day: '',
        description: '',
        document_link: '',
      }
    }
  },
)

async function save() {
  saving.value = true
  const payload = {
    company_id: props.companyId,
    added_value: form.value.added_value === '' ? 0 : Number(form.value.added_value),
    period: form.value.period === '' ? null : Number(form.value.period),
    start_date: form.value.start_date || null,
    end_date: form.value.end_date || null,
    payment_day: form.value.payment_day === '' ? null : Number(form.value.payment_day),
    description: form.value.description || null,
    document_link: form.value.document_link || null,
  }
  if (props.editing) {
    await supabase.from('contract_addendums').update(payload).eq('id', props.editing.id)
  } else {
    await supabase.from('contract_addendums').insert({ ...payload, user_id: user.value!.id })
  }
  saving.value = false
  emit('saved')
  emit('close')
}
</script>

<template>
  <AppModal :open="open" :title="editing ? 'Editar aditivo' : `Novo aditivo — ${companyName}`" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="save">
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
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Período (meses) *</label>
          <input
            v-model="form.period"
            type="number"
            min="1"
            step="1"
            required
            class="input"
            placeholder="Ex.: 6"
          />
        </div>
        <div>
          <label class="label">Valor mensal (R$) *</label>
          <input
            v-model="form.added_value"
            type="number"
            step="0.01"
            min="0"
            required
            class="input"
            placeholder="0,00"
          />
        </div>
      </div>
      <div class="rounded-lg border border-teal/30 bg-teal/10 px-3.5 py-3 flex items-center justify-between gap-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-teal">Total do aditivo</span>
        <span class="text-lg font-bold text-teal">
          {{ formatCurrency(formTotal) }}
          <span class="text-xs font-normal text-teal/70 ml-1">
            ({{ form.period || 0 }} × {{ formatCurrency(Number(form.added_value) || 0) }})
          </span>
        </span>
      </div>
      <div>
        <label class="label">Dia de vencimento</label>
        <input v-model="form.payment_day" type="number" min="1" max="31" class="input" placeholder="Ex.: 10" />
      </div>
      <div>
        <label class="label">Link do documento do aditivo</label>
        <input v-model="form.document_link" type="url" class="input" placeholder="https://..." />
      </div>
      <div>
        <label class="label">Descrição</label>
        <textarea v-model="form.description" rows="2" class="input resize-none" placeholder="Detalhes do aditivo (opcional)" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando...' : 'Salvar aditivo' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
