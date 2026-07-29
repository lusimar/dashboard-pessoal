import { ref } from 'vue'
import { supabase } from './useSupabase'
import type { Company } from '../types'

const NESTED_SELECT = `
  *,
  invoices ( *, companies(name) ),
  live_projects ( *, companies(name), project_credentials(*) ),
  contract_addendums (*),
  notes ( *, note_categories(id, name, color) )
`

export function useCompanies() {
  const companies = ref<Company[]>([])
  const loading = ref(true)

  async function fetchCompanies() {
    loading.value = true
    const { data, error } = await supabase
      .from('companies')
      .select(NESTED_SELECT)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar empresas:', error.message)
      companies.value = []
    } else {
      companies.value = (data as Company[]) ?? []
    }
    loading.value = false
  }

  return { companies, loading, fetchCompanies }
}
