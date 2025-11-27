const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - IMPORTANTE: bodyParser deve vir antes das rotas
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'biomexplore-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Configuração do Multer para upload de imagens
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'), false);
        }
    }
});

// Criar pastas necessárias
const uploadsDir = path.join(__dirname, 'uploads');
const partnersDir = path.join(uploadsDir, 'partners');
const dbDir = path.join(__dirname, 'database');

[uploadsDir, partnersDir, dbDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Servir ficheiros estáticos
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(uploadsDir));

// Configuração do SQLite
const dbPath = path.join(__dirname, 'database', 'biomexplore.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar com SQLite:', err.message);
    } else {
        console.log('✅ Conectado ao SQLite Database:', dbPath);
        initializeDatabase();
    }
});

// Inicializar Database
function initializeDatabase() {
    const tables = [
        `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS partners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            logo_url TEXT,
            website TEXT,
            description TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    tables.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`❌ Erro ao criar tabela ${index}:`, err);
            } else {
                console.log(`✅ Tabela ${index} criada/verificada`);
            }
        });
    });

    // Inserir parceiros iniciais
    setTimeout(() => {
        const partners = [
            { name: 'IIS Galicia Sur', website: 'https://iisgaliciasur.es', description: 'Instituto de Investigación Sanitaria Galicia Sur' },
            { name: 'CESGA', website: 'https://www.cesga.es', description: 'Centro de Supercomputación de Galicia' },
            { name: 'CITIUS', website: 'https://citius.usc.es', description: 'Centro de Investigación em Tecnologías de la Información' },
            { name: 'União Europeia', website: 'https://europa.eu', description: 'União Europeia' }
        ];

        partners.forEach(partner => {
            db.run(
                'INSERT OR IGNORE INTO partners (name, website, description) VALUES (?, ?, ?)',
                [partner.name, partner.website, partner.description],
                function(err) {
                    if (err) {
                        console.error('❌ Erro ao inserir parceiro:', partner.name, err);
                    } else if (this.changes > 0) {
                        console.log(`✅ Parceiro inserido: ${partner.name}`);
                    }
                }
            );
        });
    }, 1000);
}

// Admin credentials
const admins = [
    { username: 'admin', password: 'biomexplore2025' }
];

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
};

// ==================== ROTAS PÚBLICAS ====================

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Rota para admin.html
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// API pública para partners
app.get('/api/partners', (req, res) => {
    console.log('📊 Recebido pedido para /api/partners');
    db.all('SELECT * FROM partners ORDER BY name', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar partners:', err);
            return res.status(500).json({ error: 'Erro ao carregar partners' });
        }
        console.log(`✅ Retornando ${rows.length} parceiros`);
        res.json(rows);
    });
});

// API pública para news
app.get('/api/news', (req, res) => {
    db.all('SELECT * FROM news ORDER BY created_at DESC LIMIT 6', [], (err, rows) => {
        if (err) {
            console.error('Error fetching public news:', err);
            return res.status(500).json({ error: 'Error loading news' });
        }
        res.json(rows || []);
    });
});

// Newsletter Subscription
app.post('/api/subscribe', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
    }

    db.run(
        'INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)',
        [email],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao subscrever newsletter' });
            }
            
            if (this.changes === 0) {
                return res.status(200).json({ message: 'Email já está subscrito' });
            }
            
            res.status(201).json({ message: 'Subscrição realizada com sucesso!' });
        }
    );
});

// Contact Form
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    db.run(
        'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)',
        [name, email, message],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao enviar mensagem' });
            }
            
            res.status(201).json({ message: 'Mensagem enviada com sucesso! Entraremos em contacto em breve.' });
        }
    );
});

// ==================== ROTAS DE ADMIN ====================

// Admin login
app.post('/api/admin/login', (req, res) => {
    console.log('🔐 Tentativa de login:', req.body);
    const { username, password } = req.body;
    
    const admin = admins.find(a => a.username === username && a.password === password);
    if (admin) {
        req.session.isAuthenticated = true;
        req.session.username = username;
        console.log('✅ Login bem sucedido para:', username);
        res.json({ 
            success: true,
            message: 'Login successful', 
            username 
        });
    } else {
        console.log('❌ Login falhou para:', username);
        res.status(401).json({ 
            success: false,
            error: 'Invalid credentials' 
        });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Check authentication status
app.get('/api/admin/check-auth', (req, res) => {
    const isAuth = !!(req.session && req.session.isAuthenticated);
    console.log('🔍 Check auth:', isAuth);
    res.json({ 
        isAuthenticated: isAuth,
        username: req.session?.username 
    });
});

// ==================== PARTNERS ADMIN ROUTES ====================

// Get all partners (admin)
app.get('/api/admin/partners', requireAuth, (req, res) => {
    console.log('📋 Recebido pedido para /api/admin/partners');
    db.all('SELECT * FROM partners ORDER BY name', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar partners admin:', err);
            return res.status(500).json({ error: 'Erro ao carregar partners' });
        }
        console.log(`✅ Retornando ${rows.length} parceiros para admin`);
        res.json(rows);
    });
});

// Create new partner (VERSÃO SIMPLIFICADA - sem upload de imagem por agora)
app.post('/api/admin/partners', requireAuth, (req, res) => {
    console.log('➕ Criando novo partner:', req.body);
    const { name, website, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    db.run(
        'INSERT INTO partners (name, website, description) VALUES (?, ?, ?)',
        [name, website, description],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar partner:', err);
                return res.status(500).json({ error: 'Erro ao criar partner: ' + err.message });
            }
            console.log(`✅ Partner criado com ID: ${this.lastID}`);
            res.status(201).json({ 
                success: true,
                message: 'Partner criado com sucesso!',
                id: this.lastID
            });
        }
    );
});

// Update partner
app.put('/api/admin/partners/:id', requireAuth, (req, res) => {
    console.log('✏️ Atualizando partner:', req.params.id, req.body);
    const { id } = req.params;
    const { name, website, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    db.run(
        'UPDATE partners SET name = ?, website = ?, description = ? WHERE id = ?',
        [name, website, description, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar partner:', err);
                return res.status(500).json({ error: 'Erro ao atualizar partner' });
            }
            console.log(`✅ Partner ${id} atualizado`);
            res.json({ 
                success: true,
                message: 'Partner atualizado com sucesso!' 
            });
        }
    );
});

// Update partner logo (placeholder - para implementar depois)
app.post('/api/admin/partners/:id/logo', requireAuth, (req, res) => {
    console.log('🖼️ Tentativa de upload de logo para partner:', req.params.id);
    res.json({
        success: true,
        message: 'Logo upload functionality coming soon!',
        logo_url: null
    });
});

// Delete partner
app.delete('/api/admin/partners/:id', requireAuth, (req, res) => {
    console.log('🗑️ Eliminando partner:', req.params.id);
    const { id } = req.params;
    
    db.run('DELETE FROM partners WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ Erro ao eliminar partner:', err);
            return res.status(500).json({ error: 'Erro ao eliminar partner' });
        }

        console.log(`✅ Partner ${id} eliminado`);
        res.json({ 
            success: true,
            message: 'Partner eliminado com sucesso!' 
        });
    });
});

// ==================== NEWS ADMIN ROUTES ====================

// Get all news (admin)
app.get('/api/admin/news', requireAuth, (req, res) => {
    db.all('SELECT * FROM news ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching news:', err);
            return res.status(500).json({ error: 'Error loading news' });
        }
        res.json(rows);
    });
});

// Create news
app.post('/api/admin/news', requireAuth, (req, res) => {
    const { title, content, image_url } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    db.run(
        'INSERT INTO news (title, content, image_url) VALUES (?, ?, ?)',
        [title, content, image_url || null],
        function(err) {
            if (err) {
                console.error('Error creating news:', err);
                return res.status(500).json({ error: 'Error creating news article' });
            }
            res.status(201).json({ 
                success: true,
                message: 'News article created successfully!',
                id: this.lastID 
            });
        }
    );
});

// Update news
app.put('/api/admin/news/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, content, image_url } = req.body;
    
    db.run(
        'UPDATE news SET title = ?, content = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, content, image_url, id],
        function(err) {
            if (err) {
                console.error('Error updating news:', err);
                return res.status(500).json({ error: 'Error updating news article' });
            }
            res.json({ 
                success: true,
                message: 'News article updated successfully!' 
            });
        }
    );
});

// Delete news
app.delete('/api/admin/news/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM news WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting news:', err);
            return res.status(500).json({ error: 'Error deleting news article' });
        }
        res.json({ 
            success: true,
            message: 'News article deleted successfully!' 
        });
    });
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
    console.log(`🚀 Servidor BiomeXplore rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://localhost:${PORT}`);
    console.log(`🛠️  Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`🤝 API Parceiros: http://localhost:${PORT}/api/partners`);
    console.log('🔑 Credenciais admin: admin / biomexplore2025');
});

// Error handling para routes não encontradas
app.use((req, res) => {
    console.log(`❌ Rota não encontrada: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found' });
});

// Error handling global
app.use((err, req, res, next) => {
    console.error('❌ Erro global:', err);
    res.status(500).json({ error: 'Internal server error' });
});