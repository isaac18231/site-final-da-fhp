# Relatório de testes funcionais — site FHP Fibra

Execução automatizada em 22/10/2026, 19:16:23 com Playwright (Chromium headless), modo simulado de pagamento, dados de demonstração carregados, **banco de dados ligado (sqlite)**.

**Resultado: 54 de 54 casos aprovados** (100%).

| Área | Casos | Aprovados |
| --- | --- | --- |
| Páginas | 11 | 11 |
| Planos | 3 | 3 |
| Cobertura | 3 | 3 |
| Cadastro | 3 | 3 |
| Login | 6 | 6 |
| Checkout | 7 | 7 |
| Cliente | 5 | 5 |
| Equipe | 6 | 6 |
| Assistente | 3 | 3 |
| Contato | 2 | 2 |
| Segurança | 5 | 5 |

## Casos de teste

| ID | Caso | Resultado | Observação |
| --- | --- | --- | --- |
| P-1 | index.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "FHP Fibra / Internet fibra óptica na Zona Oeste do Rio" |
| P-2 | planos.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Planos de internet fibra na Zona Oeste RJ / FHP Fibra" |
| P-3 | quem-somos.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Quem Somos / FHP Fibra" |
| P-4 | portfolio.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Portfólio / FHP Fibra" |
| P-5 | fale-conosco.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Fale Conosco / FHP Fibra" |
| P-6 | login.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Entrar na sua conta / FHP Fibra" |
| P-7 | cadastro.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Criar conta / FHP Fibra" |
| P-8 | termos.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Termos de uso / FHP Fibra" |
| P-9 | privacidade.html carrega sem erro de JavaScript e sem rolagem horizontal | ✅ Aprovado | título: "Política de privacidade / FHP Fibra" |
| P-10 | Todas as páginas têm favicon, descrição e Open Graph | ✅ Aprovado |  |
| P-11 | Layout responsivo em celular (390px) sem rolagem horizontal | ✅ Aprovado |  |
| PL-1 | Página de planos mostra os 4 residenciais e 3 empresariais com preços de dados.js | ✅ Aprovado | Turbo: R$ 99,90/mês |
| PL-2 | Botão ASSINAR leva ao checkout com o plano escolhido | ✅ Aprovado | checkout.html?plano=FHP%20Turbo |
| PL-3 | FAQ com 6 perguntas e dados estruturados (FAQPage + InternetServiceProvider) | ✅ Aprovado |  |
| C-1 | Consulta de cobertura por bairro (lista preenchida) responde "atendemos" | ✅ Aprovado | Boa notícia: atendemos em Campo Grande! Escolha seu plano e assine online. |
| C-2 | Bairro fora da lista recebe aviso e link para a equipe | ✅ Aprovado | Ainda não temos confirmação para Copacabana. Estamos sempre expandindo a rede — confirme pelo WhatsApp. |
| C-3 | Campo vazio é validado | ✅ Aprovado |  |
| CA-1 | CPF inválido é recusado e CPF válido é aceito | ✅ Aprovado |  |
| CA-2 | Senhas diferentes são apontadas | ✅ Aprovado |  |
| CA-3 | Cadastro completo cria a conta e entra no painel | ✅ Aprovado |  |
| L-1 | E-mail já cadastrado não pode criar outra conta | ✅ Aprovado |  |
| L-2 | Senha errada é recusada com mensagem | ✅ Aprovado |  |
| L-3 | Login correto entra no painel do cliente | ✅ Aprovado |  |
| L-4 | Recuperação de senha gera código e redefine a senha | ✅ Aprovado |  |
| L-5 | Equipe entra com as contas iniciais (admin, atendimento, técnico) | ✅ Aprovado |  |
| L-6 | Página do painel sem sessão redireciona para o login | ✅ Aprovado |  |
| CK-1 | Checkout de plano empresarial redireciona para proposta (não vende online) | ✅ Aprovado |  |
| CK-2 | Resumo do pedido mostra plano e valor; etapa 1 permite entrar com conta existente | ✅ Aprovado | conta reconhecida: Teste Banca |
| CK-3 | Pix: gera QR Code e código copia-e-cola; confirmação gera comprovante | ✅ Aprovado | comprovante FHP-423377 |
| CK-4 | Cartão: número inválido (Luhn) é recusado; 4111… é aprovado | ✅ Aprovado | Visa final 1111 aprovado |
| CK-5 | Cartão recusado pelo emissor (4000…0002) mostra erro e não conclui | ✅ Aprovado | Pagamento recusado pelo emissor do cartão. Tente outro cartão ou outra forma de  |
| CK-6 | Boleto: gera linha digitável e "pagar depois" deixa o plano pendente no painel | ✅ Aprovado |  |
| CK-7 | Conta de equipe não consegue assinar plano | ✅ Aprovado |  |
| CL-1 | Faturas listam meses desde a contratação com situação e comprovante | ✅ Aprovado | 4 faturas |
| CL-2 | Cliente abre chamado e ele aparece em Mensagens | ✅ Aprovado |  |
| CL-3 | Cliente altera telefone em Meus dados | ✅ Aprovado |  |
| CL-4 | Cliente não vê chamados de outros clientes | ✅ Aprovado |  |
| CL-5 | Cliente não acessa seção administrativa (?secao=clientes) | ✅ Aprovado |  |
| E-1 | Atendimento responde chamado e muda status | ✅ Aprovado |  |
| E-2 | Atendimento vê CPF mascarado; admin vê completo | ✅ Aprovado | 529.***.***-25 → 529.982.247-25 |
| E-3 | Busca e filtro de pagamento na lista de clientes | ✅ Aprovado | busca 1, pendentes 3 |
| E-4 | Exportação CSV gera arquivo com cabeçalho e linhas | ✅ Aprovado | 15 linhas |
| E-5 | Só o admin altera nível de acesso; técnico só vê Dashboard e Mensagens | ✅ Aprovado |  |
| E-6 | Dashboard do admin mostra receita prevista e gráficos | ✅ Aprovado |  |
| A-1 | Responde preço de um plano pelo nome | ✅ Aprovado |  |
| A-2 | Fluxo de recomendação em duas perguntas indica um plano | ✅ Aprovado | FHP Gamer |
| A-3 | Conversa continua após trocar de página | ✅ Aprovado |  |
| CT-1 | Formulário valida campos obrigatórios e e-mail | ✅ Aprovado |  |
| CT-2 | Mensagem válida abre o WhatsApp com os dados preenchidos | ✅ Aprovado |  |
| S-1 | Servidor envia cabeçalhos de segurança (CSP, nosniff, frame-ancestors) | ✅ Aprovado |  |
| S-2 | Arquivos sensíveis (.env, server.js, servidor/) não são servidos | ✅ Aprovado |  |
| S-3 | API de pagamentos rejeita plano inexistente e cliente inválido | ✅ Aprovado | status 503 |
| S-4 | Texto do usuário é escapado no painel (sem XSS) | ✅ Aprovado |  |
| S-5 | Dados de cartão não ficam gravados (só bandeira e 4 últimos) | ✅ Aprovado |  |

## Como repetir

1. `node server.js` na pasta do site (porta 3000).
2. `node testes.mjs` (requer Node 18+ e o pacote `playwright` com o Chromium: `npx playwright install chromium`).
3. O relatório é regravado em `TESTES.md`.

Os casos cobrem navegação, responsividade, planos, cobertura, cadastro, login, recuperação de senha, checkout (Pix, cartão aprovado/recusado, boleto, regras de acesso), área do cliente, painel da equipe (permissões, mascaramento de CPF, filtros, CSV), assistente, contato e segurança (cabeçalhos, arquivos protegidos, validação da API, XSS, dados de cartão).
