const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = 3000;
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new DatabaseSync(path.join(dataDir, 'manutencao.db'));
db.exec('PRAGMA foreign_keys = ON');

// Criação das tabelas do sistema.
db.exec(`
  CREATE TABLE IF NOT EXISTS equipamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    setor TEXT NOT NULL,
    fabricante TEXT,
    modelo TEXT
  );

  CREATE TABLE IF NOT EXISTS manutencoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento_id INTEGER NOT NULL,
    data_manutencao TEXT NOT NULL,
    descricao TEXT NOT NULL,
    responsavel TEXT NOT NULL,
    proxima_manutencao TEXT,
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pecas_usadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manutencao_id INTEGER NOT NULL,
    nome_peca TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    codigo_peca TEXT,
    FOREIGN KEY (manutencao_id) REFERENCES manutencoes(id) ON DELETE CASCADE
  );
`);

function responderJSON(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados));
}

function lerJSON(req) {
  return new Promise((resolve, reject) => {
    let corpo = '';
    req.on('data', parte => corpo += parte);
    req.on('end', () => {
      if (!corpo) return resolve({});
      try {
        resolve(JSON.parse(corpo));
      } catch (erro) {
        reject(new Error('JSON inválido.'));
      }
    });
  });
}

function servirArquivoEstatico(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const nomeArquivo = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const caminho = path.normalize(path.join(publicDir, nomeArquivo));

  if (!caminho.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Acesso negado.');
  }

  if (!fs.existsSync(caminho) || fs.statSync(caminho).isDirectory()) {
    res.writeHead(404);
    return res.end('Arquivo não encontrado.');
  }

  const extensao = path.extname(caminho);
  const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
  };

  res.writeHead(200, { 'Content-Type': tipos[extensao] || 'text/plain; charset=utf-8' });
  fs.createReadStream(caminho).pipe(res);
}

async function tratarAPI(req, res, url) {
  // EQUIPAMENTOS
  if (req.method === 'GET' && url.pathname === '/api/equipamentos') {
    const dados = db.prepare('SELECT * FROM equipamentos ORDER BY nome').all();
    return responderJSON(res, 200, dados);
  }

  if (req.method === 'POST' && url.pathname === '/api/equipamentos') {
    const { nome, setor, fabricante, modelo } = await lerJSON(req);
    if (!nome || !setor) {
      return responderJSON(res, 400, { erro: 'Nome e setor são obrigatórios.' });
    }

    const resultado = db.prepare(`
      INSERT INTO equipamentos (nome, setor, fabricante, modelo)
      VALUES (?, ?, ?, ?)
    `).run(nome, setor, fabricante || '', modelo || '');

    return responderJSON(res, 201, { id: Number(resultado.lastInsertRowid) });
  }

  const equipamentoId = url.pathname.match(/^\/api\/equipamentos\/(\d+)$/);
  if (equipamentoId && req.method === 'PUT') {
    const { nome, setor, fabricante, modelo } = await lerJSON(req);
    const resultado = db.prepare(`
      UPDATE equipamentos
      SET nome = ?, setor = ?, fabricante = ?, modelo = ?
      WHERE id = ?
    `).run(nome, setor, fabricante || '', modelo || '', Number(equipamentoId[1]));

    if (resultado.changes === 0) {
      return responderJSON(res, 404, { erro: 'Equipamento não encontrado.' });
    }
    return responderJSON(res, 200, { mensagem: 'Equipamento atualizado.' });
  }

  if (equipamentoId && req.method === 'DELETE') {
    const resultado = db.prepare('DELETE FROM equipamentos WHERE id = ?').run(Number(equipamentoId[1]));
    if (resultado.changes === 0) {
      return responderJSON(res, 404, { erro: 'Equipamento não encontrado.' });
    }
    return responderJSON(res, 200, { mensagem: 'Equipamento excluído.' });
  }

  // MANUTENÇÕES
  if (req.method === 'GET' && url.pathname === '/api/manutencoes') {
    const filtro = url.searchParams.get('equipamento_id');
    let sql = `
      SELECT m.*, e.nome AS equipamento_nome, e.setor
      FROM manutencoes m
      INNER JOIN equipamentos e ON e.id = m.equipamento_id
    `;

    let dados;
    if (filtro) {
      sql += ' WHERE m.equipamento_id = ? ORDER BY m.data_manutencao DESC';
      dados = db.prepare(sql).all(Number(filtro));
    } else {
      sql += ' ORDER BY m.data_manutencao DESC';
      dados = db.prepare(sql).all();
    }
    return responderJSON(res, 200, dados);
  }

  if (req.method === 'POST' && url.pathname === '/api/manutencoes') {
    const dados = await lerJSON(req);
    const { equipamento_id, data_manutencao, descricao, responsavel, proxima_manutencao } = dados;

    if (!equipamento_id || !data_manutencao || !descricao || !responsavel) {
      return responderJSON(res, 400, { erro: 'Preencha os campos obrigatórios.' });
    }

    const resultado = db.prepare(`
      INSERT INTO manutencoes
      (equipamento_id, data_manutencao, descricao, responsavel, proxima_manutencao)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(equipamento_id), data_manutencao, descricao, responsavel, proxima_manutencao || null);

    return responderJSON(res, 201, { id: Number(resultado.lastInsertRowid) });
  }

  const manutencaoId = url.pathname.match(/^\/api\/manutencoes\/(\d+)$/);
  if (manutencaoId && req.method === 'DELETE') {
    const resultado = db.prepare('DELETE FROM manutencoes WHERE id = ?').run(Number(manutencaoId[1]));
    if (resultado.changes === 0) {
      return responderJSON(res, 404, { erro: 'Manutenção não encontrada.' });
    }
    return responderJSON(res, 200, { mensagem: 'Manutenção excluída.' });
  }

  // PEÇAS UTILIZADAS
  if (req.method === 'GET' && url.pathname === '/api/pecas') {
    const dados = db.prepare(`
      SELECT p.*, m.data_manutencao, e.nome AS equipamento_nome
      FROM pecas_usadas p
      INNER JOIN manutencoes m ON m.id = p.manutencao_id
      INNER JOIN equipamentos e ON e.id = m.equipamento_id
      ORDER BY m.data_manutencao DESC
    `).all();
    return responderJSON(res, 200, dados);
  }

  if (req.method === 'POST' && url.pathname === '/api/pecas') {
    const { manutencao_id, nome_peca, quantidade, codigo_peca } = await lerJSON(req);
    if (!manutencao_id || !nome_peca) {
      return responderJSON(res, 400, { erro: 'Manutenção e nome da peça são obrigatórios.' });
    }

    const resultado = db.prepare(`
      INSERT INTO pecas_usadas (manutencao_id, nome_peca, quantidade, codigo_peca)
      VALUES (?, ?, ?, ?)
    `).run(Number(manutencao_id), nome_peca, Number(quantidade || 1), codigo_peca || '');

    return responderJSON(res, 201, { id: Number(resultado.lastInsertRowid) });
  }

  const pecaId = url.pathname.match(/^\/api\/pecas\/(\d+)$/);
  if (pecaId && req.method === 'DELETE') {
    const resultado = db.prepare('DELETE FROM pecas_usadas WHERE id = ?').run(Number(pecaId[1]));
    if (resultado.changes === 0) {
      return responderJSON(res, 404, { erro: 'Registro de peça não encontrado.' });
    }
    return responderJSON(res, 200, { mensagem: 'Registro de peça excluído.' });
  }

  return responderJSON(res, 404, { erro: 'Rota não encontrada.' });
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await tratarAPI(req, res, url);
    } else {
      servirArquivoEstatico(req, res);
    }
  } catch (erro) {
    console.error(erro);
    responderJSON(res, 500, { erro: 'Erro interno do servidor.' });
  }
});

servidor.listen(PORT, () => {
  console.log(`Sistema disponível em http://localhost:${PORT}`);
});
