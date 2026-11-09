# Roteiro de demonstração para a banca — site FHP Fibra

Tempo-alvo: **6 a 8 minutos** de demonstração ao vivo. Tudo roda no modo simulado (sem internet para pagamento),
com os dados de demonstração carregados. Deixe **três abas abertas** antes de começar, uma para cada conta.

## Preparação (10 minutos antes)

1. Abra o site (`node server.js` + `http://localhost:3000`, ou o endereço publicado) numa janela anônima — assim os
   dados de demonstração carregam limpos (`apresentacao: true` em `js/config.js`).
2. Abra três abas e entre em cada uma:
   | Aba | Conta | Senha | Papel |
   | --- | --- | --- | --- |
   | 1 | (sem login) | — | Visitante → vira cliente |
   | 2 | `marcos.souza@fhpfibra.com.br` | `Atende12345` | Atendimento |
   | 3 | `ana.ribeiro@fhpfibra.com.br` | `Admin12345` | Administradora |
3. Tenha o `docs/arquitetura.svg` e o `TESTES.md` nos slides.
4. Plano B: vídeo gravado do mesmo roteiro, caso o Wi-Fi do auditório falhe.

## Jornada 1 — Visitante descobre e escolhe (aba 1, ~2 min)

1. **Home**: mostre o hero, role até a consulta de cobertura. Digite um bairro atendido → "Boa notícia: atendemos!".
   *(Fale: cobertura vem de `dados.js`; CEP consulta o ViaCEP.)*
2. Clique no balão/assistente → **"Qual plano é melhor para mim?"** → responda "3-4 pessoas" → "Jogos e lives".
   O assistente recomenda o plano e oferece o próximo acima.
   *(Fale: motor local de intenções + IA opcional com contexto da página e do cliente logado.)*
3. Vá em **Planos**: cards com "para quem é", comparativo, FAQ. Mostre o botão **Pedir proposta** dos empresariais (abre WhatsApp).

## Jornada 2 — Assinatura e pagamento (aba 1, ~2 min)

1. Clique em **ASSINAR** no FHP Turbo. Etapa 1: crie a conta na hora (CPF `529.982.247-25`, qualquer senha de 8+).
   Mostre a validação em tempo real (CPF inválido é recusado).
2. Etapa 2: CEP `23050-000` preenche rua e bairro (se houver internet). Escolha o vencimento.
3. Etapa 3: **Pix** → "Gerar código" → QR Code e copia-e-cola → **Simular pagamento confirmado**.
   *(Fale: em produção o Checkout Pro do Mercado Pago gera o Pix real e o webhook confirma; o preço nunca sai do navegador, vem da tabela do servidor.)*
4. Etapa 4: **comprovante** com código de autenticação → **Baixar comprovante (PDF)**.
5. **Ver meu plano** → área do cliente. Abra **Faturas** (1ª mensalidade paga) e **Mensagens** → abra um chamado
   "Internet lenta à noite".

## Jornada 3 — Atendimento (aba 2, ~1 min)

1. Atualize a aba do atendimento: o chamado novo aparece em **Mensagens**. Responda e mude o status para "Em atendimento".
2. Mostre **Clientes**: CPF mascarado para o atendimento (só admin vê completo), busca e filtro "Pendente".
3. Volte à aba 1 e atualize: o cliente vê a resposta.

## Jornada 4 — Gestão (aba 3, ~1 min)

1. **Dashboard**: clientes, planos ativos, receita mensal prevista, recebido no mês, gráficos por plano e por situação de chamado.
2. **Clientes** → **Exportar CSV** (abre no Excel).
3. **Funcionários**: só o admin altera níveis de acesso.
4. **Configurações** → botões de carregar/apagar dados de demonstração (explique que são fictícios).

## Fechamento (~1 min)

- Slide de **arquitetura** (`docs/arquitetura.svg`): front estático, servidor Node com IA e Mercado Pago, API + banco.
- Slide de **segurança**: bcrypt/JWT no backend, token do Mercado Pago só no servidor, HMAC no webhook, CSP e cabeçalhos,
  cartão nunca gravado, CPF mascarado, LGPD (termos e privacidade).
- Slide de **validação**: `TESTES.md` — 54 casos automatizados aprovados (navegação, checkout nos 3 métodos, permissões, XSS).
- Slide de **limitações e próximos passos**: backend em publicação, e-mail transacional, nota fiscal, integração com a rede da FHP.

## Perguntas prováveis e respostas curtas

| Pergunta | Resposta |
| --- | --- |
| Onde ficam os dados? | No banco de dados (TiDB Cloud, MySQL) via API do servidor Node, com senha em bcrypt e login por JWT. Sem servidor, o site cai para o modo local (navegador) só para demonstração. Mostre o mesmo cliente entrando em dois navegadores diferentes. |
| E se o cliente perder o celular? | Com o backend, entra em qualquer aparelho; a senha pode ser redefinida por código. |
| O pagamento é real? | A integração é real (Mercado Pago, Checkout Pro). Na apresentação está em modo demonstrativo, sem cobrar. |
| Como garantem que ninguém altera o preço? | O navegador só manda o nome do plano; o servidor usa a tabela dele (`dados.js`) e cria a cobrança. |
| Por que sem framework? | Sem build, hospeda em qualquer lugar gratuito, carrega rápido, e a equipe domina o código inteiro. |
| Como testaram? | 54 testes funcionais automatizados (Playwright) + teste com usuários (preencher com os resultados de vocês). |
