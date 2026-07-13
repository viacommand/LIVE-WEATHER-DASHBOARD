const https = require('https');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'debug_log.txt');
function log(msg) {
    const time = new Date().toISOString();
    const entry = `[${time}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(logFile, entry);
}

// Clear log
if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

log('--- OpenAI Connection Diagnostic (File Mode) ---');

// 1. Load .env
let apiKey = null;
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        log('[1/4] Found .env file at: ' + envPath);
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const separatorIndex = line.indexOf('=');
            if (separatorIndex > 0) {
                const key = line.slice(0, separatorIndex).trim();
                const value = line.slice(separatorIndex + 1).trim();
                if (key === 'OPENAI_API_KEY') {
                    apiKey = value;
                }
            }
        });
    } else {
        log('[1/4] FAIL: No .env file found!');
    }
} catch (e) {
    log('[1/4] FAIL: Error reading .env file: ' + e.message);
}

if (!apiKey) {
    log('[2/4] FAIL: OPENAI_API_KEY not found in .env');
} else {
    log('[2/4] API Key loaded: ' + apiKey.substring(0, 7) + '...');
}

// 2. Test Google (Basic Internet Check)
log('[3/4] Testing basic internet (google.com)...');
const googleReq = https.get('https://www.google.com', (res) => {
    log('[3/4] Google Reachable. Status: ' + res.statusCode);
    testOpenAI();
}).on('error', (e) => {
    log('[3/4] FAIL: Google Unreachable. Network issue? ' + e.message);
    testOpenAI(); // Try anyway
});

// 3. Test OpenAI
function testOpenAI() {
    log('[4/4] Testing connection to OpenAI API...');
    const req = https.request('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000 // 10s timeout
    }, (res) => {
        log('Response Status: ' + res.statusCode);
        if (res.statusCode === 200) {
            log('SUCCESS: Connection established and key is valid.');
        } else {
            log('FAIL: OpenAI returned error status.');
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => log('Error Body: ' + data));
        }
    });

    req.on('error', (e) => {
        log('FAIL: Network Error: ' + e.message);
    });

    req.on('timeout', () => {
        log('FAIL: Connection Timed Out');
        req.destroy();
    });

    req.end();
}
