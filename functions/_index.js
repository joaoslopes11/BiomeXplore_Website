import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Enable CORS
app.use('/*', cors())

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'production',
    service: 'BiomeXplore API'
  })
})

// Public routes
app.get('/partners', async (c) => {
  try {
    console.log('📊 Recebido pedido para /api/partners')
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM partners ORDER BY name"
    ).all()
    console.log(`✅ Retornando ${results.length} parceiros`)
    return c.json(results)
  } catch (error) {
    console.error('❌ Erro ao carregar partners:', error)
    return c.json({ error: 'Erro ao carregar partners' }, 500)
  }
})

app.get('/news', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM news ORDER BY created_at DESC LIMIT 6"
    ).all()
    return c.json(results || [])
  } catch (error) {
    console.error('Error fetching public news:', error)
    return c.json({ error: 'Error loading news' }, 500)
  }
})

app.post('/subscribe', async (c) => {
  try {
    const { email } = await c.req.json()
    
    if (!email) {
      return c.json({ error: 'Email é obrigatório' }, 400)
    }

    const result = await c.env.DB.prepare(
      "INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)"
    ).bind(email).run()

    if (result.meta.rows_read === 0) {
      return c.json({ message: 'Email já está subscrito' })
    }
    
    return c.json({ message: 'Subscrição realizada com sucesso!' }, 201)
  } catch (error) {
    console.error('❌ Erro ao subscrever newsletter:', error)
    return c.json({ error: 'Erro ao subscrever newsletter' }, 500)
  }
})

app.post('/contact', async (c) => {
  try {
    const { name, email, message } = await c.req.json()
    
    if (!name || !email || !message) {
      return c.json({ error: 'Todos os campos são obrigatórios' }, 400)
    }

    await c.env.DB.prepare(
      "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)"
    ).bind(name, email, message).run()

    return c.json({ message: 'Mensagem enviada com sucesso! Entraremos em contacto em breve.' }, 201)
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error)
    return c.json({ error: 'Erro ao enviar mensagem' }, 500)
  }
})

// Admin authentication routes
app.post('/admin/login', async (c) => {
  try {
    console.log('🔐 Tentativa de login')
    const { username, password } = await c.req.json()
    
    // Simple authentication (same as your original)
    if (username === 'admin' && password === 'biomexplore2025') {
      console.log('✅ Login bem sucedido para:', username)
      return c.json({ 
        success: true,
        message: 'Login successful', 
        username 
      })
    } else {
      console.log('❌ Login falhou para:', username)
      return c.json({ 
        success: false,
        error: 'Invalid credentials' 
      }, 401)
    }
  } catch (error) {
    console.error('❌ Erro no login:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

app.post('/admin/logout', async (c) => {
  // Note: Sessions don't work the same way in Workers
  // We'll use token-based auth or keep it simple for now
  return c.json({ message: 'Logout successful' })
})

// Admin partners routes
app.get('/admin/partners', async (c) => {
  try {
    console.log('📋 Recebido pedido para /api/admin/partners')
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM partners ORDER BY name"
    ).all()
    console.log(`✅ Retornando ${results.length} parceiros para admin`)
    return c.json(results)
  } catch (error) {
    console.error('❌ Erro ao carregar partners admin:', error)
    return c.json({ error: 'Erro ao carregar partners' }, 500)
  }
})

app.post('/admin/partners', async (c) => {
  try {
    console.log('➕ Criando novo partner')
    const { name, website, description } = await c.req.json()
    
    if (!name) {
      return c.json({ error: 'Nome é obrigatório' }, 400)
    }

    const result = await c.env.DB.prepare(
      "INSERT INTO partners (name, website, description) VALUES (?, ?, ?)"
    ).bind(name, website, description).run()

    console.log(`✅ Partner criado com ID: ${result.meta.last_row_id}`)
    return c.json({ 
      success: true,
      message: 'Partner criado com sucesso!',
      id: result.meta.last_row_id
    }, 201)
  } catch (error) {
    console.error('❌ Erro ao criar partner:', error)
    return c.json({ error: 'Erro ao criar partner: ' + error.message }, 500)
  }
})

app.put('/admin/partners/:id', async (c) => {
  try {
    const id = c.req.param('id')
    console.log('✏️ Atualizando partner:', id)
    const { name, website, description } = await c.req.json()
    
    if (!name) {
      return c.json({ error: 'Nome é obrigatório' }, 400)
    }

    await c.env.DB.prepare(
      "UPDATE partners SET name = ?, website = ?, description = ? WHERE id = ?"
    ).bind(name, website, description, id).run()

    console.log(`✅ Partner ${id} atualizado`)
    return c.json({ 
      success: true,
      message: 'Partner atualizado com sucesso!' 
    })
  } catch (error) {
    console.error('❌ Erro ao atualizar partner:', error)
    return c.json({ error: 'Erro ao atualizar partner' }, 500)
  }
})

app.delete('/admin/partners/:id', async (c) => {
  try {
    const id = c.req.param('id')
    console.log('🗑️ Eliminando partner:', id)
    
    await c.env.DB.prepare(
      "DELETE FROM partners WHERE id = ?"
    ).bind(id).run()

    console.log(`✅ Partner ${id} eliminado`)
    return c.json({ 
      success: true,
      message: 'Partner eliminado com sucesso!' 
    })
  } catch (error) {
    console.error('❌ Erro ao eliminar partner:', error)
    return c.json({ error: 'Erro ao eliminar partner' }, 500)
  }
})

// Admin news routes
app.get('/admin/news', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM news ORDER BY created_at DESC"
    ).all()
    return c.json(results)
  } catch (error) {
    console.error('Error fetching news:', error)
    return c.json({ error: 'Error loading news' }, 500)
  }
})

app.post('/admin/news', async (c) => {
  try {
    const { title, content, image_url } = await c.req.json()
    
    if (!title || !content) {
      return c.json({ error: 'Title and content are required' }, 400)
    }

    const result = await c.env.DB.prepare(
      "INSERT INTO news (title, content, image_url) VALUES (?, ?, ?)"
    ).bind(title, content, image_url || null).run()

    return c.json({ 
      success: true,
      message: 'News article created successfully!',
      id: result.meta.last_row_id 
    }, 201)
  } catch (error) {
    console.error('Error creating news:', error)
    return c.json({ error: 'Error creating news article' }, 500)
  }
})

app.put('/admin/news/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const { title, content, image_url } = await c.req.json()
    
    await c.env.DB.prepare(
      "UPDATE news SET title = ?, content = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(title, content, image_url, id).run()

    return c.json({ 
      success: true,
      message: 'News article updated successfully!' 
    })
  } catch (error) {
    console.error('Error updating news:', error)
    return c.json({ error: 'Error updating news article' }, 500)
  }
})

app.delete('/admin/news/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    await c.env.DB.prepare(
      "DELETE FROM news WHERE id = ?"
    ).bind(id).run()

    return c.json({ 
      success: true,
      message: 'News article deleted successfully!' 
    })
  } catch (error) {
    console.error('Error deleting news:', error)
    return c.json({ error: 'Error deleting news article' }, 500)
  }
})

// Logo upload placeholder (same as your original)
app.post('/admin/partners/:id/logo', async (c) => {
  try {
    const id = c.req.param('id')
    console.log('🖼️ Tentativa de upload de logo para partner:', id)
    
    // In Workers, file uploads work differently
    // For now, we'll keep the placeholder functionality
    return c.json({
      success: true,
      message: 'Logo recebido (em memória). Funcionalidade completa em desenvolvimento.',
      logo_url: null
    })
  } catch (error) {
    console.error('❌ Erro no upload de logo:', error)
    return c.json({ error: 'Erro no upload de logo' }, 500)
  }
})

// 404 handler
app.notFound((c) => {
  console.log(`❌ Rota não encontrada: ${c.req.method} ${c.req.url}`)
  return c.json({ error: 'Route not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('❌ Erro global:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app