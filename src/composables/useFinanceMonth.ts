import type { BankCard, CardStatement, Company, ContractAddendum, Finance, FinanceCategory } from '../types'

export type LedgerCategory = FinanceCategory | 'Card Invoice'

export interface FinanceMonthItem {
  id: string
  dbId: string | null
  description: string
  amount: number
  category: LedgerCategory
  company_id: string | null
  companies?: { name: string } | null
  url: string | null
  payment_method: string | null
  status: 'Active' | 'Cancelled' | null
  due_date: string
  cycleYear: number
  cycleMonthIndex: number
  paidThisMonth: boolean
  payment_date: string | null
  sortDate: string
  source: 'finance' | 'company' | 'addendum' | 'card'
  isIncome: boolean
  isRecurring: boolean
  isCard: boolean
  isOverdue: boolean
  canEdit: boolean
  canDelete: boolean
}

export interface FinanceKpis {
  /** Entradas já recebidas no mês */
  recebidos: number
  /** Entradas (A Receber) — só pendentes */
  entradasAReceber: number
  /** Saídas (A Pagar) — despesas + faturas pendentes */
  saidasAPagar: number
  /** Saldo Previsto = (incomes paid+pending) − (expenses paid+pending + cards) */
  saldoPrevisto: number
  incomesPaid: number
  incomesPending: number
  expensesPaid: number
  expensesPending: number
  cardsPending: number
}

const ALL_RECURRING: FinanceCategory[] = ['Subscription', 'Personal Income', 'Fixed Expense']

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function dueDateForMonth(day: number, year: number, monthIndex: number): string {
  const clamped = Math.min(Math.max(1, day), daysInMonth(year, monthIndex))
  return toISODate(new Date(year, monthIndex, clamped))
}

function dayFromDate(value: string): number {
  return parseLocalDate(value).getDate()
}

function sameMonth(value: string | null | undefined, year: number, monthIndex: number): boolean {
  if (!value) return false
  const d = parseLocalDate(value)
  return d.getFullYear() === year && d.getMonth() === monthIndex
}

function isIncomeCategory(category: LedgerCategory): boolean {
  return category === 'Freelance Income' || category === 'Personal Income'
}

function isRecurringCategory(category: FinanceCategory, status: string | null): boolean {
  if (status === 'Cancelled') return false
  return ALL_RECURRING.includes(category)
}

/** Referência para vigência de contratos no mês visualizado */
function refDateForView(year: number, monthIndex: number, today: Date): Date {
  if (today.getFullYear() === year && today.getMonth() === monthIndex) return today
  return new Date(year, monthIndex + 1, 0)
}

function isPaidForCycle(finance: Finance, cycleYear: number, cycleMonthIndex: number): boolean {
  if (!finance.payment_date) return false
  // Ciclo pago se o due_date gravado (ou payment_date) cai no mês do ciclo
  return (
    sameMonth(finance.due_date, cycleYear, cycleMonthIndex) ||
    sameMonth(finance.payment_date, cycleYear, cycleMonthIndex)
  )
}

export function isCompanyContractActive(company: Company, ref: Date = startOfToday()): boolean {
  if (!company.agreed_value || !company.payment_day) return false
  const refTime = ref.getTime()

  if (company.start_date && refTime < parseLocalDate(company.start_date).getTime()) return false

  if (company.end_date) {
    return refTime <= parseLocalDate(company.end_date).getTime()
  }

  if (company.start_date && company.contract_duration) {
    const start = parseLocalDate(company.start_date)
    const end = new Date(start.getFullYear(), start.getMonth() + company.contract_duration, start.getDate())
    end.setDate(end.getDate() - 1)
    return refTime <= end.getTime()
  }

  return Boolean(company.contract_duration && company.agreed_value)
}

export function isAddendumActive(addendum: ContractAddendum, ref: Date = startOfToday()): boolean {
  if (!addendum.added_value || !addendum.payment_day) return false
  const refTime = ref.getTime()

  if (addendum.start_date && refTime < parseLocalDate(addendum.start_date).getTime()) return false
  if (addendum.end_date) return refTime <= parseLocalDate(addendum.end_date).getTime()

  if (addendum.start_date && addendum.period) {
    const start = parseLocalDate(addendum.start_date)
    const end = new Date(start.getFullYear(), start.getMonth() + addendum.period, start.getDate())
    end.setDate(end.getDate() - 1)
    return refTime <= end.getTime()
  }
  return Boolean(addendum.period)
}

function hasFinanceForCompanyMonth(
  finances: Finance[],
  companyId: string,
  year: number,
  monthIndex: number,
  description: string,
): Finance | undefined {
  return finances.find(
    (f) =>
      f.company_id === companyId &&
      f.category === 'Freelance Income' &&
      f.description === description &&
      sameMonth(f.due_date, year, monthIndex),
  )
}

/**
 * Ledger estrito do mês/ano selecionado.
 * Nenhum item é rolado para o mês seguinte — agosto só aparece em agosto.
 */
export function buildFinanceMonthLedger(
  finances: Finance[],
  companies: Company[],
  viewYear: number,
  viewMonthIndex: number,
  cardStatements: Array<CardStatement & { card: BankCard }> = [],
  today: Date = startOfToday(),
): FinanceMonthItem[] {
  const items: FinanceMonthItem[] = []
  const ref = refDateForView(viewYear, viewMonthIndex, today)
  const calendarMonth = viewMonthIndex + 1

  for (const finance of finances) {
    const recurring = isRecurringCategory(finance.category, finance.status)

    if (finance.status === 'Cancelled') continue

    if (recurring) {
      const payDay = dayFromDate(finance.due_date)
      const due = dueDateForMonth(payDay, viewYear, viewMonthIndex)
      const paidThisMonth = isPaidForCycle(finance, viewYear, viewMonthIndex)
      const overdue = !paidThisMonth && parseLocalDate(due).getTime() < today.getTime()

      items.push({
        id: `${finance.id}:${viewYear}-${calendarMonth}`,
        dbId: finance.id,
        description: finance.description,
        amount: Number(finance.amount),
        category: finance.category,
        company_id: finance.company_id,
        companies: finance.companies ?? null,
        url: finance.url,
        payment_method: finance.payment_method,
        status: finance.status,
        due_date: due,
        cycleYear: viewYear,
        cycleMonthIndex: viewMonthIndex,
        paidThisMonth,
        payment_date: paidThisMonth ? finance.payment_date : null,
        sortDate: due,
        source: 'finance',
        isIncome: isIncomeCategory(finance.category),
        isRecurring: true,
        isCard: false,
        isOverdue: overdue,
        canEdit: true,
        canDelete: true,
      })
      continue
    }

    // Pontuais: apenas se o vencimento original é deste mês
    if (!sameMonth(finance.due_date, viewYear, viewMonthIndex)) continue

    const paidThisMonth = Boolean(finance.payment_date)
    const due = finance.due_date
    const overdue = !paidThisMonth && parseLocalDate(due).getTime() < today.getTime()

    items.push({
      id: finance.id,
      dbId: finance.id,
      description: finance.description,
      amount: Number(finance.amount),
      category: finance.category,
      company_id: finance.company_id,
      companies: finance.companies ?? null,
      url: finance.url,
      payment_method: finance.payment_method,
      status: finance.status,
      due_date: due,
      cycleYear: viewYear,
      cycleMonthIndex: viewMonthIndex,
      paidThisMonth,
      payment_date: finance.payment_date,
      sortDate: due,
      source: 'finance',
      isIncome: isIncomeCategory(finance.category),
      isRecurring: false,
      isCard: false,
      isOverdue: overdue,
      canEdit: true,
      canDelete: true,
    })
  }

  for (const company of companies) {
    if (isCompanyContractActive(company, ref)) {
      const payDay = company.payment_day!
      const description = `Contrato · ${company.name}`
      const existing = hasFinanceForCompanyMonth(finances, company.id, viewYear, viewMonthIndex, description)

      if (!existing) {
        const due = dueDateForMonth(payDay, viewYear, viewMonthIndex)
        const overdue = parseLocalDate(due).getTime() < today.getTime()
        items.push({
          id: `company:${company.id}:${viewYear}-${calendarMonth}`,
          dbId: null,
          description,
          amount: Number(company.agreed_value),
          category: 'Freelance Income',
          company_id: company.id,
          companies: { name: company.name },
          url: company.contract_link,
          payment_method: null,
          status: 'Active',
          due_date: due,
          cycleYear: viewYear,
          cycleMonthIndex: viewMonthIndex,
          paidThisMonth: false,
          payment_date: null,
          sortDate: due,
          source: 'company',
          isIncome: true,
          isRecurring: true,
          isCard: false,
          isOverdue: overdue,
          canEdit: false,
          canDelete: false,
        })
      }
    }

    for (const addendum of company.contract_addendums ?? []) {
      if (!isAddendumActive(addendum, ref)) continue
      const payDay = addendum.payment_day!
      const description = `Aditivo · ${company.name}${addendum.description ? ` — ${addendum.description}` : ''}`
      const existing = hasFinanceForCompanyMonth(finances, company.id, viewYear, viewMonthIndex, description)
      if (existing) continue

      const due = dueDateForMonth(payDay, viewYear, viewMonthIndex)
      const overdue = parseLocalDate(due).getTime() < today.getTime()
      items.push({
        id: `addendum:${addendum.id}:${viewYear}-${calendarMonth}`,
        dbId: null,
        description,
        amount: Number(addendum.added_value),
        category: 'Freelance Income',
        company_id: company.id,
        companies: { name: company.name },
        url: addendum.document_link,
        payment_method: null,
        status: 'Active',
        due_date: due,
        cycleYear: viewYear,
        cycleMonthIndex: viewMonthIndex,
        paidThisMonth: false,
        payment_date: null,
        sortDate: due,
        source: 'addendum',
        isIncome: true,
        isRecurring: true,
        isCard: false,
        isOverdue: overdue,
        canEdit: false,
        canDelete: false,
      })
    }
  }

  // Faturas de cartão do mês (Pending e Paid — Paid entra no saldo como settled)
  for (const st of cardStatements) {
    if (st.year !== viewYear || st.month !== calendarMonth) continue
    if (Number(st.amount) <= 0) continue

    const due = st.due_date ?? dueDateForMonth(st.card.due_day, viewYear, viewMonthIndex)
    const paidThisMonth = st.status === 'Paid'
    const overdue = !paidThisMonth && parseLocalDate(due).getTime() < today.getTime()

    items.push({
      id: `card:${st.id}`,
      dbId: null,
      description: `Fatura · ${st.card.name}`,
      amount: Number(st.amount),
      category: 'Card Invoice',
      company_id: null,
      companies: st.card.bank ? { name: st.card.bank } : null,
      url: null,
      payment_method: st.card.type === 'Credit' ? 'Cartão de crédito' : 'Cartão de débito',
      status: 'Active',
      due_date: due,
      cycleYear: viewYear,
      cycleMonthIndex: viewMonthIndex,
      paidThisMonth,
      payment_date: paidThisMonth ? due : null,
      sortDate: due,
      source: 'card',
      isIncome: false,
      isRecurring: false,
      isCard: true,
      isOverdue: overdue,
      canEdit: false,
      canDelete: false,
    })
  }

  items.sort((a, b) => parseLocalDate(a.sortDate).getTime() - parseLocalDate(b.sortDate).getTime())
  return items
}

/**
 * KPIs do mês:
 * - Recebidos = Σ incomes pagos no mês
 * - Entradas (A Receber) = Σ incomes pendentes
 * - Saídas (A Pagar) = Σ expenses pendentes + faturas pending
 * - Saldo Previsto = (incomes paid + pending) − (expenses paid + pending + cards)
 */
export function computeFinanceKpis(items: FinanceMonthItem[]): FinanceKpis {
  let incomesPaid = 0
  let incomesPending = 0
  let expensesPaid = 0
  let expensesPending = 0
  let cardsPending = 0

  for (const i of items) {
    if (i.status === 'Cancelled') continue

    if (i.isIncome) {
      if (i.paidThisMonth) incomesPaid += i.amount
      else incomesPending += i.amount
      continue
    }

    if (i.isCard) {
      if (i.paidThisMonth) expensesPaid += i.amount
      else {
        expensesPending += i.amount
        cardsPending += i.amount
      }
      continue
    }

    if (i.paidThisMonth) expensesPaid += i.amount
    else expensesPending += i.amount
  }

  return {
    recebidos: incomesPaid,
    entradasAReceber: incomesPending,
    saidasAPagar: expensesPending,
    saldoPrevisto: incomesPaid + incomesPending - (expensesPaid + expensesPending),
    incomesPaid,
    incomesPending,
    expensesPaid,
    expensesPending,
    cardsPending,
  }
}

export function statusOfMonthItem(
  item: FinanceMonthItem,
): { label: string; variant: 'success' | 'warning' | 'urgent' | 'info' } {
  if (item.paidThisMonth) return { label: 'Pago', variant: 'success' }
  if (item.isOverdue) return { label: 'Atrasado / Pendente', variant: 'urgent' }
  return { label: 'Pendente', variant: 'warning' }
}

export function periodLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}
