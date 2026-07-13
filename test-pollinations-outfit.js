const https = require('https');

const systemPrompt = `You are a fashion stylist for New York. Suggest an outfit based on the weather.

STRICT INSTRUCTIONS:
1. Return ONLY a valid JSON object.
2. Do NOT include markdown formatting (e.g., \`\`\`json).
3. Do NOT include any introductory or concluding text.
4. The response must be directly parseable by JSON.parse().

REQUIRED JSON Structure:
{
  "current_recommendation": {"top": "String", "bottom": "String", "footwear": "String", "accessory": "String"},
  "forecast_24h": [
    {"time": "String (e.g. 10 PM)", "temp": "String", "condition": "String", "top": "String", "bottom": "String", "footwear": "String", "accessory": "String"}
  ]
}

EXAMPLE RESPONSE:
{
  "current_recommendation": {"top": "Light Jacket", "bottom": "Jeans", "footwear": "Sneakers", "accessory": "Sunglasses"},
  "forecast_24h": []
}`;

const userPrompt = `Current Weather and Forecast Data: {"city":"New York","current":{"temp":20,"condition":"Clear"},"forecast":[{"time":"10:00 PM","temp":"18°C","condition":"Clear"},{"time":"01:00 AM","temp":"16°C","condition":"Clear"}]}. Ensure the 24h forecast array matches the input times provided.`;

console.log('Testing Pollinations Outfit Model...');

const req = https.request('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000
}, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('RAW DATA START:', data.substring(0, 500));

        try {
            // Simulate ai.js extraction logic
            const match = data.match(/\{[\s\S]*\}/);
            if (match) {
                const jsonStr = match[0];
                const json = JSON.parse(jsonStr);
                console.log('✅ JSON PARSED SUCCESSFULLY');
                console.log('Current Top:', json.current_recommendation?.top);
                console.log('Forecast Items:', json.forecast_24h?.length);
            } else {
                console.error('❌ NO JSON BLOCK FOUND');
                console.log('Full Output:\n', data);
            }
        } catch (e) {
            console.error('❌ JSON PARSE FAILED:', e.message);
            console.log('Full Output:\n', data);
        }
    });
});

req.on('error', e => console.error('CONNECTION ERROR:', e.message));

req.write(JSON.stringify({
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    model: 'openai',
    jsonMode: true,
    seed: 123
}));
req.end();
