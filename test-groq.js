const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env
let key = null;
try {
    const envPath = path.join(__dirname, '.env');
    console.log('Loading .env from:', envPath);
    if (fs.existsSync(envPath)) {
        console.log('.env file found.');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const separatorIndex = line.indexOf('=');
            if (separatorIndex > 0) {
                const k = line.slice(0, separatorIndex).trim();
                const v = line.slice(separatorIndex + 1).trim();
                if (k === 'GROQ_API_KEY') {
                    key = v;
                    console.log('API Key loaded successfully.');
                }
            }
        });
    } else {
        console.log('.env file NOT found.');
    }
} catch (e) {
    console.error('Error loading .env:', e);
}

if (!key) {
    console.error('ERROR: GROQ_API_KEY not found in .env');
    process.exit(1);
}

const body = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
    max_tokens: 20
});

const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'Content-Length': Buffer.byteLength(body)
    }
}, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        if (res.statusCode === 200) {
            const p = JSON.parse(data);
            console.log('AI SAYS:', p.choices[0].message.content);
            console.log('TOKENS:', p.usage?.total_tokens);
        } else {
            console.log('ERROR:', data.substring(0, 300));
        }
    });
});

req.on('error', e => console.error('CONNECTION ERROR:', e.message));
req.write(body);
req.end();
