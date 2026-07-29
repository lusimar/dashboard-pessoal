import { valuesHidden } from './usePrivacy'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const MASKED_CURRENCY = 'R$ ••••••'

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (valuesHidden.value) return MASKED_CURRENCY
  return currencyFormatter.format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // Datas "date-only" (yyyy-mm-dd) são interpretadas em UTC; forçar horário local
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString('pt-BR')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isOverdue(dueDate: string | null | undefined, paymentDate?: string | null): boolean {
  if (!dueDate || paymentDate) return false
  const date = dueDate.length === 10 ? new Date(`${dueDate}T23:59:59`) : new Date(dueDate)
  return date.getTime() < Date.now()
}
