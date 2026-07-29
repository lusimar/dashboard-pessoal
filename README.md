# Personal Management OS

Dashboard e workspace pessoal para gestão de empresas/freelas, documentos, finanças, faculdade e tarefas. Construído com Vue 3 + TypeScript + Vite, Tailwind CSS e Supabase (Auth + PostgreSQL com RLS).

## Stack

- **Vue 3** (Composition API + `<script setup>`) com **TypeScript**
- **Vite** como bundler
- **Tailwind CSS** com paleta customizada (dark mode por padrão)
- **Supabase** para autenticação e banco de dados
- **Vue Router 4** com guards de autenticação
- **Lucide** para ícones

## Paleta de cores

| Cor | Hex | Uso |
| --- | --- | --- |
| Carbon Black | `#1f271b` | Fundo principal, sidebar e containers |
| Blue Slate | `#19647e` | Elementos estruturais, botões secundários, navegação |
| Tropical Teal | `#28afb0` | Cor de destaque: ações primárias, links ativos, sucesso |
| Royal Gold | `#f4d35e` | Avisos, status pendentes, metas financeiras |
| Sandy Brown | `#ee964b` | Urgências, prazos próximos, tag Freelance |

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute o script `supabase/schema.sql` (cria as tabelas, políticas RLS e índices).
3. Em **Authentication > Users**, cadastre manualmente o usuário (e-mail + senha). Não há tela de registro — o acesso é de usuário único.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os dados do seu projeto (Project Settings > API Keys):

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

O arquivo `.env` está no `.gitignore` e nunca deve ser versionado.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

### 5. Build de produção

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
├── components/   # Componentes reutilizáveis (sidebar, modal, cards, badges)
├── composables/  # useAuth, useSupabase, useFormat
├── router/       # Rotas + navigation guards (proteção por sessão)
├── types/        # Tipos TypeScript das entidades do banco
└── views/        # Login, Dashboard, Empresas, Documentos, Finanças, Faculdade, Tarefas
supabase/
└── schema.sql    # Schema completo com RLS
```

## Segurança

- Todas as rotas (exceto `/login`) exigem sessão ativa no Supabase, validada via navigation guard.
- Todas as tabelas possuem coluna `user_id` referenciando `auth.users(id)` e **Row Level Security** habilitado, com políticas de `SELECT`, `INSERT`, `UPDATE` e `DELETE` restritas ao `auth.uid()` autenticado.
