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

    // ============ PUBLIC ROUTES ============

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

    // Newsletter subscription (public) - JÁ EXISTE NO TEU BACKEND
    if (pathname === '/api/subscribe' && request.method === 'POST') {
        const { email } = await request.json();
        
        if (!email) {
            return Response.json({ error: 'Email é obrigatório' }, { 
                status: 400, 
                headers: corsHeaders 
            });
        }

        const currentDate = new Date().toISOString();
        await env.DB.prepare(
            "INSERT OR IGNORE INTO newsletter_subscribers (email, subscribed_at, confirmed) VALUES (?, ?, 1)"
        ).bind(email, currentDate).run();
        
        return Response.json({ 
            success: true,
            message: 'Subscrição realizada com sucesso!' 
        }, { 
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

      await env.DB.prepare("INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)")
        .bind(name, email, message).run();
      
      return Response.json({ 
        message: 'Mensagem enviada com sucesso! Entraremos em contacto em breve.' 
      }, { 
        status: 201, 
        headers: corsHeaders 
      });
    }

    // ============ ADMIN AUTHENTICATION ============

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

    // ============ ADMIN PARTNERS ROUTES ============

    if (pathname === '/api/admin/partners' && request.method === 'GET') {
      console.log('📋 Recebido pedido para /api/admin/partners');
      const { results } = await env.DB.prepare("SELECT * FROM partners ORDER BY name").all();
      console.log(`✅ Retornando ${results.length} parceiros para admin`);
      return Response.json(results, { headers: corsHeaders });
    }

    if (pathname === '/api/admin/partners' && request.method === 'POST') {
      console.log('➕ Criando novo partner');
      const { name, website, description, logo_url } = await request.json();
      
      if (!name) {
        return Response.json({ error: 'Nome é obrigatório' }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      const result = await env.DB.prepare(
        "INSERT INTO partners (name, website, description, logo_url) VALUES (?, ?, ?, ?)"
      ).bind(name, website, description, logo_url || null).run();
      
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

    if (pathname.startsWith('/api/admin/partners/') && request.method === 'PUT') {
      const id = pathname.split('/').pop();
      console.log('✏️ Atualizando partner:', id);
      const { name, website, description, logo_url } = await request.json();
      
      if (!name) {
        return Response.json({ error: 'Nome é obrigatório' }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      await env.DB.prepare(
        "UPDATE partners SET name = ?, website = ?, description = ?, logo_url = ? WHERE id = ?"
      ).bind(name, website, description, logo_url || null, id).run();

      console.log(`✅ Partner ${id} atualizado`);
      return Response.json({ 
        success: true,
        message: 'Partner atualizado com sucesso!' 
      }, { headers: corsHeaders });
    }

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

    // ============ ADMIN NEWS ROUTES ============

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

      const result = await env.DB.prepare(
        "INSERT INTO news (title, content, image_url) VALUES (?, ?, ?)"
      ).bind(title, content, image_url || null).run();

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

    // ============ NEWSLETTER ROUTES ============

    // Get all newsletter subscribers
    if (pathname === '/api/admin/newsletter/subscribers' && request.method === 'GET') {
      console.log('📧 Recebido pedido para /api/admin/newsletter/subscribers');
      try {
        const { results } = await env.DB.prepare(
          "SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC"
        ).all();
        
        console.log(`✅ Retornando ${results?.length || 0} subscribers`);
        return Response.json(results || [], { headers: corsHeaders });
        
      } catch (error) {
        console.error('❌ Erro ao buscar subscribers:', error);
        return Response.json([], { headers: corsHeaders });
      }
    }

    // Export subscribers to CSV
    if (pathname === '/api/admin/newsletter/subscribers/export' && request.method === 'GET') {
      console.log('📥 Exportando subscribers para CSV');
      try {
        const { results } = await env.DB.prepare(
          "SELECT email, subscribed_at, confirmed FROM newsletter_subscribers ORDER BY subscribed_at DESC"
        ).all();
        
        // Create CSV content
        let csvContent = 'Email,Subscribed At,Confirmed\n';
        if (results && results.length > 0) {
          results.forEach(subscriber => {
            csvContent += `"${subscriber.email}","${subscriber.subscribed_at}",${subscriber.confirmed ? 'Yes' : 'No'}\n`;
          });
        }
        
        console.log(`✅ CSV gerado com ${results?.length || 0} registos`);
        return new Response(csvContent, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="biomexplore-subscribers-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });
        
      } catch (error) {
        console.error('❌ Erro ao exportar CSV:', error);
        return Response.json({ 
          success: false,
          error: 'Error exporting subscribers' 
        }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Send test email
    if (pathname === '/api/admin/newsletter/send-test' && request.method === 'POST') {
      console.log('🧪 Enviando email de teste');
      try {
        const { email, subject, content } = await request.json();
        
        if (!email || !subject || !content) {
          return Response.json({ 
            success: false,
            error: 'Email, subject and content are required' 
          }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Here you would integrate with your email service (SendGrid, Mailgun, etc.)
        // For now, we'll simulate sending
        console.log(`📤 Simulando envio de email para: ${email}`);
        console.log(`📝 Assunto: ${subject}`);
        console.log(`📄 Conteúdo: ${content.substring(0, 100)}...`);
        
        // Simulate email sending delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`✅ Test email sent to ${email}`);
        return Response.json({ 
          success: true,
          message: `Test email sent to ${email}`,
          sent: true
        }, { headers: corsHeaders });
        
      } catch (error) {
        console.error('❌ Erro ao enviar email de teste:', error);
        return Response.json({ 
          success: false,
          error: 'Error sending test email' 
        }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Unsubscribe email
    if (pathname === '/api/admin/newsletter/unsubscribe' && request.method === 'POST') {
      console.log('🗑️ Removendo subscriber');
      try {
        const { email } = await request.json();
        
        if (!email) {
          return Response.json({ 
            success: false,
            error: 'Email is required' 
          }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        const result = await env.DB.prepare(
          "DELETE FROM newsletter_subscribers WHERE email = ?"
        ).bind(email).run();
        
        console.log(`✅ Subscriber removido: ${email}`);
        return Response.json({ 
          success: true,
          message: 'Subscriber removed successfully',
          deleted: result.meta.changes > 0
        }, { headers: corsHeaders });
        
      } catch (error) {
        console.error('❌ Erro ao remover subscriber:', error);
        return Response.json({ 
          success: false,
          error: 'Error removing subscriber' 
        }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Send newsletter
    if (pathname === '/api/admin/newsletter/send' && request.method === 'POST') {
      console.log('📧 Enviando newsletter');
      try {
        const { subject, content, recipients, test_email } = await request.json();
        
        if (!subject || !content) {
          return Response.json({ 
            success: false,
            error: 'Subject and content are required' 
          }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        let emails = [];
        let sentCount = 0;
        
        if (recipients === 'test') {
          // Test email to admin
          emails = [test_email || 'admin@biomexplore.eu'];
          console.log(`🧪 Enviando email de teste para: ${emails[0]}`);
        } else {
          // Get all confirmed subscribers
          const { results } = await env.DB.prepare(
            "SELECT email FROM newsletter_subscribers WHERE confirmed = 1"
          ).all();
          
          emails = results?.map(s => s.email) || [];
          console.log(`📨 Enviando para ${emails.length} subscribers`);
        }
        
        // Simulate sending emails
        for (const email of emails) {
          // Here you would integrate with your email service
          // For simulation, we'll just log and wait a bit
          console.log(`📤 Simulando envio para: ${email}`);
          await new Promise(resolve => setTimeout(resolve, 50));
          sentCount++;
        }
        
        // Log the newsletter in database for history
        await env.DB.prepare(
          "INSERT INTO newsletter_history (subject, content, recipients_count, sent_at) VALUES (?, ?, ?, ?)"
        ).bind(subject, content, sentCount, new Date().toISOString()).run();
        
        console.log(`✅ Newsletter enviada com sucesso! ${sentCount} emails enviados`);
        return Response.json({ 
          success: true,
          sent: sentCount,
          message: `Newsletter sent to ${sentCount} recipients`
        }, { headers: corsHeaders });
        
      } catch (error) {
        console.error('❌ Erro ao enviar newsletter:', error);
        return Response.json({ 
          success: false,
          error: 'Error sending newsletter' 
        }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // ============ SUBSCRIPTION ROUTES (PAID SUBSCRIPTIONS) ============

    // Create paid subscription
    if (pathname === '/api/subscriptions' && request.method === 'POST') {
      console.log('💳 Criando subscription paga');
      const { name, email, plan, payment_method } = await request.json();
      
      if (!name || !email || !plan) {
        return Response.json({ 
          success: false,
          error: 'Name, email and plan are required' 
        }, { 
          status: 400, 
          headers: corsHeaders 
        });
      }
      
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const currentDate = new Date().toISOString();
      
      // Calculate expiry date based on plan
      const expiryDate = new Date();
      if (plan === 'monthly') {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      } else if (plan === 'yearly') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      } else {
        expiryDate.setDate(expiryDate.getDate() + 7); // Trial
      }
      
      // Set prices based on plan
      let amount = 0;
      if (plan === 'monthly') amount = 9.99;
      if (plan === 'yearly') amount = 99.99;
      
      try {
        const result = await env.DB.prepare(
          "INSERT INTO subscriptions (subscription_id, name, email, plan, amount, payment_method, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)"
        ).bind(subscriptionId, name, email, plan, amount, payment_method || 'stripe', currentDate, expiryDate.toISOString()).run();
        
        console.log(`✅ Subscription criada: ${subscriptionId}`);
        
        // Return subscription data (you would integrate with Stripe here)
        return Response.json({
          success: true,
          subscription_id: subscriptionId,
          message: 'Subscription created successfully',
          checkout_url: `https://checkout.stripe.com/pay/${subscriptionId}` // Replace with actual Stripe URL
        }, { 
          status: 201, 
          headers: corsHeaders 
        });
        
      } catch (error) {
        console.error('❌ Erro ao criar subscription:', error);
        return Response.json({ 
          success: false,
          error: 'Error creating subscription' 
        }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // 404 for unknown routes
    return Response.json({ 
      success: false,
      error: 'Route not found' 
    }, { 
      status: 404, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ Erro na API:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}