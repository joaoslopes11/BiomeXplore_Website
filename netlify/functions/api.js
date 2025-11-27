const express = require('express');
const serverless = require('serverless-http');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());

// SQLite em memória (para Netlify)
let db = new sqlite3.Database(':memory:');

// Inicializar database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    website TEXT,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Dados iniciais
  const partners = [
    { name: 'IIS Galicia Sur', website: 'https://iisgaliciasur.es', description: 'Instituto de Investigación Sanitaria Galicia Sur' },
    { name: 'CESGA', website: 'https://www.cesga.es', description: 'Centro de Supercomputación de Galicia' },
    { name: 'CITIUS', website: 'https://citius.usc.es', description: 'Centro de Investigación em Tecnologías de la Información' },
    { name: 'União Europeia', website: 'https://europa.eu', description: 'União Europeia' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO partners (name, website, description) VALUES (?, ?, ?)');
  partners.forEach(partner => {
    stmt.run([partner.name, partner.website, partner.description]);
  });
  stmt.finalize();
});

// ==================== ROTAS PÚBLICAS ====================

// Partners públicos
app.get('/api/partners', (req, res) => {
  db.all('SELECT * FROM partners ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar partners' });
    res.json(rows);
  });
});

// News públicos
app.get('/api/news', (req, res) => {
  db.all('SELECT * FROM news ORDER BY created_at DESC LIMIT 6', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error loading news' });
    res.json(rows || []);
  });
});

// Newsletter
app.post('/api/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email é obrigatório' });
  console.log(`Novo subscrito: ${email}`);
  res.json({ message: 'Subscrição realizada com sucesso!' });
});

// Contact
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  console.log(`Nova mensagem de: ${name} (${email})`);
  res.json({ message: 'Mensagem enviada com sucesso! Entraremos em contacto em breve.' });
});

// ==================== ROTAS ADMIN ====================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'biomexplore2025') {
    res.json({ success: true, message: 'Login successful', username });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Check auth (sempre false no Netlify)
app.get('/api/admin/check-auth', (req, res) => {
  res.json({ isAuthenticated: false, username: null });
});

// Logout
app.post('/api/admin/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// Partners admin
app.get('/api/admin/partners', (req, res) => {
  db.all('SELECT * FROM partners ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar partners' });
    res.json(rows);
  });
});

app.post('/api/admin/partners', (req, res) => {
  const { name, website, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  
  db.run('INSERT INTO partners (name, website, description) VALUES (?, ?, ?)',
    [name, website, description], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar partner' });
      res.json({ success: true, message: 'Partner criado com sucesso!', id: this.lastID });
    }
  );
});

app.put('/api/admin/partners/:id', (req, res) => {
  const { id } = req.params;
  const { name, website, description } = req.body;
  
  db.run('UPDATE partners SET name = ?, website = ?, description = ? WHERE id = ?',
    [name, website, description, id], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar partner' });
      res.json({ success: true, message: 'Partner atualizado com sucesso!' });
    }
  );
});

app.delete('/api/admin/partners/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM partners WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao eliminar partner' });
    res.json({ success: true, message: 'Partner eliminado com sucesso!' });
  });
});

// News admin
app.get('/api/admin/news', (req, res) => {
  db.all('SELECT * FROM news ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error loading news' });
    res.json(rows);
  });
});

app.post('/api/admin/news', (req, res) => {
  const { title, content, image_url } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
  
  db.run('INSERT INTO news (title, content, image_url) VALUES (?, ?, ?)',
    [title, content, image_url || null], function(err) {
      if (err) return res.status(500).json({ error: 'Error creating news article' });
      res.json({ success: true, message: 'News article created successfully!', id: this.lastID });
    }
  );
});

app.delete('/api/admin/news/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM news WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Error deleting news article' });
    res.json({ success: true, message: 'News article deleted successfully!' });
  });
});

module.exports.handler = serverless(app);