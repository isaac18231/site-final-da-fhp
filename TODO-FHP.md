# O que falta preencher para o site ir ao ar como oficial

Tudo abaixo é informação que só a FHP tem. Quase tudo entra em **um único arquivo**, `js/dados.js`,
e aparece automaticamente no site, no assistente e nas páginas de Termos e Privacidade.

## 1. Dados da empresa (`js/dados.js` → `empresa`) — já preenchidos com o site oficial

Preenchido a partir de fhpfibra.com.br: razão social FHP Telecomunicações Ltda., CNPJ 10.749.608/0001-77,
endereço (Centro Empresarial Rodelão, Bangu, CEP 21864-221), telefone/WhatsApp (21) 3512-8383,
sac@fhpfibra.com.br, ouvidoria@fhpfibra.com.br, Instagram e Facebook. **Confira** e preencha o que falta:

| Campo | Onde aparece | Situação |
| --- | --- | --- |
| `horario` | Rodapé, assistente, Termos | Vazio — um site de terceiros cita "segunda a sábado, 8h às 18h", mas não está no site oficial; confirmar |
| `telefone` 0800 | Rodapé | Um site de terceiros cita 0800 940 3963; não está no site oficial; confirmar antes de usar |
| WhatsApp | Botões em todo o site (`js/config.js`) | (21) 3512-8383, o mesmo link wa.me do site oficial. Se o atendimento usar outro número (ex.: celular), troque ali |
| `site` | Links canônicos e capa do WhatsApp | Trocar quando o site for para fhpfibra.com.br ou domínio próprio |

## 2. Bairros atendidos (`js/dados.js` → `bairros`)

Lista como `['Campo Grande', 'Santa Cruz', 'Bangu']`. Com ela preenchida, a consulta de cobertura
responde na hora ("atendemos em Campo Grande!"); vazia, ela só encaminha para o WhatsApp.

## 3. Planos (`js/dados.js` → `planos`) — confirmar antes de publicar

- Os **preços** (79,90 / 99,90 / 119,90 / 149,90) são os que estavam no projeto. Confirmar.
- **Upload** de cada plano (campo `upload`, em Mega). Só aparece se preenchido.
- O site afirma hoje: *Wi-Fi incluso*, *instalação inclusa*, *suporte pelo WhatsApp*, *roteador em comodato*.
  Se algum não for verdade, ajuste em `destaques` e na FAQ (`faq`).
- **Fidelidade** (12 meses?), **taxa de instalação** e **prazo de instalação** não estão escritos em
  lugar nenhum. Se existirem, precisam entrar na FAQ e nos Termos.
- Planos empresariais estão como "Preço sob consulta" → botão "Pedir proposta" no WhatsApp.

## 4. Termos de uso e Política de privacidade

`termos.html` e `privacidade.html` foram escritos com regras comuns do setor (devolução em 7 dias,
reajuste com 30 dias de aviso, suspensão por atraso, comodato dos equipamentos, guarda de registros
pelo Marco Civil). **Um advogado precisa revisar** antes de ir ao ar — principalmente prazos, multa de
fidelidade (se houver) e o contrato de adesão registrado na Anatel.

## 5. Fotos e marca

- O logo atual (`img/logo.svg`, `img/logo-mark.svg`) foi criado para o site. Se a FHP já tem logo oficial,
  substitua os dois arquivos mantendo os nomes (e gere de novo `favicon-32.png`, `apple-touch-icon.png`
  e `og-cover.png`).
- O site não tem nenhuma foto real. Para ganhar confiança: técnico instalando, equipe, loja/sede,
  eventos na comunidade. Lugares que mais pedem foto: hero da Home, Quem Somos, Portfólio.

## 6. Contas da equipe

Com o banco ligado, as contas da equipe são criadas no banco na primeira execução, com as senhas do `.env`
(`ADMIN_SENHA`, `ATENDIMENTO_SENHA`, `TECNICO_SENHA`) — defina senhas fortes ali antes de rodar pela primeira vez.
No modo local elas ficam em `js/fhp.js` (público): troque as senhas iniciais ou remova a lista.

## 7. Configurações técnicas

- `js/config.js` → `apiUrl`: endereço do servidor (Render) para ligar o Mercado Pago. Veja `PAGAMENTOS.md`.
- `js/config.js` → `apresentacao`: deixe `true` para a apresentação do TCC ("Pagamento demonstrativo"); mude para `false` ao publicar como site oficial (vira "modo de teste" até o Mercado Pago entrar).
- `js/config.js` → `analytics`: `{ ga4: 'G-XXXX' }` ou `{ plausible: 'seudominio.com.br' }`.
- Domínio próprio: trocar `empresa.site` em `js/dados.js` e a base dos links `canonical`/`og:url`
  nos HTMLs (busca e substitui `https://isaac18231.github.io/Site-fhp-tcc/`), além de `robots.txt`
  e `sitemap.xml`.
- Banco de dados: siga o `BANCO.md` (criar o banco no TiDB Cloud, `DATABASE_URL` e `JWT_SECRET` no Render).
  Sem isso o site continua no modo local (dados só no navegador de cada pessoa).
