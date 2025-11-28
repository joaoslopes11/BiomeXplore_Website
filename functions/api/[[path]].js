import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors())

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'BiomeXplore API'
  })
})

// Public routes
app.get('/partners', async (c) => {
  try {
    console.log('📊 Recebido pedido para /api/partners')
    const { results } = await c.env.DB.prepare("SELECT * FROM partners ORDER BY name").all()
    console.log(`✅ Retornando ${results.length} parceiros`)
    return c.json(results)
  } catch (error) {
    console.error('❌ Erro ao carregar partners:', error)
    return c.json({ error: 'Erro ao carregar partners' }, 500)
  }
})

app.get('/news', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM news ORDER BY created_at DESC LIMIT 6").all()
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

    const result = await c.env.DB.prepare("INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)").bind(email).run()

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

    await c.env.DB.prepare("INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)").bind(name, email, message).run()

    return c.json({ message: 'Mensagem enviada com sucesso! Entraremos em contacto em breve.' }, 201)
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error)
    return c.json({ error: 'Erro ao enviar mensagem' }, 500)
  }
})

// Admin login (simplificado sem sessões)
app.post('/admin/login', async (c) => {
  try {
    console.log('🔐 Tentativa de login')
    const { username, password } = await c.req.json()
    
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

// Admin partners routes
app.get('/admin/partners', async (c) => {
  try {
    console.log('📋 Recebido pedido para /api/admin/partners')
    const { results } = await c.env.DB.prepare("SELECT * FROM partners ORDER BY name").all()
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

    const result = await c.env.DB.prepare("INSERT INTO partners (name, website, description) VALUES (?, ?, ?)").bind(name, website, description).run()

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

    await c.env.DB.prepare("UPDATE partners SET name = ?, website = ?, description = ? WHERE id = ?").bind(name, website, description, id).run()

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
    
    await c.env.DB.prepare("DELETE FROM partners WHERE id = ?").bind(id).run()

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

export default app

