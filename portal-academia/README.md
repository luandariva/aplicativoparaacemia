# Portal Academia + Personal (MVP)

Painel web (Vite + React + TypeScript) para **gestores** e **personais** da mesma unidade. Usa o **mesmo projeto Supabase** do PWA AlimentaAI (`usuarios`, `treinos_plano`, `treinos_realizados`, gamificação).

## Desenvolvimento local

```bash
cd portal-academia
cp .env.example .env.local
# Preencher VITE_* (ver abaixo)
npm install
npm run dev
```

### Variáveis (`/.env.local`)

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto (ex.: `https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Chave anon (anon public) |
| `VITE_SUPABASE_FUNCTIONS_URL` | Base das Edge Functions (ex.: `https://<ref>.functions.supabase.co`) |

Não coloques `SUPABASE_SERVICE_ROLE_KEY` no cliente — só nas secrets das funções.

Com `npm run dev`, o Vite faz **proxy**:

- **`/supabase-api`** → `VITE_SUPABASE_URL` (Auth `signInWithPassword`, REST, Realtime). Ajuda quando ligações diretas a `*.supabase.co` falham (`ERR_CONNECTION_CLOSED`, firewall, browser embutido).
- **`/supabase-functions`** → host das Edge Functions (como antes).

Em produção (`npm run build` / `preview`), o cliente usa sempre as URLs `https` do `.env`.

### `404` em `/supabase-functions/portal_me` no dev

O proxy está a funcionar; o **404 vem do Supabase** porque a função ainda **não foi publicada** no projeto. As migrações SQL **não** criam Edge Functions.

**Publicar (a partir de `portal-academia/`, com Node/npm):** a CLI está em `devDependencies`. Autentica uma vez e faz deploy:

```bash
cd portal-academia
npm install
npx supabase login
# ou define SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)
npm run functions:deploy -- --project-ref <SEU_PROJECT_REF>
```

Isto publica **todas** as funções em [`supabase/functions/`](supabase/functions/). Só `portal_me`: `npm run functions:deploy:me -- --project-ref <REF>`.

Depois, no Dashboard do projeto: **Edge Functions → Secrets** com `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Ordem recomendada de migrações SQL (mesmo projeto do PWA)

Ajusta conforme o que **já existir** no teu Supabase. Comentários em cada ficheiro indicam pré-requisitos.

1. Schema base do app: `public.usuarios`, treinos, etc. (migrações já usadas pelo PWA).
2. Se necessário: [`../scripts/migrations/personais_tabela_e_fk.sql`](../scripts/migrations/personais_tabela_e_fk.sql) — `personais` e FK `treinos_plano.personal_id`.
3. Se necessário: [`../scripts/migrations/treinos_plano_colunas_app.sql`](../scripts/migrations/treinos_plano_colunas_app.sql) — `criado_pelo_aluno`, `categoria`, etc.
4. Gamificação (leitura no detalhe/dashboard): [`../scripts/migrations/gamificacao_completo.sql`](../scripts/migrations/gamificacao_completo.sql) ou o conjunto de migrações gamificação que o projeto já use.
5. Portal: [`../scripts/migrations/portal_academia_mvp.sql`](../scripts/migrations/portal_academia_mvp.sql) — `academias`, `membros_portal`, `alunos_academia`, `convites_aluno`, RLS.
6. Opcional: [`../scripts/migrations/portal_usuarios_email_opcional.sql`](../scripts/migrations/portal_usuarios_email_opcional.sql) — adiciona `email` em `usuarios` se quiseres duplicar o e-mail do Auth na tabela (o portal já funciona sem esta coluna).

Executar cada script no **SQL Editor** do Supabase (ou pipeline equivalente).

## Edge Functions — secrets e deploy

Secrets necessárias (Dashboard **Project Settings → Edge Functions** ou `supabase secrets set`):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Código das funções: [`supabase/functions/`](supabase/functions/) (relativamente a esta pasta `portal-academia/`).

Lista de funções a publicar:

| Função | Papel |
|--------|--------|
| `portal_me` | Sessão staff + academia |
| `portal_dashboard` | KPIs (incl. pontos agregados da semana) |
| `portal_alunos` | Lista de alunos (recorte por papel) |
| `portal_aluno_detail` | Detalhe, planos, realizados, gamificação |
| `portal_prescrever_treino` | Insert em `treinos_plano` |
| `portal_convites` | Listagem de convites (gestor) |
| `portal_create_aluno_invite` | Criar utilizador + `usuarios` + vínculo |
| `portal_personais` | Personais da academia (selects no UI) |

Com login feito (`npx supabase login` ou `SUPABASE_ACCESS_TOKEN`), na pasta `portal-academia`:

```bash
npm run functions:deploy -- --project-ref <SEU_PROJECT_REF>
```

Equivale a publicar cada pasta em `supabase/functions/`. Alternativa com CLI global: `supabase functions deploy ...` — ver [Deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy).

Sem funções deployadas, o browser pode mostrar erro de CORS no *preflight* porque a resposta é 404 no gateway.

## Bootstrap manual (primeira academia)

1. Aplicar migrações na ordem acima.
2. Criar utilizador Auth para o gestor (Dashboard → Authentication).
3. Inserir `academias` e `membros_portal` com `user_id` = UUID Auth, `papel` = `gestor`, `ativo` = true.
4. Para personais: registos em `personais`, conta em `membros_portal` com `papel` = `personal`, e `personais.membro_portal_id` apontando para esse membro.

## Convites / cadastro de aluno

O fluxo atual em **Alunos → Cadastrar aluno** chama `portal_create_aluno_invite`: cria utilizador Auth confirmado, `usuarios`, `alunos_academia` e regista em `convites_aluno` (auditoria). Isto **não** é um convite só com link pendente — o aluno já fica criado; o e-mail pode repetir-se no Auth se já existir (a API devolve erro).

## Rotas principais

- `/login`, `/sem-acesso`
- `/dashboard`, `/alunos`, `/alunos/:usuarioId`, `/alunos/:usuarioId/prescrever` (só personal), `/convites` (só gestor)

Personais podem **duplicar** um plano existente a partir do detalhe do aluno (ligação com query `?duplicarDe=<id_plano>`).

## Stack

React Router, Supabase Auth (staff), chamadas às Edge com JWT + header `apikey` (anon) em [`src/portal/edge.ts`](src/portal/edge.ts).
