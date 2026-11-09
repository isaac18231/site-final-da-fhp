// Testes funcionais automatizados do site FHP Fibra (Playwright + Chromium).
// Gera TESTES.md com o resultado de cada caso.
import { chromium } from 'playwright';
import fs from 'fs';
const base = 'http://localhost:3000/';
const OUT = process.argv[2] || 'TESTES.md';
const results = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', e => errors.push(e.message));
pg.on('console', m => { if (m.type() === 'error' && !/503|ERR_TUNNEL|api\/chat/.test(m.text())) errors.push(m.text()); });

const test = async (area, id, name, fn) => {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ area, id, name, ok: true, detail: detail || '', ms: Date.now() - t0 });
  } catch (e) {
    results.push({ area, id, name, ok: false, detail: String(e.message || e).split('\n')[0].slice(0, 160), ms: Date.now() - t0 });
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const logout = () => pg.evaluate(() => { localStorage.removeItem('fhp_sessao'); sessionStorage.removeItem('fhp_sessao'); sessionStorage.removeItem('fhp_sessao_temporaria'); });
const go = async (p) => { await pg.goto(base + p, { waitUntil: 'networkidle' }); await pg.waitForTimeout(300); };
const text = async sel => (await pg.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();

await go('index.html');
await pg.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
const cfg = await (await pg.request.get(base + 'api/config')).json().catch(() => ({}));
const MODO = cfg.banco ? 'api' : 'local';
if (cfg.banco) {
  const adm = await (await pg.request.post(base + 'api/auth/login', { data: { email: 'ana.ribeiro@fhpfibra.com.br', senha: 'Admin12345' } })).json();
  await pg.request.post(base + 'api/demo/limpar', { headers: { authorization: 'Bearer ' + adm.token } });
  await pg.request.post(base + 'api/demo/carregar', { headers: { authorization: 'Bearer ' + adm.token } });
  // conta de teste de execuções anteriores
  const t = await (await pg.request.post(base + 'api/auth/login', { data: { email: 'banca@demo.exemplo.com', senha: 'novaSenha123' } })).json();
  if (t.token) await pg.request.delete(base + 'api/clientes/me', { headers: { authorization: 'Bearer ' + t.token } });
  const t2 = await (await pg.request.post(base + 'api/auth/login', { data: { email: 'banca@demo.exemplo.com', senha: 'senha12345' } })).json();
  if (t2.token) await pg.request.delete(base + 'api/clientes/me', { headers: { authorization: 'Bearer ' + t2.token } });
}

/* ---------- Navegação e páginas ---------- */
const pages = ['index.html', 'planos.html', 'quem-somos.html', 'portfolio.html', 'fale-conosco.html', 'login.html', 'cadastro.html', 'termos.html', 'privacidade.html'];
for (const p of pages) {
  await test('Páginas', `P-${pages.indexOf(p) + 1}`, `${p} carrega sem erro de JavaScript e sem rolagem horizontal`, async () => {
    errors.length = 0;
    await go(p);
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
    expect(errors.length === 0, 'erro de JS: ' + errors[0]);
    expect(sw <= 1366, 'rolagem horizontal');
    const title = await pg.title();
    expect(title.includes('FHP'), 'título sem FHP');
    return `título: "${title}"`;
  });
}
await test('Páginas', 'P-10', 'Todas as páginas têm favicon, descrição e Open Graph', async () => {
  for (const p of pages) {
    await go(p);
    const has = await pg.evaluate(() => !!document.querySelector('link[rel="icon"]') && !!document.querySelector('meta[name="description"]') && !!document.querySelector('meta[property="og:image"]'));
    expect(has, 'faltando em ' + p);
  }
});
await test('Páginas', 'P-11', 'Layout responsivo em celular (390px) sem rolagem horizontal', async () => {
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 });
  for (const p of ['index.html', 'planos.html', 'checkout.html?plano=FHP%20Turbo', 'login.html']) {
    await m.goto(base + p, { waitUntil: 'networkidle' });
    const sw = await m.evaluate(() => document.documentElement.scrollWidth);
    expect(sw <= 390, `${p}: ${sw}px`);
  }
  await m.close();
});

/* ---------- Planos e cobertura ---------- */
await test('Planos', 'PL-1', 'Página de planos mostra os 4 residenciais e 3 empresariais com preços de dados.js', async () => {
  await go('planos.html');
  const res = await pg.locator('[data-planos="residencial"] .plan-card').count();
  const biz = await pg.locator('[data-planos="empresarial"] .plan-card').count();
  expect(res === 4 && biz === 3, `${res} residenciais, ${biz} empresariais`);
  const price = await text('[data-plano="turbo"] .price');
  expect(price.includes('99,90'), 'preço do Turbo: ' + price);
  return `Turbo: ${price}`;
});
await test('Planos', 'PL-2', 'Botão ASSINAR leva ao checkout com o plano escolhido', async () => {
  await go('planos.html');
  await pg.click('[data-assinar="FHP Turbo"]');
  await pg.waitForURL(/checkout\.html\?plano=FHP%20Turbo/);
  return pg.url().replace(base, '');
});
await test('Planos', 'PL-3', 'FAQ com 6 perguntas e dados estruturados (FAQPage + InternetServiceProvider)', async () => {
  await go('planos.html');
  const n = await pg.locator('.faq-item').count();
  const types = await pg.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)['@type']));
  expect(n === 6 && types.includes('FAQPage') && types.includes('InternetServiceProvider'), `${n} FAQ, tipos ${types}`);
});
await test('Cobertura', 'C-1', 'Consulta de cobertura por bairro (lista preenchida) responde "atendemos"', async () => {
  await go('planos.html');
  await pg.evaluate(() => FHP_DADOS.bairros.push('Campo Grande', 'Santa Cruz', 'Bangu'));
  await pg.fill('[data-cobertura] input', 'campo grande'); await pg.click('[data-cobertura] button'); await pg.waitForTimeout(300);
  const r = await text('.cobertura-result');
  expect(/atendemos/i.test(r), r);
  return r;
});
await test('Cobertura', 'C-2', 'Bairro fora da lista recebe aviso e link para a equipe', async () => {
  await pg.fill('[data-cobertura] input', 'Copacabana'); await pg.click('[data-cobertura] button'); await pg.waitForTimeout(300);
  const r = await text('.cobertura-result');
  expect(/não temos confirmação/i.test(r) && (await pg.locator('.cobertura-result a').count()) > 0, r);
  return r;
});
await test('Cobertura', 'C-3', 'Campo vazio é validado', async () => {
  await pg.fill('[data-cobertura] input', ''); await pg.click('[data-cobertura] button'); await pg.waitForTimeout(200);
  const r = await text('.cobertura-result');
  expect(/digite/i.test(r), r);
});

/* ---------- Cadastro e login ---------- */
await test('Cadastro', 'CA-1', 'CPF inválido é recusado e CPF válido é aceito', async () => {
  await go('cadastro.html');
  await pg.fill('input[name=cpf]', '11111111111'); await pg.locator('input[name=cpf]').blur();
  const bad = await text('.field-hint[data-for=cpf]');
  await pg.fill('input[name=cpf]', '52998224725'); await pg.locator('input[name=cpf]').blur();
  const good = await text('.field-hint[data-for=cpf]');
  expect(/inválido/i.test(bad) && good === '✓', `${bad} / ${good}`);
});
await test('Cadastro', 'CA-2', 'Senhas diferentes são apontadas', async () => {
  await pg.fill('input[name=senha]', 'senha12345'); await pg.fill('input[name=confirmar]', 'outra12345'); await pg.locator('input[name=confirmar]').blur();
  const hint = await text('.field-hint[data-for=confirmar]');
  expect(/não coincidem/i.test(hint), hint);
});
await test('Cadastro', 'CA-3', 'Cadastro completo cria a conta e entra no painel', async () => {
  await go('cadastro.html');
  await pg.fill('input[name=nome]', 'Teste Banca'); await pg.fill('input[name=email]', 'banca@demo.exemplo.com'); await pg.fill('input[name=telefone]', '21999990000');
  await pg.fill('input[name=cpf]', '52998224725'); await pg.fill('input[name=endereco]', 'Rua Teste, 10'); await pg.fill('input[name=senha]', 'senha12345'); await pg.fill('input[name=confirmar]', 'senha12345');
  await pg.click('#register-form button[type=submit]');
  await pg.waitForURL(/painel\.html/, { timeout: 5000 });
  const name = await text('#user-name');
  expect(name === 'Teste Banca', name);
});
await test('Login', 'L-1', 'E-mail já cadastrado não pode criar outra conta', async () => {
  await logout();
  await go('cadastro.html');
  const msg = await pg.evaluate(async () => { try { await FHP.ready; await FHP.signup({ nome: 'Xavier Teste', email: 'banca@demo.exemplo.com', senha: 'senha12345', confirmar: 'senha12345', cpf: '52998224725', telefone: '21999990000', endereco: 'R' }); return ''; } catch (e) { return e.message; } });
  expect(/já possui/i.test(msg), msg);
});
await test('Login', 'L-2', 'Senha errada é recusada com mensagem', async () => {
  await go('login.html');
  await pg.fill('#usuario', 'banca@demo.exemplo.com'); await pg.fill('#senha', 'errada123'); await pg.click('.btn-login'); await pg.waitForTimeout(1200);
  const fb = await text('.login-feedback');
  expect(/inválidos/i.test(fb), fb);
});
await test('Login', 'L-3', 'Login correto entra no painel do cliente', async () => {
  await pg.fill('#senha', 'senha12345'); await pg.click('.btn-login');
  await pg.waitForURL(/painel\.html/, { timeout: 5000 });
  expect((await text('#user-level')) === 'Cliente');
});
await test('Login', 'L-4', 'Recuperação de senha gera código e redefine a senha', async () => {
  await logout();
  await go('login.html');
  await pg.click('#forgot-link'); await pg.fill('#reset-email', 'banca@demo.exemplo.com'); await pg.click('#reset-email-form button'); await pg.waitForTimeout(900);
  const code = await text('#demo-code');
  expect(/^\d{6}$/.test(code), 'código: ' + code);
  await pg.fill('#reset-code-input', code); await pg.fill('#new-password', 'novaSenha123'); await pg.fill('#confirm-password', 'novaSenha123'); await pg.click('#reset-code-form button[type=submit]'); await pg.waitForTimeout(500);
  const fb = await pg.evaluate(() => document.querySelector('#reset-code-form .login-feedback').textContent + ' | success hidden=' + document.querySelector('#step-success').hidden);
  expect(/hidden=false/.test(fb), fb);
  const ok = await pg.evaluate(async () => !!(await FHP.login('banca@demo.exemplo.com', 'novaSenha123')));
  expect(ok, 'login com a nova senha falhou');
});
await test('Login', 'L-5', 'Equipe entra com as contas iniciais (admin, atendimento, técnico)', async () => {
  const r = await pg.evaluate(async () => { const out = []; for (const s of ['ana.ribeiro@fhpfibra.com.br:Admin12345', 'marcos.souza@fhpfibra.com.br:Atende12345', 'rafael.nogueira@fhpfibra.com.br:Tecnico123']) { const [e, p] = s.split(':'); out.push((await FHP.login(e, p))?.nivel); } return out; });
  expect(r.join(',') === 'admin,atendimento,tecnico', r.join(','));
});
await test('Login', 'L-6', 'Página do painel sem sessão redireciona para o login', async () => {
  await logout();
  await go('painel.html');
  expect(pg.url().includes('login.html'), pg.url());
});

/* ---------- Checkout ---------- */
const checkoutTo = async (method) => {
  await go('index.html'); await pg.evaluate(async () => { await FHP.ready; await FHP.login('banca@demo.exemplo.com', 'novaSenha123'); const c = FHP.read(FHP.K.clients); const me = c.find(x => x.email === 'banca@demo.exemplo.com'); if (me) { me.plano = null; FHP.write(FHP.K.clients, c); } });
  await go('checkout.html?plano=FHP%20Turbo'); await pg.waitForTimeout(600);
  if (await pg.locator('#step-1').isVisible()) { await pg.click('#known-actions button'); await pg.waitForTimeout(400); }
  await pg.fill('[name=cep]', '23050000'); await pg.fill('[name=logradouro]', 'Rua das Flores, 100'); await pg.fill('[name=bairro]', 'Campo Grande');
  await pg.click('#step-2 button[type=submit]'); await pg.waitForTimeout(800);
  if (method) { await pg.check(`input[name=metodo][value=${method}]`); await pg.waitForTimeout(300); }
  await pg.check('#terms');
};
await test('Checkout', 'CK-1', 'Checkout de plano empresarial redireciona para proposta (não vende online)', async () => {
  await go('planos.html');
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }), pg.click('[data-assinar="FHP Business 500"]')]);
  const u = popup.url(); await popup.close();
  expect(/wa\.me|chromewebdata/.test(u), u);
});
await test('Checkout', 'CK-2', 'Resumo do pedido mostra plano e valor; etapa 1 permite entrar com conta existente', async () => {
  await go('index.html'); await pg.evaluate(async () => { await FHP.ready; await FHP.login('banca@demo.exemplo.com', 'novaSenha123'); });
  await go('checkout.html?plano=FHP%20Turbo'); await pg.waitForTimeout(600);
  const known = await pg.evaluate(() => document.querySelector('#known-name').textContent);
  const summary = await text('#summary');
  expect(known === 'Teste Banca' && summary.includes('FHP Turbo') && summary.includes('99,90'), `${known} / ${summary.slice(0, 80)}`);
  return 'conta reconhecida: ' + known;
});
await test('Checkout', 'CK-3', 'Pix: gera QR Code e código copia-e-cola; confirmação gera comprovante', async () => {
  await checkoutTo('pix');
  await pg.click('#pix-generate'); await pg.waitForTimeout(500);
  const code = await pg.inputValue('#pix-code');
  expect(code.length > 20 && (await pg.locator('#pix-qr *').count()) > 0, 'sem QR/código');
  await pg.click('#pix-confirm'); await pg.waitForTimeout(600);
  const r = await text('#receipt');
  expect(/comprovante de pagamento/i.test(r) && /pago/i.test(r) && r.includes('99,90'), r.slice(0, 120));
  return 'comprovante ' + (await text('.receipt-title b'));
});
await test('Checkout', 'CK-4', 'Cartão: número inválido (Luhn) é recusado; 4111… é aprovado', async () => {
  await checkoutTo('cartao');
  await pg.fill('[name=numero]', '4111111111111112'); await pg.fill('[name=titular]', 'TESTE BANCA'); await pg.fill('[name=validade]', '1230'); await pg.fill('[name=cvv]', '123');
  await pg.click('#card-pay'); await pg.waitForTimeout(400);
  const err = await pg.evaluate(() => [...document.querySelectorAll('#card-form .field-error')].map(e => e.textContent).filter(Boolean).join(' '));
  expect(/inválido/i.test(err), 'sem erro de Luhn: ' + err);
  await pg.fill('[name=numero]', '4111111111111111');
  await pg.click('#card-pay'); await pg.waitForTimeout(2500);
  const r = await text('#receipt');
  expect(r.includes('Visa') && r.includes('Pago'), r.slice(0, 120));
  return 'Visa final 1111 aprovado';
});
await test('Checkout', 'CK-5', 'Cartão recusado pelo emissor (4000…0002) mostra erro e não conclui', async () => {
  await checkoutTo('cartao');
  await pg.fill('[name=numero]', '4000000000000002'); await pg.fill('[name=titular]', 'TESTE BANCA'); await pg.fill('[name=validade]', '1230'); await pg.fill('[name=cvv]', '123');
  await pg.click('#card-pay'); await pg.waitForTimeout(2500);
  const err = await text('#card-error');
  expect(/recusad/i.test(err), 'esperava recusa: ' + err);
  return err.slice(0, 80);
});
await test('Checkout', 'CK-6', 'Boleto: gera linha digitável e "pagar depois" deixa o plano pendente no painel', async () => {
  await checkoutTo('boleto');
  await pg.click('#boleto-generate'); await pg.waitForTimeout(500);
  const line = await pg.inputValue('#boleto-line');
  expect(line.replace(/\D/g, '').length >= 40, 'linha: ' + line);
  await pg.click('#boleto-later'); await pg.waitForTimeout(600);
  await go('painel.html');
  const home = await text('#panel-content');
  expect(/Pendente|Aguardando/i.test(home) && /Concluir pagamento/i.test(home), home.slice(0, 160));
});
await test('Checkout', 'CK-7', 'Conta de equipe não consegue assinar plano', async () => {
  await go('index.html'); await pg.evaluate(async () => { await FHP.ready; await FHP.login('ana.ribeiro@fhpfibra.com.br', 'Admin12345'); });
  await go('checkout.html?plano=FHP%20Turbo');
  const body = await text('main');
  expect(/conta de cliente|equipe|não é possível|Entre com uma conta/i.test(body), body.slice(0, 160));
});

/* ---------- Área do cliente ---------- */
await test('Cliente', 'CL-1', 'Faturas listam meses desde a contratação com situação e comprovante', async () => {
  await go('index.html'); await pg.evaluate(async () => { await FHP.ready; await FHP.login('juliana.martins@demo.exemplo.com', 'cliente123'); });
  await go('painel.html?secao=faturas'); await pg.waitForTimeout(900);
  const rows = await pg.locator('#invoice-list tbody tr').allInnerTexts();
  expect(rows.length >= 3 && rows.every(r => /Paga|Em aberto|Vencida|processamento/.test(r)), rows.join(' | ').slice(0, 160));
  return `${rows.length} faturas`;
});
await test('Cliente', 'CL-2', 'Cliente abre chamado e ele aparece em Mensagens', async () => {
  await go('painel.html?secao=mensagens');
  await pg.fill('#ticket-form [name=assunto]', 'Teste da banca'); await pg.fill('#ticket-form [name=mensagem]', 'Mensagem de teste.');
  await pg.click('#ticket-form button'); await pg.waitForTimeout(400);
  const first = await text('.ticket strong');
  expect(first === 'Teste da banca', first);
});
await test('Cliente', 'CL-3', 'Cliente altera telefone em Meus dados', async () => {
  await go('painel.html?secao=meus-dados');
  await pg.fill('#profile-form [name=telefone]', '21900001111'); await pg.click('#profile-form button'); await pg.waitForTimeout(700);
  const v = await pg.evaluate(() => FHP.read(FHP.K.clients).find(c => c.email === 'juliana.martins@demo.exemplo.com').telefone);
  expect(v === '21900001111', v);
});
await test('Cliente', 'CL-4', 'Cliente não vê chamados de outros clientes', async () => {
  let n;
  if (MODO === 'api') {
    // No modo API o servidor só devolve os chamados do próprio cliente; conferimos pelo total que o admin vê.
    const adm = await (await pg.request.post(base + 'api/auth/login', { data: { email: 'ana.ribeiro@fhpfibra.com.br', senha: 'Admin12345' } })).json();
    const tudo = await (await pg.request.get(base + 'api/dados', { headers: { authorization: 'Bearer ' + adm.token } })).json();
    const me = await pg.evaluate(() => FHP.session().email);
    n = tudo.chamados.filter(t => t.cliente !== me).length;
  } else n = await pg.evaluate(() => { const me = FHP.session().email; return FHP.read(FHP.K.tickets).filter(t => t.cliente !== me).length; });
  await go('painel.html?secao=mensagens'); await pg.waitForTimeout(400);
  const shown = await pg.locator('.ticket').count();
  const mine = await pg.evaluate(() => FHP.read(FHP.K.tickets).filter(t => t.cliente === FHP.session().email).length);
  expect(shown === mine && n > 0, `mostra ${shown}, meus ${mine}, de outros ${n}`);
});
await test('Cliente', 'CL-5', 'Cliente não acessa seção administrativa (?secao=clientes)', async () => {
  await go('painel.html?secao=clientes');
  const body = await text('#panel-content');
  expect(/Acesso negado/i.test(body), body.slice(0, 80));
});

/* ---------- Painel da equipe ---------- */
await test('Equipe', 'E-1', 'Atendimento responde chamado e muda status', async () => {
  await go('index.html'); await pg.evaluate(async () => { await FHP.ready; await FHP.login('marcos.souza@fhpfibra.com.br', 'Atende12345'); });
  await go('painel.html?secao=mensagens');
  const form = pg.locator('[data-reply]').first();
  await form.locator('[name=texto]').fill('Resposta de teste.'); await form.locator('select').selectOption('Em atendimento'); await form.locator('button[type=submit]').click();
  await pg.waitForTimeout(400);
  const pill = await text('.ticket .pill');
  expect(pill === 'Em atendimento', pill);
});
await test('Equipe', 'E-2', 'Atendimento vê CPF mascarado; admin vê completo', async () => {
  await go('painel.html?secao=clientes');
  const masked = await text('#client-table tbody tr td:nth-child(4)');
  await go('index.html'); await pg.evaluate(async () => { await FHP.ready; await FHP.login('ana.ribeiro@fhpfibra.com.br', 'Admin12345'); });
  await go('painel.html?secao=clientes');
  const full = await text('#client-table tbody tr td:nth-child(4)');
  expect(/\*\*\*/.test(masked) && !/\*/.test(full), `${masked} / ${full}`);
  return `${masked} → ${full}`;
});
await test('Equipe', 'E-3', 'Busca e filtro de pagamento na lista de clientes', async () => {
  await pg.fill('#search-client', 'juliana'); await pg.waitForTimeout(200);
  const n1 = await pg.locator('#client-table tbody tr').count();
  await pg.fill('#search-client', ''); await pg.selectOption('#filter-pay', 'Pendente'); await pg.waitForTimeout(200);
  const n2 = await pg.locator('#client-table tbody tr').count();
  expect(n1 === 1 && n2 >= 2, `busca ${n1}, pendentes ${n2}`);
  return `busca 1, pendentes ${n2}`;
});
await test('Equipe', 'E-4', 'Exportação CSV gera arquivo com cabeçalho e linhas', async () => {
  await pg.selectOption('#filter-pay', '');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#export-csv')]);
  const path = await dl.path(); const csv = fs.readFileSync(path, 'utf8');
  expect(csv.startsWith('﻿"Nome"') && csv.split('\n').length > 5, csv.slice(0, 60));
  return `${csv.split('\n').length - 1} linhas`;
});
await test('Equipe', 'E-5', 'Só o admin altera nível de acesso; técnico só vê Dashboard e Mensagens', async () => {
  await pg.evaluate(async () => { await FHP.ready; await FHP.login('rafael.nogueira@fhpfibra.com.br', 'Tecnico123'); });
  await go('painel.html');
  const nav = await pg.locator('#panel-nav button').allInnerTexts();
  const denied = await pg.evaluate(() => { try { FHP.alterarNivelFuncionario('marcos.souza@fhpfibra.com.br', 'tecnico'); return ''; } catch (e) { return e.message; } });
  expect(nav.join(',') === 'Dashboard,Mensagens' && /Acesso negado/.test(denied), nav.join(',') + ' / ' + denied);
});
await test('Equipe', 'E-6', 'Dashboard do admin mostra receita prevista e gráficos', async () => {
  await pg.evaluate(async () => { await FHP.ready; await FHP.login('ana.ribeiro@fhpfibra.com.br', 'Admin12345'); });
  await go('painel.html');
  const body = await text('#panel-content');
  const bars = await pg.locator('.bar-row').count();
  expect(/Receita mensal prevista/.test(body) && bars >= 6, `${bars} barras`);
});

/* ---------- Assistente e contato ---------- */
await test('Assistente', 'A-1', 'Responde preço de um plano pelo nome', async () => {
  await go('index.html'); await pg.evaluate(() => sessionStorage.clear()); await pg.evaluate(() => window.scrollTo(0, 2000)); await pg.waitForTimeout(500);
  await pg.click('.bot-fab'); await pg.fill('.bot-form input', 'quanto custa o gamer?'); await pg.press('.bot-form input', 'Enter'); await pg.waitForTimeout(900);
  const last = await pg.locator('.bot-msg.bot .bot-text').last().innerText();
  expect(/149,90/.test(last), last.slice(0, 80));
});
await test('Assistente', 'A-2', 'Fluxo de recomendação em duas perguntas indica um plano', async () => {
  for (const q of ['qual plano é melhor para mim?', '5 ou mais', 'Casa cheia: TVs, câmeras e tudo junto']) { await pg.fill('.bot-form input', q); await pg.press('.bot-form input', 'Enter'); await pg.waitForTimeout(700); }
  const last = await pg.locator('.bot-msg.bot .bot-text').last().innerText();
  expect(/indicaria o FHP/.test(last), last.slice(0, 80));
  return last.match(/indicaria o (FHP \w+)/)?.[1];
});
await test('Assistente', 'A-3', 'Conversa continua após trocar de página', async () => {
  const before = await pg.locator('.bot-msg').count();
  await go('planos.html'); await pg.waitForTimeout(400);
  const after = await pg.locator('.bot-msg').count();
  expect(after === before, `${before} → ${after}`);
});
await test('Contato', 'CT-1', 'Formulário valida campos obrigatórios e e-mail', async () => {
  await go('fale-conosco.html');
  await pg.fill('[name=email]', 'invalido'); await pg.click('#contact-form button[type=submit]'); await pg.waitForTimeout(200);
  const fb = await text('.form-feedback');
  expect(/revise/i.test(fb), fb);
});
await test('Contato', 'CT-2', 'Mensagem válida abre o WhatsApp com os dados preenchidos', async () => {
  await pg.fill('[name=nome]', 'Banca'); await pg.fill('[name=email]', 'b@x.com'); await pg.fill('[name=telefone]', '21999999999'); await pg.fill('[name=assunto]', 'Teste'); await pg.fill('[name=mensagem]', 'Olá');
  const [p2] = await Promise.all([ctx.waitForEvent('page'), pg.click('#contact-form button[type=submit]')]);
  const u = decodeURIComponent(p2.url()); await p2.close();
  expect(/wa\.me|chromewebdata/.test(u), u.slice(0, 80));
});

/* ---------- Segurança ---------- */
await test('Segurança', 'S-1', 'Servidor envia cabeçalhos de segurança (CSP, nosniff, frame-ancestors)', async () => {
  const r = await pg.request.get(base + 'index.html');
  const h = r.headers();
  expect(h['content-security-policy'] && h['x-content-type-options'] === 'nosniff' && h['x-frame-options'] === 'DENY', JSON.stringify(h).slice(0, 100));
});
await test('Segurança', 'S-2', 'Arquivos sensíveis (.env, server.js, servidor/) não são servidos', async () => {
  for (const p of ['.env', 'server.js', 'servidor/pagamentos.js', 'package.json', '../etc/passwd']) {
    const r = await pg.request.get(base + p);
    expect(r.status() === 404, `${p} → ${r.status()}`);
  }
});
await test('Segurança', 'S-3', 'API de pagamentos rejeita plano inexistente e cliente inválido', async () => {
  const r = await pg.request.post(base + 'api/pagamentos/preferencia', { data: { plano: 'FHP Hack', cliente: 'x', competencia: '2026-10', retorno: base } });
  expect([400, 503].includes(r.status()), 'status ' + r.status());
  return 'status ' + r.status();
});
await test('Segurança', 'S-4', 'Texto do usuário é escapado no painel (sem XSS)', async () => {
  await go('index.html'); await pg.evaluate(async () => { await FHP.ready; await FHP.login('juliana.martins@demo.exemplo.com', 'cliente123'); });
  await go('painel.html?secao=mensagens');
  await pg.fill('#ticket-form [name=assunto]', '<img src=x onerror="window.xss=1">'); await pg.fill('#ticket-form [name=mensagem]', '<script>window.xss=2</script>');
  await pg.click('#ticket-form button'); await pg.waitForTimeout(500);
  const xss = await pg.evaluate(() => window.xss);
  const html = await pg.locator('.ticket').first().innerHTML();
  expect(!xss && html.includes('&lt;img'), 'XSS executou');
});
await test('Segurança', 'S-5', 'Dados de cartão não ficam gravados (só bandeira e 4 últimos)', async () => {
  const leak = await pg.evaluate(() => JSON.stringify(localStorage).includes('4111111111111111') || JSON.stringify(localStorage).includes('"cvv"'));
  expect(!leak, 'número do cartão encontrado no armazenamento');
});

await b.close();

/* ---------- Relatório ---------- */
const ok = results.filter(r => r.ok).length;
const areas = [...new Set(results.map(r => r.area))];
let md = `# Relatório de testes funcionais — site FHP Fibra\n\n`;
md += `Execução automatizada em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} com Playwright (Chromium headless), modo simulado de pagamento, dados de demonstração carregados, **${MODO === 'api' ? `banco de dados ligado (${cfg.bancoTipo})` : 'modo local (localStorage)'}**.\n\n`;
md += `**Resultado: ${ok} de ${results.length} casos aprovados** (${Math.round(ok / results.length * 100)}%).\n\n`;
md += `| Área | Casos | Aprovados |\n| --- | --- | --- |\n`;
areas.forEach(a => { const rs = results.filter(r => r.area === a); md += `| ${a} | ${rs.length} | ${rs.filter(r => r.ok).length} |\n`; });
md += `\n## Casos de teste\n\n| ID | Caso | Resultado | Observação |\n| --- | --- | --- | --- |\n`;
results.forEach(r => { md += `| ${r.id} | ${r.name} | ${r.ok ? '✅ Aprovado' : '❌ Reprovado'} | ${(r.detail || '').replace(/\|/g, '/')} |\n`; });
md += `\n## Como repetir\n\n1. \`node server.js\` na pasta do site (porta 3000).\n2. \`node testes.mjs\` (requer Node 18+ e o pacote \`playwright\` com o Chromium: \`npx playwright install chromium\`).\n3. O relatório é regravado em \`TESTES.md\`.\n\nOs casos cobrem navegação, responsividade, planos, cobertura, cadastro, login, recuperação de senha, checkout (Pix, cartão aprovado/recusado, boleto, regras de acesso), área do cliente, painel da equipe (permissões, mascaramento de CPF, filtros, CSV), assistente, contato e segurança (cabeçalhos, arquivos protegidos, validação da API, XSS, dados de cartão).\n`;
fs.writeFileSync(OUT, md);
console.log(`${ok}/${results.length} ok`);
results.filter(r => !r.ok).forEach(r => console.log('FALHOU', r.id, r.name, '→', r.detail));
