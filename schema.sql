-- Newsletter subscribers table (already exists, but confirming schema)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed BOOLEAN DEFAULT 1
);

-- Newsletter history table
CREATE TABLE IF NOT EXISTS newsletter_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    recipients_count INTEGER DEFAULT 0,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Paid subscriptions table (se você quiser implementar)
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    plan TEXT NOT NULL, -- 'monthly', 'yearly', 'trial'
    amount DECIMAL(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'active', 'cancelled', 'expired'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT
);
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    website TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserir dados iniciais
INSERT OR IGNORE INTO partners (name, website, description) VALUES
('IIS Galicia Sur', 'https://iisgaliciasur.es', 'Instituto de Investigación Sanitaria Galicia Sur'),
('CESGA', 'https://www.cesga.es', 'Centro de Supercomputación de Galicia'),
('CITIUS', 'https://citius.usc.es', 'Centro de Investigación em Tecnologías de la Información'),
('União Europeia', 'https://europa.eu', 'União Europeia');