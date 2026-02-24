const http = require('http');

function testEndpoint(path) {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:5500${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject('Invalid JSON');
                    }
                } else {
                    reject(`Status ${res.statusCode}`);
                }
            });
        });
        req.on('error', reject);
    });
}

async function runTests() {
    console.log('Testing Open-Meteo Proxies...');

    try {
        // Test 1: Extra Data (Forecast)
        console.log('1. Testing /api/extra (Forecast)...');
        const extra = await testEndpoint('/api/extra?latitude=51.5074&longitude=-0.1278&daily=sunrise,sunset,moon_phase&hourly=visibility&timezone=auto');
        if (extra.daily && extra.daily.moon_phase) {
            console.log('✅ Success: Got Moon Phase data');
        } else {
            console.error('❌ Failed: Missing moon_phase');
        }

        // Test 2: Air Quality
        console.log('2. Testing /api/air-quality...');
        const aqi = await testEndpoint('/api/air-quality?latitude=51.5074&longitude=-0.1278&hourly=pm10,pm2_5,uv_index&timezone=auto');
        if (aqi.hourly && aqi.hourly.pm2_5) {
            console.log('✅ Success: Got Air Quality data');
        } else {
            console.error('❌ Failed: Missing PM2.5 data');
        }

    } catch (err) {
        console.error('❌ Error during testing:', err);
    }
}

runTests();
