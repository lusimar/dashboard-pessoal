import { computed, onMounted, ref } from 'vue'
import { supabase } from './useSupabase'
import {
  buildFinanceMonthLedger,
  computeFinanceKpis,
  periodLabel,
  startOfToday,
  type FinanceMonthItem,
} from './useFinanceMonth'
import type { BankCard, CardStatement, Company, Finance } from '../types'

export function useFinances() {
  const finances = ref<Finance[]>([])
  const companies = ref<Company[]>([])
  const bankCards = ref<BankCard[]>([])
  const loading = ref(true)

  const now = startOfToday()
  const viewYear = ref(now.getFullYear())
  const viewMonthIndex = ref(now.getMonth()) // 0-11

  const viewLabel = computed(() => periodLabel(viewYear.value, viewMonthIndex.value))

  function prevMonth() {
    if (viewMonthIndex.value === 0) {
      viewMonthIndex.value = 11
      viewYear.value -= 1
    } else {
      viewMonthIndex.value -= 1
    }
  }

  function nextMonth() {
    if (viewMonthIndex.value === 11) {
      viewMonthIndex.value = 0
      viewYear.value += 1
    } else {
      viewMonthIndex.value += 1
    }
  }

  async function fetchData() {
    loading.value = true
    const [financesRes, companiesRes, cardsRes] = await Promise.all([
      supabase.from('finances').select('*, companies(name)').order('due_date'),
      supabase.from('companies').select('*, contract_addendums(*)').order('name'),
      supabase.from('bank_cards').select('*, card_statements(*)').order('name'),
    ])
    finances.value = (financesRes.data as Finance[]) ?? []
    companies.value = (companiesRes.data as Company[]) ?? []
    bankCards.value = (cardsRes.data as BankCard[]) ?? []
    loading.value = false
  }

  const cardStatementsForView = computed(() => {
    const year = viewYear.value
    const month = viewMonthIndex.value + 1
    const result: Array<CardStatement & { card: BankCard }> = []
    for (const card of bankCards.value) {
      const st = (card.card_statements ?? []).find((s) => s.year === year && s.month === month)
      if (st && Number(st.amount) > 0) result.push({ ...st, card })
    }
    return result
  })

  const monthItems = computed(() =>
    buildFinanceMonthLedger(
      finances.value,
      companies.value,
      viewYear.value,
      viewMonthIndex.value,
      cardStatementsForView.value,
    ),
  )

  const kpis = computed(() => computeFinanceKpis(monthItems.value))

  onMounted(fetchData)

  return {
    finances,
    companies,
    bankCards,
    loading,
    viewYear,
    viewMonthIndex,
    viewLabel,
    prevMonth,
    nextMonth,
    fetchData,
    monthItems,
    kpis,
  }
}

export type { FinanceMonthItem }
