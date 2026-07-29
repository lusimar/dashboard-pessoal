export interface Profile {
  id: string
  updated_at: string | null
  full_name: string | null
}

export interface Company {
  id: string
  user_id: string
  name: string
  contract_link: string | null
  /** Duração em meses (apenas número) */
  contract_duration: number | null
  /** Valor mensal; total base = duração × valor mensal */
  agreed_value: number | null
  start_date: string | null
  end_date: string | null
  /** Dia do mês em que o valor mensal entra em Finanças */
  payment_day: number | null
  created_at: string
  invoices?: Invoice[]
  live_projects?: LiveProject[]
  contract_addendums?: ContractAddendum[]
  notes?: Note[]
}

export interface ContractAddendum {
  id: string
  user_id: string
  company_id: string
  /** Valor mensal; total = período × valor mensal */
  added_value: number
  /** Duração em meses (apenas número) */
  period: number | null
  start_date: string | null
  end_date: string | null
  payment_day: number | null
  description: string | null
  document_link: string | null
  created_at: string
}

export type InvoiceType = 'DAS' | 'Invoice' | 'Receipt' | 'Contract' | 'Other'

export interface Invoice {
  id: string
  user_id: string
  company_id: string | null
  title: string
  document_link: string
  due_date: string | null
  payment_date: string | null
  type: InvoiceType
  created_at: string
  companies?: Pick<Company, 'name'> | null
}

export type FinanceCategory =
  | 'Fixed Expense'
  | 'Subscription'
  | 'Freelance Income'
  | 'Personal Income'
  | 'Other'

export type FinanceStatus = 'Active' | 'Cancelled'

export interface Finance {
  id: string
  user_id: string
  company_id: string | null
  description: string
  amount: number
  due_date: string
  payment_date: string | null
  category: FinanceCategory
  url: string | null
  payment_method: string | null
  status: FinanceStatus | null
  created_at: string
  companies?: Pick<Company, 'name'> | null
}

export interface CollegeSubject {
  id: string
  user_id: string
  name: string
  /** Legado — preferir start_date / end_date */
  semester: string | null
  start_date: string | null
  end_date: string | null
  professor: string | null
  notes_link: string | null
  notes_content: string | null
  created_at: string
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed'
export type TaskCategory = 'Personal' | 'College' | 'Job' | 'Freelance' | 'Lembrete'

export interface Task {
  id: string
  user_id: string
  company_id: string | null
  subject_id: string | null
  title: string
  description: string | null
  due_date: string | null
  status: TaskStatus
  category: TaskCategory
  created_at: string
  companies?: Pick<Company, 'name'> | null
  college_subjects?: Pick<CollegeSubject, 'name'> | null
}

export interface LiveProject {
  id: string
  user_id: string
  company_id: string | null
  name: string
  project_url: string | null
  technology: string | null
  database_tech: string | null
  hosting_provider: string | null
  domain_provider: string | null
  contract_term: string | null
  recurring_revenue: number | null
  expiration_date: string | null
  /** APIs / integrações utilizadas */
  integrations: string | null
  account_email: string | null
  /** Senha criptografada no cliente (AES-GCM) */
  account_password: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  created_at: string
  companies?: Pick<Company, 'name'> | null
  project_credentials?: ProjectCredential[]
}

export interface ProjectCredential {
  id: string
  user_id: string
  project_id: string
  access_type: string
  email: string
  encrypted_password: string
  notes: string | null
  created_at: string
}

export type BankCardType = 'Credit' | 'Debit'

export interface BankCard {
  id: string
  user_id: string
  name: string
  bank: string | null
  type: BankCardType
  due_day: number
  closing_day: number | null
  created_at: string
  card_statements?: CardStatement[]
}

export type CardStatementStatus = 'Pending' | 'Paid'

export interface CardStatement {
  id: string
  user_id: string
  card_id: string
  year: number
  month: number
  amount: number
  status: CardStatementStatus
  due_date: string | null
  created_at: string
}

export type NoteType = 'Draft' | 'Credentials' | 'LinkedIn' | 'General' | 'Document'
export type NoteStatus = 'Active' | 'Archived' | 'In Progress' | 'Published'

export interface NoteCategory {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  created_at: string
  updated_at: string
  notes?: Note[]
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string | null
  type: NoteType
  status: NoteStatus
  category_id: string | null
  company_id: string | null
  created_at: string
  updated_at: string
  note_categories?: Pick<NoteCategory, 'id' | 'name' | 'color'> | null
  companies?: Pick<Company, 'name'> | null
}

export type JobApplicationStatus =
  | 'Wishlist'
  | 'Applied'
  | 'Interviewing'
  | 'Offer'
  | 'Rejected'
  | 'Hired'

export interface JobChecklist {
  id: string
  user_id: string
  job_application_id: string
  task: string
  is_completed: boolean
  sort_order: number
  created_at: string
}

export interface JobApplication {
  id: string
  user_id: string
  company_name: string
  role: string | null
  salary: string | null
  benefits: string | null
  location: string | null
  contact_name: string | null
  contact_info: string | null
  notes: string | null
  status: JobApplicationStatus
  applied_at: string | null
  created_at: string
  updated_at: string
  job_checklists?: JobChecklist[]
}
