const https = require('https');

const body = JSON.stringify({
    messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
    model: 'openai'
});

console.log('Testing Pollinations.ai...');

const req = https.request('https://text.pollinations.ai/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
}, (res) => {
    let data = '';
    res.on('data', c => { data += c; });
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('RAW DATA:', data); // Debug log

        if (res.statusCode === 200) {
            console.log('AI RESPONSE:', data);
        } else {
            console.log('ERROR:', data.substring(0, 300));
        }
    });
});

req.on('error', e => console.error('CONNECTION ERROR:', e.message));
req.write(body);
req.end();
