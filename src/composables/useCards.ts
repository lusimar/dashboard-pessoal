import { computed, ref } from 'vue'
import { supabase } from './useSupabase'
import { useAuth } from './useAuth'
import type { BankCard, BankCardType, CardStatement, CardStatementStatus } from '../types'

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function statementDueDate(card: BankCard, year: number, month: number): string {
  const day = Math.min(Math.max(1, card.due_day), daysInMonth(year, month))
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

export function periodLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export function useCards() {
  const { user } = useAuth()
  const cards = ref<BankCard[]>([])
  const loading = ref(true)

  const now = new Date()
  const viewYear = ref(now.getFullYear())
  const viewMonth = ref(now.getMonth() + 1)

  const viewLabel = computed(() => periodLabel(viewYear.value, viewMonth.value))

  function prevMonth() {
    if (viewMonth.value === 1) {
      viewMonth.value = 12
      viewYear.value -= 1
    } else {
      viewMonth.value -= 1
    }
  }

  function nextMonth() {
    if (viewMonth.value === 12) {
      viewMonth.value = 1
      viewYear.value += 1
    } else {
      viewMonth.value += 1
    }
  }

  async function fetchCards() {
    loading.value = true
    const { data } = await supabase
      .from('bank_cards')
      .select('*, card_statements(*)')
      .order('created_at', { ascending: false })
    cards.value = (data as BankCard[]) ?? []
    loading.value = false
  }

  function statementFor(
    card: BankCard,
    year = viewYear.value,
    month = viewMonth.value,
  ): CardStatement | undefined {
    return (card.card_statements ?? []).find((s) => s.year === year && s.month === month)
  }

  function historyFor(card: BankCard): CardStatement[] {
    return [...(card.card_statements ?? [])].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }

  async function upsertStatement(
    card: BankCard,
    payload: {
      amount: number
      status?: CardStatementStatus
      due_date?: string | null
      year?: number
      month?: number
    },
  ) {
    const year = payload.year ?? viewYear.value
    const month = payload.month ?? viewMonth.value
    const existing = statementFor(card, year, month)
    const due_date = payload.due_date ?? existing?.due_date ?? statementDueDate(card, year, month)
    const status = payload.status ?? existing?.status ?? 'Pending'

    if (existing) {
      await supabase
        .from('card_statements')
        .update({ amount: payload.amount, status, due_date })
        .eq('id', existing.id)
    } else {
      await supabase.from('card_statements').insert({
        card_id: card.id,
        user_id: user.value!.id,
        year,
        month,
        amount: payload.amount,
        status,
        due_date,
      })
    }
    await fetchCards()
  }

  async function saveCard(input: {
    name: string
    bank: string | null
    type: BankCardType
    due_day: number
    closing_day: number | null
  }, editingId?: string) {
    if (editingId) {
      await supabase.from('bank_cards').update(input).eq('id', editingId)
    } else {
      await supabase.from('bank_cards').insert({ ...input, user_id: user.value!.id })
    }
    await fetchCards()
  }

  async function removeCard(card: BankCard) {
    await supabase.from('bank_cards').delete().eq('id', card.id)
    await fetchCards()
  }

  /** Todas as faturas Pending do período (para o motor financeiro) */
  function pendingStatementsForPeriod(year: number, month: number): Array<CardStatement & { card: BankCard }> {
    const result: Array<CardStatement & { card: BankCard }> = []
    for (const card of cards.value) {
      const st = statementFor(card, year, month)
      if (st && st.status === 'Pending' && Number(st.amount) > 0) {
        result.push({ ...st, card })
      }
    }
    return result
  }

  return {
    cards,
    loading,
    viewYear,
    viewMonth,
    viewLabel,
    prevMonth,
    nextMonth,
    fetchCards,
    statementFor,
    historyFor,
    upsertStatement,
    saveCard,
    removeCard,
    pendingStatementsForPeriod,
  }
}
