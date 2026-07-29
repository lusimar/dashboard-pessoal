# Schema SQL

## Arquivos

1. `schema.sql` — estado final limpo (projeto Supabase **novo**)
2. `15_safe_sync_canonical.sql` — sync idempotente para o **banco atual com dados** (não apaga nada)
3. `16_job_applications.sql` — só as tabelas de candidaturas/checklist (migração pontual)

## Passo a passo (banco que já tem dados)

1. Supabase → SQL Editor
2. Cole e rode `15_safe_sync_canonical.sql` **ou**, se só precisar do pipeline de vagas, `16_job_applications.sql`
3. Teste o app

## Não fazer

- Não use `DROP TABLE` para “limpar”
- Não rode `schema.sql` no banco vivo esperando substituir tudo (só em projeto vazio)
