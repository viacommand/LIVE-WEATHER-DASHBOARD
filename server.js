const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Setup file logging
const logFile = path.join(__dirname, 'server_log.txt');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Override console methods to log to file
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function logToFile(type, args) {
    const msg = util.format(...args);
    const time = new Date().toISOString();
    logStream.write(`[${time}] [${type}] ${msg}\n`);
}

console.log = (...args) => {
    logToFile('INFO', args);
    originalLog.apply(console, args);
};

console.warn = (...args) => {
    logToFile('WARN', args);
    originalWarn.apply(console, args);
};

console.error = (...args) => {
    logToFile('ERROR', args);
    originalError.apply(console, args);
};

const PORT = 5500;
const STATIC_DIR = __dirname;
const API_BASE = 'http://api.openweathermap.org'; // Use HTTP (not HTTPS)

// Load .env file manually (simple parser)
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const separatorIndex = line.indexOf('=');
            if (separatorIndex > 0) {
                const key = line.slice(0, separatorIndex).trim();
                const value = line.slice(separatorIndex + 1).trim();
                if (key && value) {
                    process.env[key] = value;
                }
            }
        });
        console.log('[Server] Loaded .env file');
    } else {
        console.log('[Server] No .env file found at:', envPath);
    }
} catch (err) {
    console.warn('[Server] Warning: Could not load .env file', err.message);
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webp': 'image/webp',
};

function proxyRequest(targetUrl, res, binary = false) {
    console.log('[Proxy] ->', targetUrl);
    const client = targetUrl.startsWith('https') ? https : http;
    client.get(targetUrl, (apiRes) => {
        const contentType = apiRes.headers['content-type'] || (binary ? 'image/png' : 'application/json');
        if (binary) {
            // Stream binary tile data directly
            res.writeHead(apiRes.statusCode, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
            });
            const chunks = [];
            apiRes.on('data', chunk => chunks.push(chunk));
            apiRes.on('end', () => {
                const buf = Buffer.concat(chunks);
                console.log('[Proxy] <- Status:', apiRes.statusCode, '| Size:', buf.length);
                res.end(buf);
            });
        } else {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => {
                console.log('[Proxy] <- Status:', apiRes.statusCode, '| Size:', data.length);
                res.writeHead(apiRes.statusCode, {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                });
                res.end(data);
            });
        }
    }).on('error', (err) => {
        console.error('[Proxy] ERROR:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Proxy API calls to OpenWeatherMap (via HTTP)
    if (url.pathname.startsWith('/api/weather')) {
        const params = url.searchParams.toString();
        proxyRequest(`${API_BASE}/data/2.5/weather?${params}`, res);
        return;
    }
    if (url.pathname.startsWith('/api/forecast')) {
        const params = url.searchParams.toString();
        proxyRequest(`${API_BASE}/data/2.5/forecast?${params}`, res);
        return;
    }
    if (url.pathname.startsWith('/api/geo')) {
        const params = url.searchParams.toString();
        proxyRequest(`${API_BASE}/geo/1.0/direct?${params}`, res);
        return;
    }
    if (url.pathname.startsWith('/api/air_pollution')) {
        const params = url.searchParams.toString();
        proxyRequest(`${API_BASE}/data/2.5/air_pollution?${params}`, res);
        return;
    }

    // Proxy API calls for Weather Map Tiles (free OWM plan)
    // Client calls: /api/map/{layer}/{z}/{x}/{y}?appid=...
    if (url.pathname.startsWith('/api/map')) {
        // Remove '/api/map' prefix to get /{layer}/{z}/{x}/{y}
        const mapPath = url.pathname.replace('/api/map', '');
        const params = url.searchParams.toString();

        // Free-tier OWM tile URL (no Maps 2.0 required)
        const targetUrl = `https://tile.openweathermap.org/map${mapPath}.png?${params}`;

        proxyRequest(targetUrl, res, true); // binary = true for PNG tiles
        return;
    }

    // Proxy API calls for Open-Meteo (Data Enhancements)
    if (url.pathname.startsWith('/api/extra')) {
        const params = url.searchParams.toString();
        // Forward to Open-Meteo Forecast API
        proxyRequest(`https://api.open-meteo.com/v1/forecast?${params}`, res);
        return;
    }

    if (url.pathname.startsWith('/api/air-quality')) {
        const params = url.searchParams.toString();
        // Forward to Open-Meteo Air Quality API
        proxyRequest(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, res);
        return;
    }

    if (url.pathname.startsWith('/api/alerts')) {
        // Open-Meteo does not have a public alerts API endpoint.
        // Return an empty alerts response so the client doesn't error.
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ features: [] }));
        return;
    }

    // Smart Assistant API Endpoint (Groq -> OpenAI -> Pollinations Fallback)
    if (url.pathname === '/api/chat') {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { mode, weatherData } = JSON.parse(body);
                const weatherString = JSON.stringify(weatherData);
                const cityName = weatherData?.city || 'your city';

                // --- 1. Prompt Engineering ---
                let systemPrompt = '';
                let userPrompt = '';

                // Common JSON rules
                const jsonRules = `STRICT JSON RULES:
                - Return ONLY a valid JSON object.
                - Do NOT include markdown formatting (e.g., \`\`\`json).
                - Do NOT include introductory text.
                - The response must be parseable by JSON.parse().`;

                if (mode === 'practical') {
                    systemPrompt = `You are a SUPERSTAR Smart Weather Assistant AI. Your job is to give energetic, confident, actionable advice about the current weather.

                    You MUST STRICTLY respond in this EXACT format — no deviations:

                    Advice:
                    • [Point 1 — practical tip based on weather]
                    • [Point 2]
                    • [Point 3]
                    • [Point 4]
                    (4 to 8 bullets. Each bullet is 1 short, punchy sentence. Cover: how it feels, UV/rain/wind alerts, best time to go out, what to wear, what to do/avoid.)

                    Fun:
                    [1 fun weather joke or observation — max 1-2 sentences]
                    [1 more fun line — weather pun or emoji reaction]

                    Recommendation:
                    [Exactly 1 bold, high-impact recommendation for today.]

                    RULES:
                    - Use emojis liberally.
                    - Tone: Energetic, confident, engaging. Like a Superstar host.
                    - Do NOT add extra sections, intros, or conclusions.
                    - Ground every point in the ACTUAL weather data provided.`;

                    userPrompt = `Weather Data for ${cityName}: ${weatherString}. Give a Superstar Weather Briefing now!`;
                } else if (mode === 'creative') {
                    systemPrompt = "You are a charismatic weather narrator. Write a short, engaging story or observation about the current weather. You can use a <b>Pro Tip</b> section at the end if you like, but keep the main text flowy and fun. Use emojis.";
                    userPrompt = `Weather Data: ${weatherString}`;
                } else if (mode === 'wellness') {
                    systemPrompt = "You are a health consultant. Return advice in 3 distinct sections. Start each section header with a <b> tag and end with </b>. Required headers: <b>Skin Health</b>, <b>Respiratory</b>, and <b>Energy Levels</b>. Focus on UV, humidity, and pressure.";
                    userPrompt = `Weather Data: ${weatherString}`;
                } else if (mode === 'travel') {
                    systemPrompt = "You are a travel advisor. Return advice in 3 distinct sections. Start each section header with a <b> tag and end with </b>. Required headers: <b>Road Conditions</b>, <b>Flight Delays</b>, and <b>What to Carry</b>. Focus on safety and commuting.";
                    userPrompt = `Weather Data: ${weatherString}`;
                } else if (mode === 'outfit') {
                    systemPrompt = `You are a fashion stylist for ${cityName}. Suggest an outfit based on the weather.
                    
                    STRICT INSTRUCTIONS:
                    1. Return ONLY a valid JSON object.
                    2. Do NOT include markdown formatting (e.g., \`\`\`json).
                    3. Do NOT include any introductory or concluding text.
                    4. The response must be directly parseable by JSON.parse().
                    
                    REQUIRED JSON STRUCTURE:
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
                    userPrompt = `Current Weather and Forecast Data: ${weatherString}. Ensure the 24h forecast array matches the input times provided. Return valid JSON only.`;
                } else {
                    throw new Error('Invalid mode selected');
                }

                // --- 2. Provider Selection Logic ---
                let aiResponseText = '';

                // Helper: Pollinations with timeout + validation
                const tryPollinations = async () => {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('AI_TIMEOUT')), 5000);
                    });

                    let text = await Promise.race([
                        callPollinations(systemPrompt, userPrompt, mode === 'outfit'),
                        timeoutPromise
                    ]);

                    // VALIDATION for outfit mode
                    if (mode === 'outfit') {
                        try {
                            const parsed = JSON.parse(text);
                            if (!parsed.current_recommendation || !parsed.forecast_24h) {
                                throw new Error('Missing required JSON fields');
                            }
                        } catch (parseError) {
                            console.warn('[AI] Received malformed JSON from Pollinations. Switching to offline.');
                            throw new Error('MALFORMED_JSON');
                        }
                    }
                    return text;
                };

                // A. Try Groq (Fastest & Free-ish)
                if (process.env.GROQ_API_KEY) {
                    console.log('[AI] Using Provider: Groq');
                    try {
                        aiResponseText = await callGroqAPI(systemPrompt, userPrompt);
                    } catch (groqErr) {
                        console.warn(`[AI] Groq failed (${groqErr.message}), falling back to Pollinations...`);
                        try {
                            aiResponseText = await tryPollinations();
                        } catch (pollErr) {
                            console.warn(`[AI] Pollinations failed (${pollErr.message}), going offline.`);
                            aiResponseText = generateOfflineResponse(mode, weatherData);
                            if (typeof aiResponseText === 'object') aiResponseText = JSON.stringify(aiResponseText);
                        }
                    }
                }
                // B. Try OpenAI (Standard)
                else if (process.env.OPENAI_API_KEY) {
                    console.log('[AI] Using Provider: OpenAI');
                    try {
                        aiResponseText = await callOpenAIAPI(systemPrompt, userPrompt);
                    } catch (oaiErr) {
                        console.warn(`[AI] OpenAI failed (${oaiErr.message}), falling back to Pollinations...`);
                        try {
                            aiResponseText = await tryPollinations();
                        } catch (pollErr) {
                            console.warn(`[AI] Pollinations failed (${pollErr.message}), going offline.`);
                            aiResponseText = generateOfflineResponse(mode, weatherData);
                            if (typeof aiResponseText === 'object') aiResponseText = JSON.stringify(aiResponseText);
                        }
                    }
                }
                // C. Fallback to Pollinations (Free, Slower)
                else {
                    console.log('[AI] Using Provider: Pollinations (Fallback)');
                    try {
                        aiResponseText = await tryPollinations();
                    } catch (err) {
                        console.warn(`[AI] System switch to offline mode (Reason: ${err.message})`);
                        aiResponseText = generateOfflineResponse(mode, weatherData);
                        if (typeof aiResponseText === 'object') aiResponseText = JSON.stringify(aiResponseText);
                    }
                }

                // --- 3. Send Response ---
                console.log('[AI] Success. Response length:', aiResponseText.length);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response: aiResponseText }));

            } catch (err) {
                console.error('[AI] Handler Error:', err.message);

                // Final safety net - generate offline if possible
                try {
                    const { mode, weatherData } = JSON.parse(body);
                    let offlineResponse = generateOfflineResponse(mode, weatherData);
                    if (typeof offlineResponse === 'object') offlineResponse = JSON.stringify(offlineResponse);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ response: offlineResponse }));
                    return;
                } catch (e) {
                    console.error('Final fallback failed:', e);
                }

                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            }
        });
        return;
    }

    // --- AI Helper Functions ---

    function generateOfflineResponse(mode, data) {
        const temp = data.current.temp;
        const condition = (data.current.condition || '').toLowerCase();
        const isRain = condition.includes('rain') || condition.includes('drizzle');
        const isClear = condition.includes('clear') || condition.includes('sun');

        // -- Outfit Logic --
        if (mode === 'outfit') {
            return generateOfflineOutfit(data);
        }

        // -- Practical Logic --
        if (mode === 'practical') {
            let wear = "Comfortable clothing suitable for current weather.";
            let activity = "Indoor activities might be best.";

            if (temp > 25) {
                wear = "Lightweight, breathable clothing. Stay cool!";
                activity = "Great for swimming or indoor AC.";
            } else if (temp < 15) {
                wear = "Warm layers, a jacket is recommended.";
                activity = "A brisk walk or cozy indoor reading.";
            } else {
                wear = "Standard day wear, t-shirt and jeans.";
                activity = "Perfect for outdoor sports or walking.";
            }

            if (isRain) {
                wear += " Don't forget an umbrella!";
                activity = "Rainy day! Maybe visit a museum or cafe.";
            }

            return `<b>Current Conditions</b>: It's ${temp}°C and ${data.current.condition}.<br><br><b>Wear</b>: ${wear}<br><br><b>Activity</b>: ${activity}`;
        }

        // -- Creative Logic --
        if (mode === 'creative') {
            const emojis = isRain ? "🌧️☔🐸" : isClear ? "☀️😎🌻" : "☁️🍂☕";
            const mood = isRain ? "rhythmic patter of rain" : isClear ? "golden embrace of the sun" : "soft blanket of clouds";
            return `The world outside whispers a story of ${mood}. At ${temp}°C, the air feels alive. Nature is painting a scene just for you today. Take a moment to breathe it in! ${emojis}<br><br><b>Pro Tip</b>: Perfect weather to capture a photo or write a poem.`;
        }

        // -- Wellness Logic --
        if (mode === 'wellness') {
            let skin = "Apply moisturizer.";
            let resp = "Air quality is likely normal.";
            let energy = "Moderate energy levels expected.";

            if (temp > 25 && isClear) {
                skin = "High UV Alert! Wear SPF 50+ and stay hydrated.";
                energy = "Heat may drain energy, rest often.";
            } else if (temp < 10) {
                skin = "Cold air dries skin, use heavy cream.";
                resp = "Cold air can trigger asthma, cover nose/mouth.";
            }

            return `<b>Skin Health</b>: ${skin}<br><br><b>Respiratory</b>: ${resp}<br><br><b>Energy Levels</b>: ${energy}`;
        }

        // -- Travel Logic --
        if (mode === 'travel') {
            let road = "Roads should be clear.";
            let flight = "No major weather delays expected.";
            let pack = "Standard travel kit.";

            if (isRain) {
                road = "Slippery roads! Drive carefully and increase distance.";
                flight = "Possible minor delays due to visibility.";
                pack = "Pack an umbrella and extra shoes.";
            }

            return `<b>Road Conditions</b>: ${road}<br><br><b>Flight Delays</b>: ${flight}<br><br><b>What to Carry</b>: ${pack}`;
        }

        return "Offline mode active. Check connection for more AI insights.";
    }

    function generateOfflineOutfit(data) {
        const currentTemp = data.current.temp;
        const condition = (data.current.condition || '').toLowerCase();
        const isRain = condition.includes('rain') || condition.includes('drizzle');
        const isSnow = condition.includes('snow');

        let top = "T-Shirt";
        let bottom = "Jeans";
        let footwear = "Sneakers";
        let accessory = "None";

        if (currentTemp < 5) { top = "Heavy Coat"; bottom = "Thermals"; footwear = "Boots"; accessory = "Scarf"; }
        else if (currentTemp < 15) { top = "Sweater"; bottom = "Jeans"; footwear = "Boots"; accessory = "Beanie"; }
        else if (currentTemp < 22) { top = "Hoodie"; bottom = "Chinos"; footwear = "Sneakers"; }
        else if (currentTemp < 28) { top = "Polo"; bottom = "Shorts"; footwear = "Canvas Shoes"; accessory = "Sunglasses"; }
        else { top = "Linen Shirt"; bottom = "Shorts"; footwear = "Sandals"; accessory = "Hat"; }

        if (isRain) { top += " + Raincoat"; accessory = "Umbrella"; }

        return {
            current_recommendation: { top, bottom, footwear, accessory },
            forecast_24h: [] // Simplified for speed
        };
    }

    function callGroqAPI(system, user) {
        return new Promise((resolve, reject) => {
            const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }, (res) => handleStream(res, resolve, reject));

            req.on('error', reject);
            req.write(JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
                temperature: 0.7,
                max_tokens: 1024
            }));
            req.end();
        });
    }

    function callOpenAIAPI(system, user) {
        return new Promise((resolve, reject) => {
            const req = https.request('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                }
            }, (res) => handleStream(res, resolve, reject));

            req.on('error', reject);
            req.write(JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
            }));
            req.end();
        });
    }

    function callPollinations(system, user, jsonMode) {
        return new Promise((resolve, reject) => {
            const req = https.request('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000 // Increased timeout for stability
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log('[Pollinations] Raw:', data.substring(0, 100) + '...');
                        resolve(data);
                    }
                    else reject(new Error(`Pollinations Status ${res.statusCode}`));
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

            // For outfit mode, we try to force JSON structure via prompting (which is already done in the system prompt)
            // Pollinations doesn't strictly support 'jsonMode' param like OpenAI, but we pass the model hint.
            req.write(JSON.stringify({
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
                model: 'openai', // Requesting OpenAI-like behavior from Pollinations
                jsonMode: jsonMode,
                seed: Math.floor(Math.random() * 1000) // Random seed for variety
            }));
            req.end();
        });
    }

    function handleStream(res, resolve, reject) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const json = JSON.parse(data);
                    const content = json.choices?.[0]?.message?.content || '';
                    resolve(content);
                } catch (e) {
                    reject(new Error('Failed to parse provider response'));
                }
            } else {
                reject(new Error(`API Error ${res.statusCode}: ${data}`));
            }
        });
    }

    // Serve static files
    const decodedPath = decodeURIComponent(url.pathname);
    let filePath = path.join(STATIC_DIR, decodedPath === '/' ? 'index.html' : decodedPath);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log('==============================================');
    console.log('  LIVE WEATHER DASHBOARD — Local Server');
    console.log('==============================================');
    console.log(`  Server running at: http://localhost:${PORT}`);
    console.log('  API proxy active — all weather calls routed through server');
    if (process.env.GROQ_API_KEY) {
        console.log('  [AI] Groq API Key loaded ✓  (Primary Provider)');
    } else if (process.env.OPENAI_API_KEY) {
        console.log('  [AI] OpenAI API Key loaded ✓  (Primary Provider)');
    } else {
        console.log('  [AI] Using Pollinations (Free) for AI features');
    }

    console.log('  Press Ctrl+C to stop');
    console.log('==============================================');
});
