const http = require('http');

const modes = ['practical', 'creative', 'wellness', 'travel', 'outfit'];
const weatherData = {
    city: 'Speed Test City',
    current: { temp: 28, condition: 'Sunny' },
    forecast: []
};

async function testMode(mode) {
    return new Promise((resolve) => {
        const start = Date.now();
        const reqData = JSON.stringify({ mode, weatherData });

        const req = http.request('http://localhost:5500/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqData) }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const duration = (Date.now() - start) / 1000;
                console.log(`[${mode.toUpperCase()}] Status: ${res.statusCode} | Time: ${duration.toFixed(2)}s`);
                try {
                    const json = JSON.parse(data);
                    const response = typeof json.response === 'string' ? json.response : JSON.stringify(json.response);

                    if (response.length > 20) console.log(`   Preview: ${response.substring(0, 60)}...`);
                    else console.log(`   Response too short: ${response}`);

                } catch (e) {
                    console.log(`   Error parsing response: ${e.message}`);
                }
                resolve();
            });
        });

        req.on('error', e => {
            console.log(`[${mode.toUpperCase()}] Failed: ${e.message}`);
            resolve();
        });

        req.write(reqData);
        req.end();
    });
}

async function runTests() {
    console.log('Testing Universal Fallback Speed...');
    for (const mode of modes) {
        await testMode(mode);
    }
}

runTests();
