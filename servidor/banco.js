/* Banco de dados do site FHP Fibra.
   Dois motores, escolhidos pela variável DATABASE_URL:
     mysql://usuario:senha@host:4000/fhp_fibra   → MySQL / TiDB Cloud (produção)
     sqlite:./dados/fhp.db                        → SQLite local (desenvolvimento, sem internet)
   Sem DATABASE_URL o banco fica desligado e o site funciona no modo localStorage.

   Toda a API usa só duas funções: query(sql, params) → linhas e run(sql, params) → { changes }.
   O SQL é escrito no subconjunto que os dois motores aceitam ("?" como marcador, tipos simples,
   JSON guardado como texto). */
const path = require('path');
const fs = require('fs');

const url = (process.env.DATABASE_URL || '').trim();
let motor = null; // { tipo: 'mysql' | 'sqlite', query, run, fechar }

/* ---------- Motores ---------- */

const abrirSqlite = arquivo => {
  const { DatabaseSync } = require('node:sqlite');
  const caminho = path.resolve(process.cwd(), arquivo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const fix = params => params.map(p => p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p);
  return {
    tipo: 'sqlite',
    descricao: `SQLite em ${caminho}`,
    query: async (sql, params = []) => db.prepare(sql).all(...fix(params)),
    run: async (sql, params = []) => { const r = db.prepare(sql).run(...fix(params)); return { changes: Number(r.changes) }; },
    fechar: async () => db.close()
  };
};

const abrirMysql = conexao => {
  const mysql = require('mysql2/promise');
  const u = new URL(conexao);
  const pool = mysql.createPool({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    waitForConnections: true,
    connectionLimit: 5,
    // TiDB Cloud e a maioria dos bancos gerenciados exigem TLS.
    ssl: u.searchParams.get('ssl') === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    timezone: 'Z',
    dateStrings: true
  });
  const fix = params => params.map(p => p === undefined ? null : p);
  return {
    tipo: 'mysql',
    descricao: `MySQL/TiDB em ${u.hostname}:${u.port || 3306}/${u.pathname.replace(/^\//, '')}`,
    query: async (sql, params = []) => { const [rows] = await pool.execute(sql, fix(params)); return rows; },
    run: async (sql, params = []) => { const [r] = await pool.execute(sql, fix(params)); return { changes: r.affectedRows }; },
    fechar: async () => pool.end()
  };
};

/* ---------- Esquema ---------- */

// Tipos escolhidos para funcionar igual no MySQL e no SQLite.
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS clientes (
    id VARCHAR(36) PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    senha_hash VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),
    cpf VARCHAR(14),
    endereco VARCHAR(255),
    endereco_instalacao VARCHAR(255),
    preferencias INTEGER NOT NULL DEFAULT 1,
    plano_json TEXT,
    criado_em VARCHAR(30) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS equipe (
    email VARCHAR(160) PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    senha_hash VARCHAR(100) NOT NULL,
    cargo VARCHAR(80),
    nivel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Ativo'
  )`,
  `CREATE TABLE IF NOT EXISTS pedidos (
    id VARCHAR(20) PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL,
    competencia VARCHAR(7) NOT NULL,
    ref VARCHAR(120) NOT NULL,
    cliente_email VARCHAR(160) NOT NULL,
    nome VARCHAR(120),
    plano_json TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    endereco VARCHAR(255),
    instalacao_json TEXT,
    vencimento VARCHAR(2),
    metodo VARCHAR(20),
    status VARCHAR(30) NOT NULL,
    criado_em VARCHAR(30) NOT NULL,
    pago_em VARCHAR(30),
    detalhes_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS chamados (
    id VARCHAR(36) PRIMARY KEY,
    cliente_email VARCHAR(160) NOT NULL,
    nome VARCHAR(120),
    email VARCHAR(160),
    telefone VARCHAR(20),
    data VARCHAR(12),
    hora VARCHAR(8),
    assunto VARCHAR(160) NOT NULL,
    status VARCHAR(20) NOT NULL,
    mensagens_json TEXT NOT NULL,
    criado_em VARCHAR(30) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS redefinicoes (
    email VARCHAR(160) PRIMARY KEY,
    codigo VARCHAR(6) NOT NULL,
    expira_em VARCHAR(30) NOT NULL
  )`
];
const INDICES = [
  ['pedidos_cliente', 'pedidos', 'cliente_email'],
  ['pedidos_ref', 'pedidos', 'ref'],
  ['chamados_cliente', 'chamados', 'cliente_email']
];

const migrar = async () => {
  for (const sql of TABELAS) await motor.run(sql);
  for (const [nome, tabela, coluna] of INDICES) {
    try { await motor.run(`CREATE INDEX ${nome} ON ${tabela} (${coluna})`); } catch { /* já existe */ }
  }
};

/* Contas iniciais da equipe: criadas só se a tabela estiver vazia.
   Senhas podem vir do .env (ADMIN_SENHA etc.); senão usam os padrões documentados no README. */
const semearEquipe = async bcrypt => {
  const [{ n }] = await motor.query('SELECT COUNT(*) AS n FROM equipe');
  if (Number(n) > 0) return false;
  const iniciais = [
    ['ana.ribeiro@fhpfibra.com.br', 'Ana Paula Ribeiro', 'Administradora', 'admin', process.env.ADMIN_SENHA || 'Admin12345'],
    ['marcos.souza@fhpfibra.com.br', 'Marcos Vinícius Souza', 'Funcionário de Atendimento', 'atendimento', process.env.ATENDIMENTO_SENHA || 'Atende12345'],
    ['rafael.nogueira@fhpfibra.com.br', 'Rafael Nogueira', 'Técnico de Internet', 'tecnico', process.env.TECNICO_SENHA || 'Tecnico123']
  ];
  for (const [email, nome, cargo, nivel, senha] of iniciais) {
    await motor.run('INSERT INTO equipe (email, nome, senha_hash, cargo, nivel, status) VALUES (?, ?, ?, ?, ?, ?)', [email, nome, await bcrypt.hash(senha, 10), cargo, nivel, 'Ativo']);
  }
  return true;
};

/* ---------- Inicialização ---------- */

const iniciar = async () => {
  if (!url) return null;
  if (url.startsWith('sqlite:')) motor = abrirSqlite(url.replace(/^sqlite:/, ''));
  else if (/^mysql2?:\/\//.test(url)) motor = abrirMysql(url);
  else throw new Error('DATABASE_URL deve começar com mysql:// (TiDB/MySQL) ou sqlite:');
  await migrar();
  const bcrypt = require('bcryptjs');
  const criou = await semearEquipe(bcrypt);
  return { tipo: motor.tipo, descricao: motor.descricao, equipeCriada: criou };
};

module.exports = {
  iniciar,
  ativo: () => !!motor,
  tipo: () => motor?.tipo || null,
  query: (sql, params) => motor.query(sql, params),
  run: (sql, params) => motor.run(sql, params),
  fechar: () => motor?.fechar()
};
