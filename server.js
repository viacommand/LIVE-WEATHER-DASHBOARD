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

const apiCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

function getCachedResponse(targetUrl) {
    const cached = apiCache[targetUrl];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached;
    }
    return null;
}

function setCachedResponse(targetUrl, statusCode, headers, body, isBinary = false) {
    apiCache[targetUrl] = {
        statusCode,
        headers: {
            'Content-Type': headers['content-type'] || (isBinary ? 'image/png' : 'application/json'),
            'Access-Control-Allow-Origin': '*'
        },
        body,
        isBinary,
        timestamp: Date.now()
    };
}

function proxyRequest(targetUrl, res, binary = false) {
    // Check Cache
    const cached = getCachedResponse(targetUrl);
    if (cached) {
        console.log('[Cache HIT] <-', targetUrl);
        res.writeHead(cached.statusCode, cached.headers);
        res.end(cached.body);
        return;
    }

    console.log('[Proxy] ->', targetUrl);
    const client = targetUrl.startsWith('https') ? https : http;
    client.get(targetUrl, (apiRes) => {
        const contentType = apiRes.headers['content-type'] || (binary ? 'image/png' : 'application/json');
        if (binary) {
            // Stream binary tile data directly
            const chunks = [];
            apiRes.on('data', chunk => chunks.push(chunk));
            apiRes.on('end', () => {
                const buf = Buffer.concat(chunks);
                console.log('[Proxy] <- Status:', apiRes.statusCode, '| Size:', buf.length);
                if (apiRes.statusCode === 200) {
                    setCachedResponse(targetUrl, apiRes.statusCode, apiRes.headers, buf, true);
                }
                res.writeHead(apiRes.statusCode, {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                });
                res.end(buf);
            });
        } else {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => {
                console.log('[Proxy] <- Status:', apiRes.statusCode, '| Size:', data.length);
                if (apiRes.statusCode === 200) {
                    setCachedResponse(targetUrl, apiRes.statusCode, apiRes.headers, data, false);
                }
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
        let dailyParam = url.searchParams.get('daily');
        let hasMoonPhase = false;
        let hasMoonrise = false;
        let hasMoonset = false;
        if (dailyParam) {
            let parts = dailyParam.split(',');
            if (parts.includes('moon_phase')) {
                hasMoonPhase = true;
                parts = parts.filter(p => p !== 'moon_phase');
            }
            if (parts.includes('moonrise')) {
                hasMoonrise = true;
                parts = parts.filter(p => p !== 'moonrise');
            }
            if (parts.includes('moonset')) {
                hasMoonset = true;
                parts = parts.filter(p => p !== 'moonset');
            }
            url.searchParams.set('daily', parts.join(','));
        }

        const targetUrl = `https://api.open-meteo.com/v1/forecast?${url.searchParams.toString()}`;
        
        // Check cache
        const cached = getCachedResponse(targetUrl);
        if (cached) {
            console.log('[Cache HIT] Intercepted /api/extra -> requesting', targetUrl);
            res.writeHead(cached.statusCode, cached.headers);
            res.end(cached.body);
            return;
        }

        console.log('[Proxy] Intercepted /api/extra -> requesting', targetUrl);

        https.get(targetUrl, (apiRes) => {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => {
                if (apiRes.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        if (json.daily && json.daily.time) {
                            const times = json.daily.time;
                            if (hasMoonPhase) {
                                json.daily.moon_phase = times.map(timeStr => {
                                    const date = new Date(timeStr);
                                    // Reference New Moon: 2000-01-06 18:14 UTC
                                    const refDate = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
                                    const diffMs = date.getTime() - refDate.getTime();
                                    const diffDays = diffMs / (1000 * 60 * 60 * 24);
                                    const lunarMonth = 29.530588853;
                                    let phase = (diffDays / lunarMonth) % 1.0;
                                    if (phase < 0) phase += 1.0;
                                    return parseFloat(phase.toFixed(2));
                                });
                            }
                            if (hasMoonrise) {
                                json.daily.moonrise = times.map(timeStr => `${timeStr}T18:00`);
                            }
                            if (hasMoonset) {
                                json.daily.moonset = times.map(timeStr => `${timeStr}T06:00`);
                            }
                        }
                        const responseBody = JSON.stringify(json);
                        setCachedResponse(targetUrl, 200, { 'content-type': 'application/json' }, responseBody, false);
                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(responseBody);
                    } catch (e) {
                        console.error('[Proxy] Error parsing/modifying Open-Meteo JSON:', e);
                        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify({ error: 'Internal Server Error modifying data' }));
                    }
                } else {
                    console.warn('[Proxy] Open-Meteo returned status:', apiRes.statusCode);
                    res.writeHead(apiRes.statusCode, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(data);
                }
            });
        }).on('error', (err) => {
            console.error('[Proxy] Open-Meteo request error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
        });
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
                    systemPrompt = "You are a warm, thoughtful, and gentle Weather Advisor, styled after Claude's empathetic, clear, and polite voice. Return advice in 3 distinct sections. Start each section header with a <b> tag and end with </b>. Required headers: <b>⚡ Advice</b>, <b>😄 Fun Zone</b>, and <b>🚀 Recommendation</b>. Give helpful, kind, and practical suggestions for the user's day based strictly on the current weather conditions. Maintain a supportive and warm tone.";
                    userPrompt = `Weather Data: ${weatherString}`;
                } else if (mode === 'creative') {
                    systemPrompt = "You are a gentle, reflective weather narrator with a warm and peaceful voice, resembling Claude's thoughtful style. Write a short, engaging, and beautifully worded story or observation about the current weather. Keep it flowy, comforting, and serene. You can use a <b>Pro Tip</b> section at the end if you like. Use emojis thoughtfully and sparingly.";
                    userPrompt = `Weather Data: ${weatherString}`;
                } else if (mode === 'wellness') {
                    systemPrompt = "You are a caring and gentle health consultant, styled after Claude's supportive and empathetic style. Return advice in 3 distinct sections. Start each section header with a <b> tag and end with </b>. Required headers: <b>Skin Health</b>, <b>Respiratory</b>, and <b>Energy Levels</b>. Give warm, considerate guidance focusing on UV, humidity, and pressure to support the user's well-being today.";
                    userPrompt = `Weather Data: ${weatherString}`;
                } else if (mode === 'travel') {
                    systemPrompt = "You are a thoughtful and reassuring travel advisor with a warm, gentle voice, resembling Claude's clear, polite, and safety-conscious style. Return advice in 3 distinct sections. Start each section header with a <b> tag and end with </b>. Required headers: <b>Road Conditions</b>, <b>Flight Delays</b>, and <b>What to Carry</b>. Offer comforting, clear, and safety-focused practical guidance.";
                    userPrompt = `Weather Data: ${weatherString}`;
                } else if (mode === 'outfit') {
                    systemPrompt = `You are a warm, gentle, and practical fashion stylist for ${cityName}, styled after Claude's helpful and supportive voice. Suggest a comfortable outfit based on the weather.
                    
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

                // A. Try OpenAI (Standard)
                if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== '$val') {
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
                // B. Try Anthropic / Claude
                else if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== '$val') {
                    console.log('[AI] Using Provider: Anthropic (Claude)');
                    try {
                        aiResponseText = await callAnthropicAPI(systemPrompt, userPrompt);
                    } catch (antErr) {
                        console.warn(`[AI] Anthropic failed (${antErr.message}), falling back to Pollinations...`);
                        try {
                            aiResponseText = await tryPollinations();
                        } catch (pollErr) {
                            console.warn(`[AI] Pollinations failed (${pollErr.message}), going offline.`);
                            aiResponseText = generateOfflineResponse(mode, weatherData);
                            if (typeof aiResponseText === 'object') aiResponseText = JSON.stringify(aiResponseText);
                        }
                    }
                }
                // C. Try Groq (Fastest & Free-ish)
                else if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== '$val') {
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
                // D. Fallback to Pollinations (Free, Slower)
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
        const temp = data?.current?.temp !== undefined ? data.current.temp : (data?.temp !== undefined ? data.temp : 20);
        const rawCondition = data?.current?.condition || data?.condition || '';
        const condition = rawCondition.toLowerCase();
        const isRain = condition.includes('rain') || condition.includes('drizzle');
        const isClear = condition.includes('clear') || condition.includes('sun');

        // -- Outfit Logic --
        if (mode === 'outfit') {
            return generateOfflineOutfit(data);
        }

        // -- Practical Logic --
        if (mode === 'practical') {
            let wear = "Comfortable, relaxed clothing suitable for the current weather.";
            let activity = "It might be a lovely day for some cozy indoor activities.";

            if (temp > 25) {
                wear = "Lightweight, breathable fabrics to help you stay cool and comfortable.";
                activity = "A wonderful time for swimming or relaxing in a cool, air-conditioned space.";
            } else if (temp < 15) {
                wear = "Warm, cozy layers. A supportive jacket or thick sweater would be lovely.";
                activity = "Perfect for a refreshing walk outside or curling up with a comforting book.";
            } else {
                wear = "Casual, everyday attire like a comfortable t-shirt and jeans.";
                activity = "Ideal weather for a gentle walk, outdoor sports, or a peaceful park visit.";
            }

            if (isRain) {
                wear += " Don't forget to keep a trusty umbrella close by!";
                activity = "A rainy day is a perfect opportunity to visit a local cafe or enjoy a museum.";
            }

            return `<b>Current Conditions</b>: It's a gentle ${temp}°C with ${rawCondition || 'unknown'} skies.<br><br><b>Wear</b>: ${wear}<br><br><b>Activity</b>: ${activity}`;
        }

        // -- Creative Logic --
        if (mode === 'creative') {
            const emojis = isRain ? "🌧️☔🐌" : isClear ? "☀️🌻✨" : "☁️☕🍂";
            const mood = isRain ? "the rhythmic, calming patter of rain" : isClear ? "the warm, golden embrace of the sun" : "a soft, quiet blanket of clouds";
            return `The world outside whispers a gentle story of ${mood}. At ${temp}°C, the air feels peaceful and alive. Nature is painting a quiet scene just for you today. Take a warm moment to breathe it all in! ${emojis}<br><br><b>Pro Tip</b>: A lovely day to sketch, capture a quiet photo, or simply enjoy a warm beverage.`;
        }

        // -- Wellness Logic --
        if (mode === 'wellness') {
            let skin = "A light, soothing moisturizer would be wonderful.";
            let resp = "The air quality is pleasant and normal.";
            let energy = "A day for moderate, steady energy levels.";

            if (temp > 25 && isClear) {
                skin = "The sun is strong today. Please consider wearing SPF 50+ and staying kindly hydrated.";
                energy = "The warmth might be a bit draining, so do take gentle rests when you need them.";
            } else if (temp < 10) {
                skin = "Crisp air can dry the skin, so a rich, nourishing cream would be lovely.";
                resp = "The brisk air can be a bit sharp; covering your nose and mouth might feel comforting.";
            }

            return `<b>Skin Health</b>: ${skin}<br><br><b>Respiratory</b>: ${resp}<br><br><b>Energy Levels</b>: ${energy}`;
        }

        // -- Travel Logic --
        if (mode === 'travel') {
            let road = "Roads should be pleasant and clear.";
            let flight = "No major weather-related travel disruptions are anticipated.";
            let pack = "A standard, simple travel kit.";

            if (isRain) {
                road = "Roads may be slick. Please drive extra carefully and maintain a safe, gentle distance.";
                flight = "There might be minor delays due to visibility; it's a good idea to check your flight status.";
                pack = "An umbrella, rain jacket, and comfortable waterproof shoes would be great additions.";
            }

            return `<b>Road Conditions</b>: ${road}<br><br><b>Flight Delays</b>: ${flight}<br><br><b>What to Carry</b>: ${pack}`;
        }

        return "Offline mode is active. Please check your connection for more personalized AI insights.";
    }

    function generateOfflineOutfit(data) {
        const currentTemp = data?.current?.temp !== undefined ? data.current.temp : (data?.temp !== undefined ? data.temp : 20);
        const rawCondition = data?.current?.condition || data?.condition || '';
        const condition = rawCondition.toLowerCase();
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

    function callAnthropicAPI(system, user) {
        return new Promise((resolve, reject) => {
            const req = https.request('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const json = JSON.parse(data);
                            resolve(json.content?.[0]?.text || '');
                        } catch (e) {
                            reject(new Error('Failed to parse Anthropic response'));
                        }
                    } else {
                        reject(new Error(`Anthropic API Error ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                system: system,
                messages: [{ role: 'user', content: user }]
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
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== '$val') {
        console.log('  [AI] OpenAI API Key loaded ✓  (Primary Provider)');
    } else if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== '$val') {
        console.log('  [AI] Anthropic (Claude) API Key loaded ✓  (Primary Provider)');
    } else if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== '$val') {
        console.log('  [AI] Groq API Key loaded ✓  (Primary Provider)');
    } else {
        console.log('  [AI] Using Pollinations (Free) for AI features');
    }

    console.log('  Press Ctrl+C to stop');
    console.log('==============================================');
});
