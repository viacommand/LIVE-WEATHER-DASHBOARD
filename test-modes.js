const https = require('https');

const modes = ['practical', 'travel', 'wellness', 'creative'];
const weatherData = {
    city: 'Test City',
    current: { temp: 25, condition: 'Sunny' },
    forecast: []
};

const fs = require('fs');
function log(msg) {
    console.log(msg);
    fs.appendFileSync('test_output.txt', msg + '\n');
}

function testMode(mode) {
    return new Promise((resolve) => {
        log(`\n--- Testing Mode: ${mode} ---`);
        const body = JSON.stringify({ mode, weatherData });
        const req = http.request('http://localhost:5500/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                log(`STATUS: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    const parsed = JSON.parse(data);
                    log('RESPONSE SNIPPET: ' + parsed.response.substring(0, 100) + '...');
                    // Check for <b> tags in structured modes
                    if (mode !== 'creative' && !parsed.response.includes('<b>')) {
                        log('WARNING: Response missing <b> tags for structured mode!');
                    }
                } else {
                    log('ERROR: ' + data);
                }
                resolve();
            });
        });
        req.on('error', e => {
            log('CONNECTION ERROR: ' + e.message);
            resolve();
        });
        req.write(body);
        req.end();
    });
}



async function runTests() {
    for (const mode of modes) {
        await testMode(mode);
    }
}

runTests();
