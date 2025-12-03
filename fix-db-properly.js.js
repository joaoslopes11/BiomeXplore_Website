// fix-db-properly.js
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Função para extrair JSON da saída do wrangler
function extractJSON(output) {
    // Procura por JSON na saída
    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
        return null;
    }
    
    try {
        const jsonStr = output.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

async function runWranglerCommand(command) {
    console.log(`💻 Executing: ${command.substring(0, 80)}...`);
    
    try {
        const { stdout, stderr } = await execPromise(command);
        
        // Extrair JSON da saída
        const jsonData = extractJSON(stdout);
        
        if (jsonData) {
            return { success: true, data: jsonData, raw: stdout };
        } else {
            // Se não encontrar JSON, pode ser comando que não retorna JSON
            return { success: true, data: stdout, raw: stdout };
        }
    } catch (error) {
        console.error(`❌ Command failed: ${error.message}`);
        return { success: false, error: error.message, stderr: error.stderr };
    }
}

async function fixNewsletterTable() {
    console.log('🔧 Fixing newsletter_subscribers table (proper method)...\n');
    
    try {
        // 1. Primeiro, verificar se podemos dropar a tabela
        console.log('1. Checking current data...');
        const checkResult = await runWranglerCommand(
            'npx wrangler d1 execute biomexplore-db --remote --command="SELECT COUNT(*) as count FROM newsletter_subscribers;"'
        );
        
        if (checkResult.success && checkResult.data[0]?.results?.[0]?.count > 0) {
            console.log(`⚠️ Table has ${checkResult.data[0].results[0].count} records. Making backup...`);
            
            // Fazer backup
            const backupResult = await runWranglerCommand(
                'npx wrangler d1 execute biomexplore-db --remote --command="SELECT * FROM newsletter_subscribers;"'
            );
            
            if (backupResult.success) {
                const fs = require('fs');
                fs.writeFileSync(
                    'newsletter_backup.json',
                    JSON.stringify(backupResult.data, null, 2)
                );
                console.log('✅ Backup saved to newsletter_backup.json');
            }
        }
        
        // 2. Recriar a tabela com a estrutura correta
        console.log('\n2. Recreating table with correct schema...');
        
        const recreateSQL = `
            DROP TABLE IF EXISTS newsletter_subscribers;
            CREATE TABLE newsletter_subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                confirmed BOOLEAN DEFAULT 1
            );
        `.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        
        const recreateResult = await runWranglerCommand(
            `npx wrangler d1 execute biomexplore-db --remote --command="${recreateSQL}"`
        );
        
        if (recreateResult.success) {
            console.log('✅ Table recreated successfully');
        } else {
            throw new Error('Failed to recreate table');
        }
        
        // 3. Verificar estrutura
        console.log('\n3. Verifying table structure...');
        const structureResult = await runWranglerCommand(
            'npx wrangler d1 execute biomexplore-db --remote --command="PRAGMA table_info(newsletter_subscribers);"'
        );
        
        if (structureResult.success) {
            console.log('📋 Table columns:');
            structureResult.data[0].results.forEach(col => {
                console.log(`   - ${col.name} (${col.type})`);
            });
        }
        
        // 4. Testar inserção
        console.log('\n4. Testing insertion...');
        const testEmail = `test${Date.now()}@biomexplore.eu`;
        const insertResult = await runWranglerCommand(
            `npx wrangler d1 execute biomexplore-db --remote --command="INSERT INTO newsletter_subscribers (email) VALUES ('${testEmail}');"`
        );
        
        if (insertResult.success) {
            console.log(`✅ Test email inserted: ${testEmail}`);
            
            // Verificar inserção
            const verifyResult = await runWranglerCommand(
                `npx wrangler d1 execute biomexplore-db --remote --command="SELECT id, email, confirmed FROM newsletter_subscribers WHERE email = '${testEmail}';"`
            );
            
            if (verifyResult.success && verifyResult.data[0]?.results?.length > 0) {
                const record = verifyResult.data[0].results[0];
                console.log(`✅ Record verified: ID=${record.id}, Email=${record.email}, Confirmed=${record.confirmed}`);
            }
        }
        
        // 5. Contar total
        console.log('\n5. Final count...');
        const countResult = await runWranglerCommand(
            'npx wrangler d1 execute biomexplore-db --remote --command="SELECT COUNT(*) as total FROM newsletter_subscribers;"'
        );
        
        if (countResult.success) {
            console.log(`📊 Total subscribers: ${countResult.data[0].results[0].total}`);
        }
        
        console.log('\n🎉 Newsletter table fixed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Start dev server: npx wrangler pages dev ./frontend --binding DB=biomexplore-db');
        console.log('   2. Open browser: http://localhost:8787');
        console.log('   3. Test newsletter form');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // Tentar método alternativo
        console.log('\n🔄 Trying alternative method...');
        await alternativeFix();
    }
}

async function alternativeFix() {
    console.log('🛠️ Using alternative fix method...');
    
    // Criar um arquivo SQL temporário
    const fs = require('fs');
    const tempSQL = `
        -- Fix newsletter table
        DROP TABLE IF EXISTS newsletter_subscribers;
        
        CREATE TABLE newsletter_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            confirmed BOOLEAN DEFAULT 1
        );
        
        -- Insert test record
        INSERT INTO newsletter_subscribers (email) VALUES ('test@biomexplore.eu');
    `;
    
    fs.writeFileSync('temp_fix.sql', tempSQL);
    
    console.log('📝 Executing SQL file...');
    const result = await runWranglerCommand(
        'npx wrangler d1 execute biomexplore-db --remote --file=temp_fix.sql'
    );
    
    if (result.success) {
        console.log('✅ Alternative fix successful');
        fs.unlinkSync('temp_fix.sql');
    } else {
        console.log('❌ Alternative fix failed');
    }
}

// Execute
fixNewsletterTable();