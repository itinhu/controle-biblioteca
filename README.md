# controle-biblioteca
sistema para controle de empréstimos de livros da escola. 

controle simples feito em react com nodejs em um sistema só, com banco no supabase

conforme os livros são emprestados os alunos são cadastrados e os livros tbm.
com seleção de quandots dias a pessoa vai entregar, notificação de livro atrasado

aluno:
    nome
    série do 1° ao 6° ano num dropdown para selecionar
    data prevista contando do dia do empréstimo 7 dias depois

sistema de login para adm
    login: admin
    senha: admin123

.env
    VITE_SUPABASE_URL=https://nrtnwrwkhmuanlrjyasl.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_4sv7T0bziskV8EfjnjmwLA_h0gyG3nf
---

## Implementação — Entrelinhas

Sistema em React + Vite, API Node.js e banco Supabase, preparado para frontend e API no mesmo projeto da Vercel. Requer Node.js 22 ou superior.

### Funcionalidades

- Login administrativo com sessão de 8 horas em cookie HttpOnly.
- Painel com total de exemplares, empréstimos ativos, alunos e atrasos.
- Cadastro de alunos do 1º ao 6º ano e livros com quantidade de exemplares.
- Cadastro de aluno e livro diretamente ao registrar um empréstimo.
- Prazo padrão de 7 dias, com opções de 3, 14, 21 ou 30 dias.
- Devolução com confirmação e liberação do exemplar.
- Busca por livro, autor ou aluno e filtros de empréstimos.
- Alertas de atraso dentro do sistema, atualizados a cada minuto. Não há envio de e-mail, WhatsApp ou notificações com o navegador fechado.
- Datas de empréstimo e atraso seguem o fuso America/Bahia. Um livro passa a estar atrasado no dia seguinte ao prazo.
- Interface responsiva em português.

### 1. Preparar o Supabase

1. Abra o SQL Editor do projeto Supabase.
2. Copie e execute todo o arquivo [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Settings → API Keys**, obtenha uma **secret key** (`sb_secret_...`). A chave legada `service_role` também é aceita.

A chave pública `VITE_SUPABASE_PUBLISHABLE_KEY` descrita nos requisitos não é utilizada: o navegador acessa a API autenticada, e somente o servidor acessa o banco. As tabelas têm RLS habilitado e acesso público bloqueado. Nunca use prefixo `VITE_` em uma chave secreta.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta do Supabase, exclusiva do servidor |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `admin123` para o acesso inicial; defina uma senha forte antes da publicação |
| `SESSION_SECRET` | Segredo aleatório de pelo menos 32 caracteres |

Gere o segredo de sessão com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Alterar `SESSION_SECRET` invalida todas as sessões existentes. As credenciais são configuradas no servidor; não existe cadastro público de administradores.

### 3. Executar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5173. O mesmo servidor entrega React e API; não é necessário iniciar outro backend.

```bash
npm test
npm run build
```

`npm run preview` serve apenas os arquivos estáticos do build; para testar login e dados localmente, use `npm run dev`.

### 4. Hospedar na Vercel

1. Envie o projeto para seu repositório Git e importe-o na Vercel.
2. Use o preset **Vite**, Node.js **22.x ou superior**, build `npm run build` e saída `dist`.
3. Cadastre as cinco variáveis da tabela em **Settings → Environment Variables**, para os ambientes desejados. Use uma senha administrativa forte.
4. Faça o deploy. `vercel.json` configura os caminhos `/api/*` para a função Node.js e as páginas para o React.
5. Entre e teste: cadastrar aluno → cadastrar livro → emprestar → devolver. Verifique também o acesso em tela pequena.

O SQL deve estar instalado no Supabase antes desse teste. Se alterar variáveis na Vercel, faça um novo deploy. A publicação e a instalação do banco não são executadas automaticamente pelo build.

### Estrutura

- `src/`: interface React e estilos.
- `api/index.js`: login, sessão, cadastros, empréstimos e devoluções.
- `server/domain.js`: regras de datas e validação.
- `server/dev.js`: servidor local único.
- `supabase/schema.sql`: tabelas, permissões e função transacional de empréstimo.
- `tests/`: testes automatizados.

O empréstimo usa uma transação e bloqueia a linha do livro ao verificar disponibilidade, evitando ultrapassar o número de exemplares em operações simultâneas. Aluno e livro novos são criados nessa mesma transação. A devolução só altera empréstimos ainda abertos.
