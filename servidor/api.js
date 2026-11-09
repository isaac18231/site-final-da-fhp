/* API REST do site FHP Fibra (contas, planos contratados, pedidos/faturas, chamados, equipe).
   Só entra em ação quando o banco está ligado (DATABASE_URL). Autenticação por JWT no
   cabeçalho "Authorization: Bearer <token>"; senhas guardadas com bcrypt.

   Rotas (todas JSON):
     GET    /api/config                      modo do servidor (banco, pagamentos)
     POST   /api/auth/cadastro               cria cliente e devolve token
     POST   /api/auth/login                  equipe ou cliente → token
     POST   /api/auth/recuperar              gera código de redefinição
     POST   /api/auth/redefinir              troca a senha com o código
     GET    /api/dados                       tudo que o usuário logado pode ver (cache do site)
     PUT    /api/clientes/me                 atualiza dados / senha do cliente
     DELETE /api/clientes/me                 apaga a conta do cliente
     POST   /api/pedidos                     cria pedido (contratação ou fatura)
     PATCH  /api/pedidos/:id                 forma de pagamento, status, detalhes
     POST   /api/chamados                    cliente abre chamado
     POST   /api/chamados/visitante          Fale Conosco sem conta
     POST   /api/chamados/:id/mensagens      resposta (cliente ou equipe) e status
     PATCH  /api/chamados/:id                encerrar (equipe)
     PATCH  /api/equipe/:email               nível de acesso (admin)
     POST   /api/demo/carregar | /limpar     dados de demonstração (admin) */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const banco = require('./banco');
const DADOS = require('../js/dados');
const DEMO = require('../js/demo');

const SEGREDO = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('AVISO: sem JWT_SECRET no .env — os logins caem a cada reinício do servidor.');
const TOKEN_DIAS = 30;
const EMAIL = /^\S+@\S+\.\S+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Erro extends Error { constructor(code, message) { super(message); this.code = code; } }
const erro = (code, message) => { throw new Erro(code, message); };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const agora = () => new Date().toISOString();
const texto = (v, max = 255) => String(v ?? '').trim().slice(0, max);
const digitos = v => String(v || '').replace(/\D/g, '');
const parse = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

/* ---------- Planos (mesma tabela do site e do Mercado Pago) ---------- */
const formatar = DADOS.formatarValor;
const PLANOS = DADOS.planos.map(p => ({ nome: p.nome, velocidade: p.velocidade, valor: formatar(p.valor), numero: p.valor ? Number(p.valor) : 0, slug: p.slug }));
const planoPorNome = nome => PLANOS.find(p => p.nome === nome);
const planSlug = name => String(name || '').replace(/^FHP\s+/i, '').trim().toLowerCase().replace(/\s+/g, '-');
const paymentRef = (id, month, planName) => `FHP:${String(id).toLowerCase()}:${month}:${planSlug(planName)}`;
const pad = n => String(n).padStart(2, '0');
const monthOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/* ---------- Mapeamento linha ↔ objeto do site ---------- */
const cliente = r => r && ({
  id: r.id, nome: r.nome, email: r.email, telefone: r.telefone || '', cpf: r.cpf || '', endereco: r.endereco || '',
  enderecoInstalacao: r.endereco_instalacao || undefined, preferencias: !!Number(r.preferencias),
  plano: parse(r.plano_json, null), criadoEm: r.criado_em
});
const pedido = r => r && ({
  id: r.id, tipo: r.tipo, competencia: r.competencia, ref: r.ref, cliente: r.cliente_email, nome: r.nome,
  plano: parse(r.plano_json, {}), valor: Number(r.valor), endereco: r.endereco, instalacao: parse(r.instalacao_json, null),
  vencimento: r.vencimento, metodo: r.metodo, status: r.status, criadoEm: r.criado_em, pagoEm: r.pago_em, detalhes: parse(r.detalhes_json, {})
});
const chamado = r => r && ({
  id: r.id, cliente: r.cliente_email, nome: r.nome, email: r.email || undefined, telefone: r.telefone || undefined,
  data: r.data, hora: r.hora, assunto: r.assunto, status: r.status, mensagens: parse(r.mensagens_json, []), criadoEm: r.criado_em
});
const membro = r => r && ({ email: r.email, nome: r.nome, cargo: r.cargo, nivel: r.nivel, status: r.status });

/* ---------- Autenticação ---------- */
const token = user => jwt.sign({ email: user.email, nome: user.nome, nivel: user.nivel }, SEGREDO, { expiresIn: `${TOKEN_DIAS}d` });
const usuario = req => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) return null;
  try { return jwt.verify(m[1], SEGREDO); } catch { return null; }
};
const exigir = (req, niveis) => {
  const u = usuario(req);
  if (!u) erro(401, 'Entre na sua conta para continuar.');
  if (niveis && !niveis.includes(u.nivel)) erro(403, 'Você não tem permissão para esta ação.');
  return u;
};
const ehEquipe = u => u.nivel !== 'cliente';

const buscarCliente = async email => cliente((await banco.query('SELECT * FROM clientes WHERE email = ?', [email]))[0]);
const buscarMembro = async email => (await banco.query('SELECT * FROM equipe WHERE email = ?', [email]))[0];

/* ---------- Limite simples para login/cadastro ---------- */
const tentativas = new Map();
const limitar = (ip, max, rota = 'geral') => {
  const now = Date.now();
  const chave = `${rota}|${ip}`;
  const list = (tentativas.get(chave) || []).filter(t => now - t < 60000);
  list.push(now);
  tentativas.set(chave, list);
  if (tentativas.size > 5000) tentativas.clear();
  if (list.length > max) erro(429, 'Muitas tentativas. Aguarde um minuto.');
};

/* ---------- Regras de negócio compartilhadas ---------- */
const aplicarPedidoAoCliente = async (p, pago) => {
  if (p.tipo === 'fatura') return;
  const c = await buscarCliente(p.cliente);
  if (!c) return;
  const plano = { ...p.plano, vencimento: p.vencimento, status: pago ? 'Ativo' : 'Aguardando pagamento', pagamento: pago ? 'Pago' : 'Pendente', pedido: p.id, inicio: p.competencia || monthOf(new Date(p.criadoEm)) };
  await banco.run('UPDATE clientes SET endereco_instalacao = ?, plano_json = ? WHERE email = ?', [p.endereco, JSON.stringify(plano), p.cliente]);
};

// Usado pelo webhook/consulta do Mercado Pago: marca o pedido da referência como pago.
const marcarPagamento = async (ref, info) => {
  if (!banco.ativo() || !ref || info?.status !== 'pago') return false;
  const rows = await banco.query('SELECT * FROM pedidos WHERE ref = ? AND status <> ?', [ref, 'Pago']);
  if (!rows.length) return false;
  for (const r of rows) {
    const p = pedido(r);
    const detalhes = { ...p.detalhes, mpId: info.id, bandeira: info.bandeira || '', final: info.final || '' };
    await banco.run('UPDATE pedidos SET status = ?, metodo = ?, pago_em = ?, detalhes_json = ? WHERE id = ?', ['Pago', info.metodo || p.metodo || 'mercadopago', info.pagoEm || agora(), JSON.stringify(detalhes), p.id]);
    await aplicarPedidoAoCliente({ ...p, status: 'Pago' }, true);
  }
  return true;
};

/* ---------- Rotas ---------- */
const rotas = {
  'GET /api/dados': async (req) => {
    const u = exigir(req);
    if (ehEquipe(u)) {
      const [clientes, pedidos, chamados, equipe] = await Promise.all([
        banco.query('SELECT * FROM clientes ORDER BY criado_em DESC'),
        banco.query('SELECT * FROM pedidos ORDER BY criado_em DESC'),
        banco.query('SELECT * FROM chamados ORDER BY criado_em DESC'),
        banco.query('SELECT * FROM equipe ORDER BY nome')
      ]);
      return { clientes: clientes.map(cliente), pedidos: pedidos.map(pedido), chamados: chamados.map(chamado), equipe: equipe.map(membro), usuario: u };
    }
    const [c, pedidos, chamados] = await Promise.all([
      buscarCliente(u.email),
      banco.query('SELECT * FROM pedidos WHERE cliente_email = ? ORDER BY criado_em DESC', [u.email]),
      banco.query('SELECT * FROM chamados WHERE cliente_email = ? ORDER BY criado_em DESC', [u.email])
    ]);
    if (!c) erro(401, 'Conta não encontrada. Entre de novo.');
    return { clientes: [c], pedidos: pedidos.map(pedido), chamados: chamados.map(chamado), equipe: [], usuario: { ...u, nome: c.nome } };
  },

  'POST /api/auth/cadastro': async (req, body, ip) => {
    limitar(ip, 10, 'cadastro');
    const email = texto(body.email, 160).toLowerCase();
    const senha = String(body.senha || '');
    if (!EMAIL.test(email)) erro(400, 'Informe um e-mail válido.');
    if (senha.length < 8) erro(400, 'A senha deve ter pelo menos 8 caracteres.');
    if (texto(body.nome).length < 2) erro(400, 'Informe seu nome.');
    if (!digitos(body.cpf) || !digitos(body.telefone)) erro(400, 'CPF e telefone são obrigatórios.');
    if (await buscarCliente(email) || await buscarMembro(email)) erro(409, 'Este e-mail já possui uma conta.');
    const id = crypto.randomUUID();
    await banco.run('INSERT INTO clientes (id, nome, email, senha_hash, telefone, cpf, endereco, preferencias, plano_json, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, texto(body.nome, 120), email, await bcrypt.hash(senha, 10), digitos(body.telefone).slice(0, 20), digitos(body.cpf).slice(0, 14), texto(body.endereco), 1, null, agora()]);
    const c = await buscarCliente(email);
    const user = { email, nome: c.nome, nivel: 'cliente' };
    return { token: token(user), usuario: user, cliente: c };
  },

  'POST /api/auth/login': async (req, body, ip) => {
    limitar(ip, 60, 'login');
    const email = texto(body.email, 160).toLowerCase();
    limitar(`${ip}|${email}`, 12, 'login-conta'); // força bruta numa conta específica
    const senha = String(body.senha || '');
    const m = await buscarMembro(email);
    if (m && m.status === 'Ativo' && await bcrypt.compare(senha, m.senha_hash)) {
      const user = { email: m.email, nome: m.nome, nivel: m.nivel };
      return { token: token(user), usuario: user };
    }
    const rows = await banco.query('SELECT * FROM clientes WHERE email = ?', [email]);
    if (rows.length && await bcrypt.compare(senha, rows[0].senha_hash)) {
      const user = { email, nome: rows[0].nome, nivel: 'cliente' };
      return { token: token(user), usuario: user, cliente: cliente(rows[0]) };
    }
    erro(401, 'E-mail ou senha inválidos.');
  },

  'POST /api/auth/recuperar': async (req, body, ip) => {
    limitar(ip, 5, 'recuperar');
    const email = texto(body.email, 160).toLowerCase();
    if (!(await buscarCliente(email)) && !(await buscarMembro(email))) erro(404, 'Não encontramos uma conta com esse e-mail.');
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await banco.run('DELETE FROM redefinicoes WHERE email = ?', [email]);
    await banco.run('INSERT INTO redefinicoes (email, codigo, expira_em) VALUES (?, ?, ?)', [email, codigo, expira]);
    // Sem serviço de e-mail configurado, o código volta na resposta e o site o mostra na tela.
    const enviado = await enviarEmail(email, 'Código para redefinir sua senha', `Seu código FHP Fibra: ${codigo} (vale por 10 minutos).`);
    return enviado ? { enviado: true, expira } : { enviado: false, codigoVisivel: true, codigo, expira };
  },

  'POST /api/auth/redefinir': async (req, body, ip) => {
    limitar(ip, 10, 'redefinir');
    const email = texto(body.email, 160).toLowerCase();
    const senha = String(body.senha || '');
    const [r] = await banco.query('SELECT * FROM redefinicoes WHERE email = ?', [email]);
    if (!r || r.codigo !== texto(body.codigo, 6)) erro(400, 'Código de verificação inválido.');
    if (new Date(r.expira_em) < new Date()) { await banco.run('DELETE FROM redefinicoes WHERE email = ?', [email]); erro(400, 'O código expirou. Solicite um novo código.'); }
    if (senha.length < 8) erro(400, 'A nova senha deve ter pelo menos 8 caracteres.');
    const hash = await bcrypt.hash(senha, 10);
    const n = (await banco.run('UPDATE clientes SET senha_hash = ? WHERE email = ?', [hash, email])).changes
      || (await banco.run('UPDATE equipe SET senha_hash = ? WHERE email = ?', [hash, email])).changes;
    if (!n) erro(404, 'Conta não encontrada.');
    await banco.run('DELETE FROM redefinicoes WHERE email = ?', [email]);
    return { ok: true };
  },

  'PUT /api/clientes/me': async (req, body) => {
    const u = exigir(req, ['cliente']);
    const atual = await banco.query('SELECT * FROM clientes WHERE email = ?', [u.email]);
    if (!atual.length) erro(404, 'Conta não encontrada.');
    const c = atual[0];
    const novoEmail = body.email !== undefined ? texto(body.email, 160).toLowerCase() : c.email;
    if (!EMAIL.test(novoEmail)) erro(400, 'Informe um e-mail válido.');
    if (novoEmail !== c.email && (await buscarCliente(novoEmail) || await buscarMembro(novoEmail))) erro(409, 'Este e-mail já está em uso.');
    let hash = c.senha_hash;
    if (body.senha) {
      if (!body.senhaAtual || !(await bcrypt.compare(String(body.senhaAtual), c.senha_hash))) erro(400, 'A senha atual não confere.');
      if (String(body.senha).length < 8) erro(400, 'A nova senha deve ter pelo menos 8 caracteres.');
      hash = await bcrypt.hash(String(body.senha), 10);
    }
    await banco.run('UPDATE clientes SET nome = ?, email = ?, senha_hash = ?, telefone = ?, endereco = ?, preferencias = ? WHERE email = ?', [
      body.nome !== undefined ? texto(body.nome, 120) : c.nome, novoEmail, hash,
      body.telefone !== undefined ? texto(body.telefone, 20) : c.telefone,
      body.endereco !== undefined ? texto(body.endereco) : c.endereco,
      body.preferencias !== undefined ? (body.preferencias ? 1 : 0) : c.preferencias, c.email]);
    if (novoEmail !== c.email) {
      await banco.run('UPDATE pedidos SET cliente_email = ? WHERE cliente_email = ?', [novoEmail, c.email]);
      await banco.run('UPDATE chamados SET cliente_email = ? WHERE cliente_email = ?', [novoEmail, c.email]);
    }
    const novo = await buscarCliente(novoEmail);
    const user = { email: novoEmail, nome: novo.nome, nivel: 'cliente' };
    return { cliente: novo, token: token(user), usuario: user };
  },

  'DELETE /api/clientes/me': async (req) => {
    const u = exigir(req, ['cliente']);
    await banco.run('DELETE FROM chamados WHERE cliente_email = ?', [u.email]);
    await banco.run('DELETE FROM pedidos WHERE cliente_email = ?', [u.email]);
    await banco.run('DELETE FROM clientes WHERE email = ?', [u.email]);
    return { ok: true };
  },

  'POST /api/pedidos': async (req, body) => {
    const u = exigir(req, ['cliente']);
    const c = await buscarCliente(u.email);
    if (!c) erro(404, 'Conta não encontrada.');
    const plano = planoPorNome(body.plano);
    if (!plano || !plano.numero) erro(400, 'Este plano não está disponível para contratação online.');
    const tipo = body.tipo === 'fatura' ? 'fatura' : 'plano';
    const competencia = /^\d{4}-(0[1-9]|1[0-2])$/.test(body.competencia || '') ? body.competencia : monthOf(new Date());
    let id = /^FHP-\d{6}$/.test(body.id || '') ? body.id : null;
    if (id && (await banco.query('SELECT id FROM pedidos WHERE id = ?', [id])).length) id = null;
    while (!id) {
      id = `FHP-${Math.floor(100000 + Math.random() * 900000)}`;
      if ((await banco.query('SELECT id FROM pedidos WHERE id = ?', [id])).length) id = null;
    }
    const p = {
      id, tipo, competencia, ref: paymentRef(c.id, competencia, plano.nome), cliente: c.email, nome: c.nome,
      plano: { nome: plano.nome, velocidade: plano.velocidade, valor: plano.valor }, valor: plano.numero,
      endereco: texto(body.endereco), instalacao: body.instalacao && typeof body.instalacao === 'object' ? body.instalacao : null,
      vencimento: String(Number(body.vencimento) || 10), metodo: null, status: 'Aguardando pagamento', criadoEm: agora(), pagoEm: null, detalhes: {}
    };
    await banco.run('INSERT INTO pedidos (id, tipo, competencia, ref, cliente_email, nome, plano_json, valor, endereco, instalacao_json, vencimento, metodo, status, criado_em, pago_em, detalhes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.tipo, p.competencia, p.ref, p.cliente, p.nome, JSON.stringify(p.plano), p.valor, p.endereco, p.instalacao ? JSON.stringify(p.instalacao) : null, p.vencimento, null, p.status, p.criadoEm, null, '{}']);
    return { pedido: p };
  },

  'PATCH /api/pedidos/:id': async (req, body, ip, params, ctx) => {
    const u = exigir(req, ['cliente']);
    const rows = await banco.query('SELECT * FROM pedidos WHERE id = ? AND cliente_email = ?', [params.id, u.email]);
    if (!rows.length) erro(404, 'Pedido não encontrado.');
    const p = pedido(rows[0]);
    if (p.status === 'Pago') erro(400, 'Este pedido já foi pago.');
    const metodo = body.metodo !== undefined ? texto(body.metodo, 20) : p.metodo;
    const detalhes = { ...p.detalhes, ...(body.detalhes && typeof body.detalhes === 'object' ? body.detalhes : {}) };
    // Dados de cartão nunca entram no banco, mesmo que o navegador mande por engano.
    delete detalhes.numero; delete detalhes.cvv; delete detalhes.validade;
    let status = p.status, pagoEm = p.pagoEm;
    if (body.status === 'Pago') {
      // Com o Mercado Pago ligado, só confirmamos depois de conferir lá; sem ele (modo simulado), aceita.
      if (ctx.mercadoPagoAtivo) {
        const info = await ctx.consultarReferencia(p.ref);
        if (info?.status !== 'pago') erro(409, 'O Mercado Pago ainda não confirmou este pagamento.');
        Object.assign(detalhes, { mpId: info.id, bandeira: info.bandeira, final: info.final });
        pagoEm = info.pagoEm || agora();
      } else pagoEm = body.pagoEm || agora();
      status = 'Pago';
    } else if (body.status === 'Aguardando pagamento') status = 'Aguardando pagamento';
    await banco.run('UPDATE pedidos SET metodo = ?, status = ?, pago_em = ?, detalhes_json = ? WHERE id = ?', [metodo, status, pagoEm, JSON.stringify(detalhes), p.id]);
    const novo = { ...p, metodo, status, pagoEm, detalhes };
    if (body.status === 'Pago' || body.status === 'Aguardando pagamento') await aplicarPedidoAoCliente(novo, status === 'Pago');
    return { pedido: novo, cliente: await buscarCliente(u.email) };
  },

  'POST /api/chamados': async (req, body) => {
    const u = exigir(req, ['cliente']);
    const c = await buscarCliente(u.email);
    return { chamado: await criarChamado({ cliente: c.email, nome: c.nome, email: c.email, telefone: c.telefone, assunto: body.assunto, mensagem: body.mensagem, id: body.id }) };
  },

  'POST /api/chamados/visitante': async (req, body, ip) => {
    limitar(ip, 5, 'visitante');
    const email = texto(body.email, 160).toLowerCase();
    if (!EMAIL.test(email) || texto(body.nome).length < 2) erro(400, 'Informe nome e e-mail válidos.');
    return { chamado: await criarChamado({ cliente: email, nome: texto(body.nome, 120), email, telefone: texto(body.telefone, 20), assunto: body.assunto, mensagem: body.mensagem }) };
  },

  'POST /api/chamados/:id/mensagens': async (req, body, ip, params) => {
    const u = exigir(req);
    const rows = await banco.query('SELECT * FROM chamados WHERE id = ?', [params.id]);
    if (!rows.length || (!ehEquipe(u) && rows[0].cliente_email !== u.email)) erro(404, 'Chamado não encontrado.');
    const t = chamado(rows[0]);
    const txt = texto(body.texto, 2000);
    if (!txt) erro(400, 'Escreva uma mensagem.');
    t.mensagens.push({ autor: u.nome, tipo: ehEquipe(u) ? 'funcionario' : 'cliente', texto: txt, data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) });
    if (ehEquipe(u) && ['Aberto', 'Em atendimento', 'Encerrado'].includes(body.status)) t.status = body.status;
    await banco.run('UPDATE chamados SET mensagens_json = ?, status = ? WHERE id = ?', [JSON.stringify(t.mensagens), t.status, t.id]);
    return { chamado: t };
  },

  'PATCH /api/chamados/:id': async (req, body, ip, params) => {
    exigir(req, ['admin', 'atendimento', 'tecnico']);
    if (!['Aberto', 'Em atendimento', 'Encerrado'].includes(body.status)) erro(400, 'Status inválido.');
    const n = (await banco.run('UPDATE chamados SET status = ? WHERE id = ?', [body.status, params.id])).changes;
    if (!n) erro(404, 'Chamado não encontrado.');
    return { ok: true };
  },

  'PATCH /api/equipe/:email': async (req, body, ip, params) => {
    exigir(req, ['admin']);
    if (!['atendimento', 'tecnico'].includes(body.nivel)) erro(400, 'Nível de acesso inválido.');
    const m = await buscarMembro(decodeURIComponent(params.email));
    if (!m || m.nivel === 'admin') erro(404, 'Funcionário não encontrado ou nível protegido.');
    await banco.run('UPDATE equipe SET nivel = ?, cargo = ? WHERE email = ?', [body.nivel, body.nivel === 'tecnico' ? 'Técnico de Internet' : 'Funcionário de Atendimento', m.email]);
    return { ok: true };
  },

  'POST /api/demo/carregar': async (req) => {
    exigir(req, ['admin']);
    const demo = DEMO.gerar(PLANOS.filter(p => p.numero));
    const hash = await bcrypt.hash(DEMO.SENHA, 10);
    for (const c of demo.clientes) {
      await banco.run('DELETE FROM chamados WHERE cliente_email = ?', [c.email]);
      await banco.run('DELETE FROM pedidos WHERE cliente_email = ?', [c.email]);
      await banco.run('DELETE FROM clientes WHERE email = ?', [c.email]);
      await banco.run('INSERT INTO clientes (id, nome, email, senha_hash, telefone, cpf, endereco, endereco_instalacao, preferencias, plano_json, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [c.id, c.nome, c.email, hash, c.telefone, c.cpf, c.endereco, c.enderecoInstalacao || null, c.preferencias ? 1 : 0, c.plano ? JSON.stringify(c.plano) : null, c.criadoEm]);
    }
    for (const p of demo.pedidos) {
      await banco.run('INSERT INTO pedidos (id, tipo, competencia, ref, cliente_email, nome, plano_json, valor, endereco, instalacao_json, vencimento, metodo, status, criado_em, pago_em, detalhes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.tipo, p.competencia, p.ref, p.cliente, p.nome, JSON.stringify(p.plano), p.valor, p.endereco, p.instalacao ? JSON.stringify(p.instalacao) : null, p.vencimento, p.metodo, p.status, p.criadoEm, p.pagoEm, JSON.stringify(p.detalhes || {})]);
    }
    for (const t of demo.chamados) {
      await banco.run('INSERT INTO chamados (id, cliente_email, nome, email, telefone, data, hora, assunto, status, mensagens_json, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [t.id, t.cliente, t.nome, t.cliente, null, t.data, t.hora, t.assunto, t.status, JSON.stringify(t.mensagens), agora()]);
    }
    return { clientes: demo.clientes.length, pedidos: demo.pedidos.length, chamados: demo.chamados.length };
  },

  'POST /api/demo/limpar': async (req) => {
    exigir(req, ['admin']);
    const like = `%${DEMO.DOMINIO}`;
    await banco.run('DELETE FROM chamados WHERE cliente_email LIKE ?', [like]);
    await banco.run('DELETE FROM pedidos WHERE cliente_email LIKE ?', [like]);
    const n = (await banco.run('DELETE FROM clientes WHERE email LIKE ?', [like])).changes;
    return { clientes: n };
  }
};

const criarChamado = async ({ cliente, nome, email, telefone, assunto, mensagem, id }) => {
  const a = texto(assunto, 160), m = texto(mensagem, 2000);
  if (!a || !m) erro(400, 'Informe assunto e mensagem.');
  const now = new Date();
  const fmt = { timeZone: 'America/Sao_Paulo' };
  const t = {
    id: UUID.test(id || '') ? id : crypto.randomUUID(), cliente, nome, email, telefone,
    data: now.toLocaleDateString('pt-BR', fmt), hora: now.toLocaleTimeString('pt-BR', { ...fmt, hour: '2-digit', minute: '2-digit' }),
    assunto: a, status: 'Aberto', mensagens: [{ autor: nome, tipo: 'cliente', texto: m, data: now.toLocaleString('pt-BR', fmt) }], criadoEm: agora()
  };
  await banco.run('INSERT INTO chamados (id, cliente_email, nome, email, telefone, data, hora, assunto, status, mensagens_json, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [t.id, t.cliente, t.nome, t.email || null, t.telefone || null, t.data, t.hora, t.assunto, t.status, JSON.stringify(t.mensagens), t.criadoEm]);
  return t;
};

/* E-mail: ponto de extensão. Sem serviço configurado devolve false (o código aparece na tela). */
const enviarEmail = async () => false;

/* ---------- Despacho ---------- */
const casar = (metodo, url) => {
  for (const chave of Object.keys(rotas)) {
    const [m, padrao] = chave.split(' ');
    if (m !== metodo) continue;
    const re = new RegExp('^' + padrao.replace(/:[a-z]+/g, '([^/]+)') + '$');
    const match = re.exec(url);
    if (match) {
      const nomes = [...padrao.matchAll(/:([a-z]+)/g)].map(x => x[1]);
      return { fn: rotas[chave], params: Object.fromEntries(nomes.map((n, i) => [n, decodeURIComponent(match[i + 1])])) };
    }
  }
  return null;
};

const lerJson = async (req, limit = 50000) => {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > limit) erro(413, 'Requisição grande demais.'); }
  try { return raw ? JSON.parse(raw) : {}; } catch { erro(400, 'Requisição inválida.'); }
};

// Devolve true quando a rota é da API (e já respondeu). ctx traz dependências do Mercado Pago.
const handle = (req, res, url, ctx) => {
  if (!url.startsWith('/api/')) return false;
  const rota = casar(req.method, url);
  if (!rota) return false;
  (async () => {
    if (!banco.ativo()) erro(503, 'Banco de dados não configurado no servidor (falta DATABASE_URL).');
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await lerJson(req) : {};
    const out = await rota.fn(req, body || {}, ctx.clientIp(req), rota.params, ctx);
    json(res, 200, out ?? { ok: true });
  })().catch(e => {
    if (!(e instanceof Erro)) console.error('[api]', e);
    if (!res.headersSent) json(res, e instanceof Erro ? e.code : 500, { error: e instanceof Erro ? e.message : 'Erro interno.' });
  });
  return true;
};

module.exports = { handle, marcarPagamento };
