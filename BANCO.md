# Banco de dados online — como ligar

O site tem dois modos, escolhidos sozinhos ao carregar:

| Modo | Quando | Onde ficam contas, pedidos e chamados |
| --- | --- | --- |
| **Banco de dados** | O servidor (`server.js`) está no ar com `DATABASE_URL` | No MySQL/TiDB (ou SQLite local). Qualquer navegador vê os mesmos dados; a equipe vê todos os clientes. |
| **Local** | Sem servidor, ou servidor sem `DATABASE_URL` | No `localStorage` do navegador de cada pessoa (protótipo/apresentação). |

Nada muda no uso do site. A diferença é que, com o banco, o painel administrativo mostra os clientes de verdade,
senhas ficam protegidas com bcrypt, o login usa token JWT e o Mercado Pago grava o pagamento no pedido.

## 1. Criar o banco no TiDB Cloud (gratuito)

1. Entre em [tidbcloud.com](https://tidbcloud.com) → **Create Cluster** → **Serverless** (plano gratuito, 5 GB).
   Região: **São Paulo (sa-east-1)**. Nome: `fhp-fibra` (o cluster que você já criou serve).
2. No cluster, clique em **Connect** → **Connect With: General** → escolha **Node.js / mysql2**.
   Anote: `host`, `port` (4000), `user` (algo como `xxxx.root`) e gere a **senha** (**Reset password** / **Generate**).
3. Crie o banco: na aba **SQL Editor** (ou **Chat2Query**) rode

   ```sql
   CREATE DATABASE fhp_fibra;
   ```

   As tabelas são criadas sozinhas pelo servidor na primeira execução.
4. Monte a `DATABASE_URL` no formato

   ```
   mysql://USUARIO:SENHA@HOST:4000/fhp_fibra
   ```

   Exemplo: `mysql://3pTAoNNegb47Uc8.root:SuaSenha@gateway01.sa-east-1.prod.aws.tidbcloud.com:4000/fhp_fibra`

   Se a senha tiver `@`, `/`, `:` ou `#`, codifique antes (`@` vira `%40`, `/` vira `%2F`, `#` vira `%23`).
   A conexão usa TLS automaticamente (o TiDB exige).

## 2. Rodar no seu computador

1. `npm install` (instala `mysql2`, `bcryptjs` e `jsonwebtoken`).
2. Copie `.env.example` para `.env` e preencha:

   ```
   DATABASE_URL=mysql://USUARIO:SENHA@HOST:4000/fhp_fibra
   JWT_SECRET=uma-frase-longa-e-aleatoria
   ```

   Para desenvolver **sem internet**, use `DATABASE_URL=sqlite:./dados/fhp.db` — o arquivo é criado sozinho
   (Node 22 ou superior). Não use SQLite no Render: o disco de lá é apagado a cada deploy.
3. `node server.js` → o terminal mostra `Banco de dados: MySQL/TiDB em ...` e, na primeira vez,
   `(contas iniciais da equipe criadas)`.
4. Abra `http://localhost:3000`. Entre com `ana.ribeiro@fhpfibra.com.br` / `Admin12345` e, em **Configurações**,
   clique em **Carregar dados de demonstração** se quiser o painel preenchido.

As senhas iniciais da equipe podem ser definidas no `.env` antes da primeira execução
(`ADMIN_SENHA`, `ATENDIMENTO_SENHA`, `TECNICO_SENHA`). Depois, cada pessoa troca a sua pela tela de recuperação.

## 3. Publicar no Render (gratuito)

1. Suba o projeto para o GitHub (sem o `.env` e sem a pasta `dados/` — já estão no `.gitignore`).
2. No Render: **New → Blueprint**, escolha o repositório. O `render.yaml` já descreve o serviço.
3. Preencha as variáveis pedidas: `DATABASE_URL`, `JWT_SECRET`, `MP_ACCESS_TOKEN` (se for usar pagamentos),
   `ANTHROPIC_API_KEY` (se for usar a IA), `PUBLIC_URL` (o endereço que o Render deu, ex. `https://fhp-fibra.onrender.com`).
4. Dois jeitos de servir o site:
   - **Tudo no Render** (mais simples): o próprio `server.js` serve as páginas. Use o endereço do Render como o site.
   - **Site no Cloudflare Pages / GitHub Pages + API no Render**: em `js/config.js` coloque
     `apiUrl: 'https://fhp-fibra.onrender.com'` e, no Render, `SITE_ORIGINS` com o endereço do site
     (ex. `https://fhpfibra.pages.dev`). O site chama a API de lá.

No plano gratuito o Render "dorme" após 15 minutos sem uso; o primeiro acesso leva até 1 minuto. O site mostra
"Carregando…" nesse tempo.

## 4. O que o servidor faz

| Rota | Quem | O quê |
| --- | --- | --- |
| `GET /api/config` | todos | informa se há banco, pagamentos e IA ligados |
| `POST /api/auth/cadastro`, `/login`, `/recuperar`, `/redefinir` | todos | contas (bcrypt + JWT, limite de tentativas por IP) |
| `GET /api/dados` | logado | tudo que a pessoa pode ver: cliente → só o seu; equipe → todos |
| `PUT` / `DELETE /api/clientes/me` | cliente | dados, senha, exclusão da conta (LGPD) |
| `POST /api/pedidos`, `PATCH /api/pedidos/:id` | cliente | contratação/fatura; preço vem de `js/dados.js`, nunca do navegador; "Pago" só com o Mercado Pago confirmando (ou no modo simulado) |
| `POST /api/chamados`, `/visitante`, `/:id/mensagens`, `PATCH /:id` | cliente / equipe | chamados e respostas |
| `PATCH /api/equipe/:email` | admin | nível de acesso |
| `POST /api/demo/carregar`, `/limpar` | admin | dados fictícios |

Tabelas: `clientes`, `equipe`, `pedidos`, `chamados`, `redefinicoes` (`servidor/banco.js`). Lógica das rotas em `servidor/api.js`.

## 5. Segurança (para explicar à banca)

- Senhas com **bcrypt** (nunca em texto); sessão por **JWT** com validade de 30 dias.
- O navegador manda só o **nome do plano**; o servidor usa o preço da tabela dele.
- Número e CVV do cartão **nunca** chegam ao servidor (o site remove antes de enviar; o servidor descarta se chegarem).
- Com Mercado Pago ligado, um pedido só vira "Pago" depois que o servidor **confirma no Mercado Pago**; o webhook é validado por HMAC.
- Limite de tentativas de login por IP e por conta; CORS restrito às origens do site; cabeçalhos CSP/nosniff; arquivos do servidor, `.env` e `dados/` não são servidos.
- Atendimento vê o CPF mascarado; só o administrador vê completo.

## 6. Testes

`node testes.mjs` roda os 54 casos funcionais contra `http://localhost:3000` nos dois modos (o relatório diz qual).
Com `DATABASE_URL=sqlite:./dados/fhp.db` dá para testar o modo banco sem precisar do TiDB.
