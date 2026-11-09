# FHP Fibra — site, área do cliente e painel

Site institucional, área do cliente e painel administrativo da FHP Fibra, em HTML5, CSS3 e JavaScript puro, com servidor Node opcional para o assistente com IA e o Mercado Pago. Para ver, abra `index.html` no navegador ou rode `node server.js`.

**Antes de publicar como site oficial, leia o [TODO-FHP.md](TODO-FHP.md)**: lista o que a FHP precisa preencher (CNPJ, bairros, fotos, revisão jurídica).

**Banco de dados online:** o passo a passo para ligar o TiDB Cloud (ou SQLite local) está em [BANCO.md](BANCO.md). Com o banco ligado, contas, pedidos e chamados saem do navegador e vão para o servidor (bcrypt + JWT), e o painel vê todos os clientes.

**Para a banca do TCC:** [ROTEIRO-APRESENTACAO.md](ROTEIRO-APRESENTACAO.md) (demonstração em 4 jornadas, contas e perguntas prováveis), [TESTES.md](TESTES.md) (54 testes funcionais automatizados, `node testes.mjs`) e `docs/arquitetura.svg`/`.png` (diagrama para os slides).

## Onde mudar cada coisa

| O quê | Arquivo |
| --- | --- |
| Dados da empresa, bairros atendidos, planos (nome, velocidade, preço), FAQ | `js/dados.js` (vale para site, assistente e servidor) |
| WhatsApp, servidor de pagamentos, analytics | `js/config.js` |
| Contas iniciais da equipe | `js/fhp.js` (modo local) · `.env` / `servidor/banco.js` (modo banco) |
| Banco de dados e API | `servidor/banco.js`, `servidor/api.js` — guia em `BANCO.md` |
| Textos das páginas | cada `.html` |

## Acessos demonstrativos

| Nível | E-mail | Senha |
| --- | --- | --- |
| Admin | `ana.ribeiro@fhpfibra.com.br` | `Admin12345` |
| Atendimento | `marcos.souza@fhpfibra.com.br` | `Atende12345` |
| Técnico | `rafael.nogueira@fhpfibra.com.br` | `Tecnico123` |

Clientes são criados pela página **Criar conta** (ou pelo checkout). Em modo apresentação (`apresentacao: true` no `config.js`), o site carrega sozinho 14 clientes fictícios (`*@demo.exemplo.com`, senha `cliente123` — ex.: `juliana.martins@demo.exemplo.com`), com faturas pagas e pendentes e 7 chamados; o administrador pode recarregar ou apagar esses dados em **Configurações**. As contas acima são fictícias e ficam em `js/fhp.js`; nunca coloque e-mails ou senhas reais nesse arquivo, ele é público.

Sem servidor com banco, o site guarda contas, pedidos e chamados no `localStorage` do navegador (modo local). Com `DATABASE_URL` no servidor, tudo vai para o banco — veja [BANCO.md](BANCO.md).

## Checkout, faturas e pagamento

O botão **ASSINAR** de cada plano residencial abre `checkout.html`, que leva a pessoa por quatro etapas: dados da conta, endereço de instalação, pagamento da 1ª mensalidade e confirmação. No painel, a página **Faturas** lista as mensalidades e permite pagar cada uma.

Há dois modos:

- **Simulado** (padrão): nenhum valor é cobrado e nenhum dado sai do navegador. Com `apresentacao: true` em `js/config.js` (padrão), o checkout é rotulado **"Pagamento demonstrativo"** para a apresentação do TCC; com `false`, vira "modo de teste". Detalhes abaixo.
- **Mercado Pago**: cobrança real (ou no modo de teste do Mercado Pago) com Pix, cartão e boleto. O passo a passo para ligar está em [PAGAMENTOS.md](PAGAMENTOS.md).

### Modo simulado

| Forma | O que acontece |
| --- | --- |
| Pix | Gera um QR Code e um código "copia e cola" demonstrativos, válidos por 10 minutos. O botão **Simular pagamento confirmado** conclui o pedido. |
| Cartão de crédito | Valida número, validade e CVV e simula a resposta da operadora. |
| Boleto | Gera um boleto demonstrativo com vencimento em 3 dias. Dá para **simular a compensação** ou **concluir e pagar depois** (o plano fica aguardando pagamento e o painel do cliente mostra o botão **Concluir pagamento**). |

Depois de qualquer pagamento confirmado, a tela final mostra o **comprovante** em formato de documento (pagador, CPF mascarado, item, valor, forma, data, código de autenticação e marca d'água DEMONSTRATIVO fora da produção), com os botões **Baixar comprovante (PDF)** (imprime só o comprovante) e **Enviar por WhatsApp**. No painel, cada fatura paga tem o link **Comprovante**, que reabre essa tela.

Dados para testar:

| Dado | Valor | Resultado |
| --- | --- | --- |
| CPF | `529.982.247-25` | CPF válido de exemplo |
| Cartão | `4111 1111 1111 1111` | Aprovado (Visa) |
| Cartão | `5555 5555 5555 4444` | Aprovado (Mastercard) |
| Cartão | `4000 0000 0000 0002` | Recusado pelo emissor |
| Cartão | `4000 0000 0000 9995` | Limite insuficiente |

Use qualquer nome, validade futura e CVV de 3 dígitos.

Como funciona por dentro:

- `checkout.html`, `css/checkout.css` e `js/checkout.js` formam a página; `js/qrcode.js` desenha o QR Code sem bibliotecas externas.
- Os pedidos ficam em `localStorage`, na chave `fhp_pagamentos`. As funções estão em `js/fhp.js` (`createOrder`, `updateOrder`, `confirmPayment`, `deferPayment`).
- O número e o CVV do cartão nunca são gravados: o pedido guarda só a bandeira e os 4 últimos dígitos.
- Os planos empresariais não têm preço publicado, então o checkout encaminha para o Fale Conosco.

No modo simulado, o código Pix e a linha do boleto não seguem os padrões bancários e não podem ser pagos. Para cobrar de verdade, siga o [PAGAMENTOS.md](PAGAMENTOS.md).

## WhatsApp

O número de atendimento fica em `js/config.js` (`whatsapp: '552135128383'`, o mesmo do site oficial, com DDI e DDD, só números). Deixe vazio para esconder tudo. Com o número preenchido, o site mostra:

- um botão flutuante em todas as páginas, acima do botão do assistente, com uma mensagem pronta conforme a página (plano, pedido ou fatura no checkout, nome do cliente no painel);
- o atalho "Dúvidas? Fale no WhatsApp" em cada plano ("Pedir proposta" nos empresariais);
- o WhatsApp como primeiro canal no Fale Conosco, no rodapé e no cartão "Precisa de ajuda?" do painel;
- o link do WhatsApp nas respostas do assistente sobre contato, contratação e cobertura.

Os botões só abrem a conversa (wa.me); as mensagens são respondidas no WhatsApp da FHP. O código está em `js/whatsapp.js` e `css/whatsapp.css`.

## Assistente

O assistente (`js/bot.js`) funciona sozinho, sem servidor, e já:

- responde sobre qualquer plano por nome, velocidade ou preço ("quanto custa o turbo?", "tem 500 mega?", "o de 79,90");
- recomenda um plano em duas perguntas (pessoas na casa + uso) com o botão **Qual plano é melhor para mim?**;
- confere cobertura na própria conversa por bairro ou CEP (ViaCEP), usando a lista `bairros` de `js/dados.js`;
- explica contratação, pagamento, Wi-Fi fraco, internet lenta, troca de plano, cancelamento, conta e contato — com atalhos diferentes para cliente logado (faturas, chamados);
- muda a saudação conforme a página (planos, checkout com o plano em vista, cliente logado);
- mantém a conversa ao trocar de página, mostra um balão-convite uma vez por visita, recebe avaliação 👍/👎 (guardada em `localStorage.fhp_bot_feedback`) e passa a conversa para a equipe pelo botão **Atendente** (WhatsApp com o resumo).

Com o servidor e a chave da Anthropic, as perguntas livres vão para a IA (que recebe página, nome do cliente e plano em vista como contexto); perguntas sobre planos, CEP e os fluxos guiados continuam locais. Se a IA falhar, as respostas prontas assumem sem a pessoa perceber.

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou superior).
2. Crie uma chave de API em console.anthropic.com.
3. Copie `.env.example` para `.env` e troque `cole-sua-chave-aqui` pela sua chave (o mesmo arquivo guarda as chaves do Mercado Pago).
4. Execute `iniciar.bat` (Windows) ou `./iniciar.sh` (Mac/Linux), ou `node server.js` no terminal.
5. Acesse `http://localhost:3000`.

Nunca coloque a chave nos arquivos `.js` do site nem compartilhe o arquivo `.env`.

## Alterações da revisão de out/2026

**Conteúdo e conversão**
- Rótulos "demonstrativo/TCC" removidos de todo o site (o checkout avisa "modo de teste" só enquanto o Mercado Pago não está ligado).
- Textos novos na Home (benefícios concretos, planos, "como funciona"), Planos, Quem Somos, Portfólio e Fale Conosco.
- Consulta de cobertura por bairro ou CEP (ViaCEP) na Home e em Planos; responde na hora quando `bairros` está preenchido, senão encaminha ao WhatsApp.
- Planos, tabela comparativa e FAQ montados a partir de `js/dados.js`; planos sem preço viram "Pedir proposta" (WhatsApp).
- Fale Conosco sem login envia a mensagem pelo WhatsApp já preenchida (ou e-mail), em vez de ficar só no navegador.
- Páginas `termos.html` e `privacidade.html` (LGPD), linkadas no rodapé, no cadastro e no aceite do checkout.
- Rodapé com CNPJ, endereço, horário, telefone, e-mail e redes (aparecem conforme `dados.js`).
- Checkout preenche rua, bairro e cidade pelo CEP.

**Marca e SEO**
- Logo (`img/logo.svg`, `img/logo-mark.svg`) no cabeçalho, rodapé, painel e favicon; capa `img/og-cover.png` para links no WhatsApp.
- Títulos e descrições por página, `canonical`, Open Graph, `robots.txt`, `sitemap.xml`, dados estruturados (InternetServiceProvider + ofertas + FAQPage).

**Área do cliente e painel**
- "Manter conectado" funciona (sem marcar, a sessão acaba ao fechar o navegador).
- Painel: CPF mascarado para atendimento, filtro por pagamento, contador e exportação CSV; estado vazio no dashboard.
- Assistente reescrito: entende planos por nome/velocidade/preço, recomenda em duas perguntas, confere cobertura na conversa, contexto de página e de cliente logado, conversa persistente, avaliação de respostas e passagem para atendente com resumo.

**Técnico**
- Contas da equipe fictícias (`@fhpfibra.com.br`, nomes inventados) no lugar de e-mails reais.
- `server.js`: cabeçalhos de segurança (CSP, nosniff, frame-ancestors), cache, gzip, limite do rate limit; prompt da IA gerado de `dados.js`.
- Analytics opcional (GA4 ou Plausible) com eventos de ASSINAR, WhatsApp, cobertura e contato.
- Comprovante de pagamento em formato de documento (PDF e WhatsApp); modo "Pagamento demonstrativo" para apresentação (`apresentacao` em `config.js`); número da FHP nas telas de login e cadastro.
- Dados de demonstração (14 clientes, 49 pedidos, 7 chamados) carregados em modo apresentação e controlados em Configurações do admin; dashboard com receita prevista, recebido no mês, gráficos por plano e por situação, últimos cadastros e chamados em andamento; relatório de testes, roteiro e diagrama de arquitetura.
- **Banco de dados online**: servidor com TiDB Cloud/MySQL (ou SQLite local), API REST com JWT e bcrypt, cache no site com fila de gravação, modo local mantido como reserva; 54 testes aprovados nos dois modos.
- Acessibilidade: link "pular para o conteúdo", foco visível, ícones decorativos ocultos de leitores de tela, `noscript` para as seções animadas.
- Celular: botões flutuantes não cobrem o hero nem a consulta de cobertura; CPF validado no cadastro.
