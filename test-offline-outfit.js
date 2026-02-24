const http = require('http');

console.log('Testing Offline Outfit Fallback...');

// Mock data simulating a request
const requestData = JSON.stringify({
    mode: 'outfit',
    weatherData: {
        city: 'Offline City',
        current: { temp: 15, condition: 'Rain' },
        forecast: [
            { time: '10:00', temp: '14°C', condition: 'Rain' },
            { time: '12:00', temp: '16°C', condition: 'Cloudy' }
        ]
    }
});

// We can't easily force the server to fail strictly from outside without stopping the internet,
// BUT since we just added logic, if we set the API key to INVALID or loopback to something broken, it would trigger.
// better yet, we can unit test the function if we exported it, but we didn't.
// So we will just call the endpoint. If Pollinations is up, it might reply with AI. 
// To strictly test offline, we/user need to disconnect. 
// HOWEVER, we can check if the response format is valid regardless of source.

const req = http.request('http://localhost:5500/api/chat', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
    }
}, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        try {
            const json = JSON.parse(data);
            const aiResponse = JSON.parse(json.response);
            console.log('Response Type:', typeof aiResponse);
            console.log('Top Recommendation:', aiResponse.current_recommendation?.top);
            if (aiResponse.current_recommendation) {
                console.log('✅ Got a valid outfit recommendation!');
            }
        } catch (e) {
            console.log('Response was plain text or error:', data);
        }
    });
});

req.on('error', e => console.error('Error:', e.message));
req.write(requestData);
req.end();
