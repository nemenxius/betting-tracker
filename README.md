# Registo de Apostas

App web minimalista para registar apostas com Supabase e alojar num repositório Git.

## O que inclui

- Login e registo com email/password via Supabase Auth
- Registo de apostas com evento, mercado, stake, odds, resultado, lucro e notas
- Filtros por estado e pesquisa
- Estatísticas rápidas: total de apostas, lucro líquido e ROI
- SQL pronto para criar a tabela e as políticas RLS

## Estrutura

- `index.html`: interface
- `styles.css`: visual minimalista responsivo
- `app.js`: autenticação, CRUD e renderização
- `config.js`: configuração do projeto Supabase
- `supabase.sql`: tabela e políticas de segurança

## Setup da Supabase

1. Cria um projeto em [Supabase](https://supabase.com/).
2. Em `SQL Editor`, executa o conteúdo de `supabase.sql`.
3. Em `Authentication > Providers`, mantém `Email` ativo.
4. Em `Project Settings > API`, copia:
   - `Project URL`
   - `anon public key`
5. Substitui os placeholders em `config.js`.

## Publicar

Podes abrir a app localmente ou publicar esta pasta num repositório GitHub e ativar GitHub Pages na branch principal.

## Execução local

Se o browser bloquear scripts ao abrir o ficheiro com `file://`, usa um servidor local simples em vez de abrir o HTML diretamente.

## Nota de segurança

A `anon key` da Supabase pode ficar no frontend. A proteção real está nas políticas RLS definidas no ficheiro SQL.
