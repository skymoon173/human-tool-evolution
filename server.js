const express = require('express');
const path = require('path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const PORT = 8080;
const DB_PATH = path.join(__dirname, 'game.db');

app.use(express.json());
app.use(express.static(__dirname, { index: false }));

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT NOT NULL,
    version TEXT NOT NULL,
    discovered TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, version),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  saveDB();
}

function saveDB() {
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
}

function genToken() {
  return uuidv4() + uuidv4();
}

const tokens = new Map();

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.json({ ok: false, msg: '用户名2-20字符' });
  if (password.length < 3) return res.json({ ok: false, msg: '密码至少3字符' });
  const existing = db.exec(`SELECT id FROM users WHERE username = ?`, [username]);
  if (existing.length > 0 && existing[0].values.length > 0) return res.json({ ok: false, msg: '用户名已存在' });
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 8);
  db.run(`INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`, [id, username, hash]);
  const token = genToken();
  tokens.set(token, { id, username });
  db.run(`INSERT OR IGNORE INTO progress (user_id, version, discovered) VALUES (?, 'simple', '[]')`, [id]);
  db.run(`INSERT OR IGNORE INTO progress (user_id, version, discovered) VALUES (?, 'realistic', '[]')`, [id]);
  saveDB();
  res.json({ ok: true, token, username, userId: id });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '用户名和密码不能为空' });
  const result = db.exec(`SELECT id, password_hash FROM users WHERE username = ?`, [username]);
  if (result.length === 0 || result[0].values.length === 0) return res.json({ ok: false, msg: '用户名或密码错误' });
  const row = result[0].values[0];
  const id = row[0], hash = row[1];
  if (!bcrypt.compareSync(password, hash)) return res.json({ ok: false, msg: '用户名或密码错误' });
  const token = genToken();
  tokens.set(token, { id, username });
  res.json({ ok: true, token, username, userId: id });
});

function auth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) return res.status(401).json({ ok: false, msg: '未登录' });
  req.user = tokens.get(token);
  next();
}

app.post('/api/guest', (req, res) => {
  const id = uuidv4();
  const username = '游客' + id.slice(0, 6);
  db.run(`INSERT INTO users (id, username, password_hash) VALUES (?, ?, '')`, [id, username]);
  const token = genToken();
  tokens.set(token, { id, username });
  db.run(`INSERT OR IGNORE INTO progress (user_id, version, discovered) VALUES (?, 'simple', '[]')`, [id]);
  db.run(`INSERT OR IGNORE INTO progress (user_id, version, discovered) VALUES (?, 'realistic', '[]')`, [id]);
  saveDB();
  res.json({ ok: true, token, username, userId: id });
});

app.get('/api/progress/:version', auth, (req, res) => {
  const version = req.params.version;
  const result = db.exec(`SELECT discovered FROM progress WHERE user_id = ? AND version = ?`, [req.user.id, version]);
  let discovered = '[]';
  if (result.length > 0 && result[0].values.length > 0) {
    discovered = result[0].values[0][0] || '[]';
  }
  res.json({ ok: true, discovered: JSON.parse(discovered) });
});

app.post('/api/progress/:version', auth, (req, res) => {
  const version = req.params.version;
  const { discovered } = req.body;
  if (!Array.isArray(discovered)) return res.json({ ok: false, msg: '数据格式错误' });
  db.run(`INSERT OR REPLACE INTO progress (user_id, version, discovered, updated_at) VALUES (?, ?, ?, datetime('now'))`,
    [req.user.id, version, JSON.stringify(discovered)]);
  saveDB();
  res.json({ ok: true });
});

app.get('/api/rank/:version', (req, res) => {
  const version = req.params.version;
  const result = db.exec(`SELECT u.username, LENGTH(p.discovered) - LENGTH(REPLACE(p.discovered, ',', '')) + 1 as cnt
    FROM progress p JOIN users u ON p.user_id = u.id
    WHERE p.version = ? AND p.discovered != '[]'
    ORDER BY cnt DESC LIMIT 20`, [version]);
  const ranks = [];
  if (result.length > 0) {
    result[0].values.forEach(row => ranks.push({ username: row[0], count: row[1] }));
  }
  res.json({ ok: true, ranks });
});

app.get('/simple.html', (req, res) => res.sendFile(path.join(__dirname, 'simple.html')));
app.get('/realistic.html', (req, res) => res.sendFile(path.join(__dirname, 'realistic.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});
