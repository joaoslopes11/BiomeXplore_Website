export async function onRequest(context) {
  const { request, env } = context;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Health check
    if (pathname === '/api/health' && request.method === 'GET') {
      return Response.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'BiomeXplore API'
      }, { headers: corsHeaders });
    }

    // Public partners
    if (pathname === '/api/partners' && request.method === 'GET') {
      console.log('📊 Recebido pedido para /api/partners');
      const { results } = await env.DB.prepare("SELECT * FROM partners ORDER BY name").all();
      console.log(`✅ Retornando ${results.length} parceiros`);
      return Response.json(results, { headers: corsHeaders });
    }

    // Public news
    if (pathname === '/api/news' && request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM news ORDER BY created_at DESC LIMIT 6").all();
      return Response.json(results || [], { headers: corsHeaders });
    }

    // Newsletter subscription
    if (pathname === '/api/subscribe' && request.method === 'POST') {
      const { email } = await request.json();
      
      if (!email) {
        return Response.json({ error: 'Email é obrigatório' }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      await env.DB.prepare("INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)").bind(email).run();
      return Response.json({ message: 'Subscrição realizada com sucesso!' }, { 
        status: 201, 
        headers: corsHeaders 
      });
    }

    // Contact form
    if (pathname === '/api/contact' && request.method === 'POST') {
      const { name, email, message } = await request.json();
      
      if (!name || !email || !message) {
        return Response.json({ error: 'Todos os campos são obrigatórios' }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      await env.DB.prepare("INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)").bind(name, email, message).run();
      return Response.json({ message: 'Mensagem enviada com sucesso! Entraremos em contacto em breve.' }, { 
        status: 201, 
        headers: corsHeaders 
      });
    }

    // Admin login
    if (pathname === '/api/admin/login' && request.method === 'POST') {
      console.log('🔐 Tentativa de login');
      const { username, password } = await request.json();
      
      if (username === 'admin' && password === 'biomexplore2025') {
        console.log('✅ Login bem sucedido para:', username);
        return Response.json({ 
          success: true,
          message: 'Login successful', 
          username 
        }, { headers: corsHeaders });
      } else {
        console.log('❌ Login falhou para:', username);
        return Response.json({ 
          success: false,
          error: 'Invalid credentials' 
        }, { 
          status: 401, 
          headers: corsHeaders 
        });
      }
    }

    // Admin partners routes
    if (pathname === '/api/admin/partners' && request.method === 'GET') {
      console.log('📋 Recebido pedido para /api/admin/partners');
      const { results } = await env.DB.prepare("SELECT * FROM partners ORDER BY name").all();
      console.log(`✅ Retornando ${results.length} parceiros para admin`);
      return Response.json(results, { headers: corsHeaders });
    }

    if (pathname === '/api/admin/partners' && request.method === 'POST') {
      console.log('➕ Criando novo partner');
      const { name, website, description } = await request.json();
      
      if (!name) {
        return Response.json({ error: 'Nome é obrigatório' }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      const result = await env.DB.prepare("INSERT INTO partners (name, website, description) VALUES (?, ?, ?)").bind(name, website, description).run();
      console.log(`✅ Partner criado com ID: ${result.meta.last_row_id}`);
      
      return Response.json({ 
        success: true,
        message: 'Partner criado com sucesso!',
        id: result.meta.last_row_id
      }, { 
        status: 201, 
        headers: corsHeaders 
      });
    }

    // Update partner
    if (pathname.startsWith('/api/admin/partners/') && request.method === 'PUT') {
      const id = pathname.split('/').pop();
      console.log('✏️ Atualizando partner:', id);
      const { name, website, description } = await request.json();
      
      if (!name) {
        return Response.json({ error: 'Nome é obrigatório' }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      await env.DB.prepare("UPDATE partners SET name = ?, website = ?, description = ? WHERE id = ?")
        .bind(name, website, description, id).run();

      console.log(`✅ Partner ${id} atualizado`);
      return Response.json({ 
        success: true,
        message: 'Partner atualizado com sucesso!' 
      }, { headers: corsHeaders });
    }

    // Delete partner
    if (pathname.startsWith('/api/admin/partners/') && request.method === 'DELETE') {
      const id = pathname.split('/').pop();
      console.log('🗑️ Eliminando partner:', id);
      
      await env.DB.prepare("DELETE FROM partners WHERE id = ?").bind(id).run();

      console.log(`✅ Partner ${id} eliminado`);
      return Response.json({ 
        success: true,
        message: 'Partner eliminado com sucesso!' 
      }, { headers: corsHeaders });
    }

    // ============ NEWS MANAGEMENT ROUTES ============

    // Admin news routes
    if (pathname === '/api/admin/news' && request.method === 'GET') {
      console.log('📰 Recebido pedido para /api/admin/news');
      const { results } = await env.DB.prepare("SELECT * FROM news ORDER BY created_at DESC").all();
      console.log(`✅ Retornando ${results.length} artigos`);
      return Response.json(results, { headers: corsHeaders });
    }

    if (pathname === '/api/admin/news' && request.method === 'POST') {
      console.log('➕ Criando novo artigo');
      const { title, content, image_url } = await request.json();
      
      if (!title || !content) {
        return Response.json({ error: 'Title and content are required' }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      const result = await env.DB.prepare("INSERT INTO news (title, content, image_url) VALUES (?, ?, ?)")
        .bind(title, content, image_url || null).run();

      console.log(`✅ Artigo criado com ID: ${result.meta.last_row_id}`);
      return Response.json({ 
        success: true,
        message: 'News article created successfully!',
        id: result.meta.last_row_id
      }, { 
        status: 201, 
        headers: corsHeaders 
      });
    }

    // Delete news article
    if (pathname.startsWith('/api/admin/news/') && request.method === 'DELETE') {
      const id = pathname.split('/').pop();
      console.log('🗑️ Eliminando artigo:', id);
      
      await env.DB.prepare("DELETE FROM news WHERE id = ?").bind(id).run();

      console.log(`✅ Artigo ${id} eliminado`);
      return Response.json({ 
        success: true,
        message: 'News article deleted successfully!' 
      }, { headers: corsHeaders });
    }

    // 404 for unknown routes
    return Response.json({ error: 'Route not found' }, { 
      status: 404, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ Erro na API:', error);
    return Response.json({ error: 'Internal server error' }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}