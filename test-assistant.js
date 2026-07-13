const http = require('http');

const payload = JSON.stringify({
    mode: 'outfit',
    weatherData: {
        temp: 22,
        condition: 'Clear',
        humidity: 60,
        windSpeed: 5,
        isDay: true
    }
});

const options = {
    hostname: 'localhost',
    port: 5500,
    path: '/api/chat',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 10000 // 10s timeout
};

console.log('Sending test request to /api/chat...');
const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        console.log(`Received chunk (${chunk.length} bytes)`);
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response received:');
        console.log(data);
        try {
            const json = JSON.parse(data);
            if (json.response && typeof json.response === 'string') {
                console.log('✅ Test Passed: Valid JSON response received.');
                process.exit(0);
            } else {
                console.error('❌ Test Failed: Invalid response format.');
                console.error('Received:', json);
                process.exit(1);
            }
        } catch (e) {
            console.error('❌ Test Failed: Response is not JSON.');
            console.error('Raw Response:', data);
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Request Error: ${e.message}`);
    process.exit(1);
});

req.on('timeout', () => {
    console.error('❌ Request Timeout');
    req.destroy();
    process.exit(1);
});

req.write(payload);
req.end();
