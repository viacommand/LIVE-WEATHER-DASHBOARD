/* =============================================
   SMART WEATHER AI — AI.JS
   Standalone logic for the AI Assistant & Outfit Planner
   ============================================= */

let isCelsius = localStorage.getItem('isCelsius') === 'true';
let currentCity = localStorage.getItem('lastCity') || 'Delhi';
let chatbotAnimation = null;
let bgAnimation = null;
let currentSlide = 'a';
let bgPlaylist = [];
let bgPlaylistIndex = 0;
let bgPlaylistInterval = null;

function changeWallpaper(url) {
    const nextSlide = currentSlide === 'a' ? 'b' : 'a';
    const activeEl = document.getElementById(`bg-slide-${currentSlide}`);
    const nextEl = document.getElementById(`bg-slide-${nextSlide}`);

    if (nextEl) {
        nextEl.className = 'bg-slide'; // Reset to base state (scale(0.9))
        nextEl.style.backgroundImage = `url('${url}')`;
        
        // Force reflow
        nextEl.getBoundingClientRect();
        
        nextEl.classList.add('active'); // Zoom into center (scale(1.0))
    }
    if (activeEl) {
        activeEl.className = 'bg-slide exit'; // Shrink down (scale(0.9)) and fade out
    }
    currentSlide = nextSlide;
}

// ——— Dynamic Background Logic (Local to AI Page) ———
function updateDynamicBackground(data) {
    if (!data || !window.getBackgroundAssets) return;

    const weatherMain = data.weather[0].main;
    const weatherId = data.weather[0].id;
    const isDay = data.weather[0].icon.includes('d');
    const cityArea = data.name || currentCity;

    // --- Super Background Mood Control ---
    const moodMap = {
        Clear: { glow: 'rgba(255, 215, 0, 0.2)', bg: '#081a3d' }, // Golden Sun
        Clouds: { glow: 'rgba(173, 216, 230, 0.15)', bg: '#1a1c2c' }, // Misty Blue
        Rain: { glow: 'rgba(59, 130, 246, 0.2)', bg: '#0f172a' }, // Deep Rain
        Drizzle: { glow: 'rgba(59, 130, 246, 0.15)', bg: '#0f172a' },
        Thunderstorm: { glow: 'rgba(139, 92, 246, 0.2)', bg: '#1e1b4b' }, // Electric Violet
        Snow: { glow: 'rgba(255, 255, 255, 0.2)', bg: '#111827' }, // Arctic White
        Mist: { glow: 'rgba(209, 213, 219, 0.15)', bg: '#1f2937' },
        Haze: { glow: 'rgba(209, 213, 219, 0.15)', bg: '#1f2937' },
        Fog: { glow: 'rgba(209, 213, 219, 0.15)', bg: '#1f2937' }
    };

    const mood = moodMap[weatherMain] || moodMap.Clear;
    document.documentElement.style.setProperty('--bg-glow', mood.glow);
    document.documentElement.style.setProperty('--bg-secondary', mood.bg);

    const assets = getBackgroundAssets(weatherMain, weatherId, isDay);
    if (assets && assets.img) {
        const localUrl = assets.img.includes(' ') ? assets.img.replace(/ /g, '%20') : assets.img;
        
        // Reset playlist and interval
        if (bgPlaylistInterval) clearInterval(bgPlaylistInterval);
        bgPlaylist = [localUrl];
        bgPlaylistIndex = 0;

        // Render first wallpaper immediately
        changeWallpaper(localUrl);

        // AI Generated Smart Background
        const prompt = `minimalist atmospheric cinematic landscape of ${cityArea} showing ${weatherMain} weather, high resolution, 8k, professional aesthetic, serene lighting`;
        const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1920&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

        const preloader = new Image();
        preloader.onload = () => {
            bgPlaylist.push(aiUrl);
        };
        preloader.src = aiUrl;

        // Start 5-second cycling slideshow
        bgPlaylistInterval = setInterval(() => {
            if (bgPlaylist.length > 0) {
                bgPlaylistIndex = (bgPlaylistIndex + 1) % bgPlaylist.length;
                changeWallpaper(bgPlaylist[bgPlaylistIndex]);
            }
        }, 5000);
    }
}

// Initialize Lottie
function initChatbot() {
    // 1. Loader Chatbot (plays on fetch)
    chatbotAnimation = lottie.loadAnimation({
        container: document.getElementById('lottie-chatbot'),
        renderer: 'svg',
        loop: true,
        autoplay: false,
        path: 'Live chatbot.json'
    });

    // 2. Background Ambient Chatbot (plays always)
    bgAnimation = lottie.loadAnimation({
        container: document.getElementById('lottie-bg'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'Live chatbot.json'
    });
}
let currentMode = 'practical';

document.addEventListener('DOMContentLoaded', () => {
    initChatbot();
    const urlParams = new URLSearchParams(window.location.search);
    initModeControls();
    fetchAIInsight(currentMode);
});

function initModeControls() {
    const btns = document.querySelectorAll('.mode-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            fetchAIInsight(currentMode);
        });
    });
}

async function fetchAIInsight(mode, retryCount = 0) {
    const container = document.getElementById('ai-content');
    const loader = document.getElementById('ai-loading');

    // Show loader
    loader.style.display = 'flex';
    if (chatbotAnimation) chatbotAnimation.play();
    // Clear previous content
    container.innerHTML = '';
    container.appendChild(loader);

    try {
        // 1. Fetch weather context
        const lat = localStorage.getItem('lastLat');
        const lon = localStorage.getItem('lastLon');
        let weatherRes, forecastRes;
        if (lat && lon) {
            [weatherRes, forecastRes] = await Promise.all([
                fetch(`/api/weather?lat=${lat}&lon=${lon}&appid=cdf2f4ac80633035d78cb79b0818fe79`),
                fetch(`/api/forecast?lat=${lat}&lon=${lon}&appid=cdf2f4ac80633035d78cb79b0818fe79`)
            ]);
        } else {
            [weatherRes, forecastRes] = await Promise.all([
                fetch(`/api/weather?q=${encodeURIComponent(currentCity)}&appid=cdf2f4ac80633035d78cb79b0818fe79`),
                fetch(`/api/forecast?q=${encodeURIComponent(currentCity)}&appid=cdf2f4ac80633035d78cb79b0818fe79`)
            ]);
        }

        if (!weatherRes.ok || !forecastRes.ok) throw new Error('Weather data unavailable');

        const weatherData = await weatherRes.json();
        const forecastData = await forecastRes.json();

        // Update Background
        updateDynamicBackground(weatherData);

        // Update Location Badge
        const badge = document.getElementById('ai-location-badge');
        if (badge) badge.textContent = weatherData.name;

        // 2. Call AI
        const aiResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: mode,
                weatherData: {
                    city: currentCity,
                    current: {
                        temp: Math.round(weatherData.main.temp - 273.15),
                        condition: weatherData.weather[0].description
                    },
                    forecast: forecastData.list.slice(0, 8).map(f => ({
                        time: new Date(f.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        temp: Math.round(f.main.temp - 273.15) + "°C",
                        condition: f.weather[0].main
                    }))
                }
            })
        });

        if (!aiResponse.ok) throw new Error(`AI connection failed (${aiResponse.status})`);
        const aiData = await aiResponse.json();

        if (mode === 'outfit') {
            // 4. Parse and Render with robust extraction and repair
            let rawResponse = aiData.response;
            const match = rawResponse.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('No JSON block found');

            let jsonString = match[0];
            try {
                // Try direct parse first
                const parsedData = JSON.parse(jsonString);
                const forecast = parsedData.forecast_24h || parsedData.forecast || [];
                const currentRec = parsedData.current_recommendation || null;
                renderOutfitTimeline(forecast, currentRec);
            } catch (firstErr) {
                console.warn('[AI Page] Fixed JSON issue detected. Repairing...');
                try {
                    // Attempt repair (common AI mistakes like trailing commas)
                    const repaired = repairJson(jsonString);
                    const parsedData = JSON.parse(repaired);
                    const forecast = parsedData.forecast_24h || parsedData.forecast || [];
                    const currentRec = parsedData.current_recommendation || null;
                    renderOutfitTimeline(forecast, currentRec);
                } catch (secondErr) {
                    console.error('[AI Page] Repair failed:', secondErr);
                    throw new Error('AI returned a malformed response that couldn\'t be fixed.');
                }
            }
        } else {
            renderFormatted(aiData.response, mode);
        }

    } catch (err) {
        console.error('[AI Page] Error:', err);

        // Auto-retry once
        if (retryCount < 1) {
            console.log(`[AI Page] Retrying... (${retryCount + 1})`);
            // Wait 1s then retry
            setTimeout(() => {
                fetchAIInsight(mode, retryCount + 1);
            }, 1000);
            return; // Exit and let the retry handle it
        }

        container.innerHTML = `
            <div class="ai-text-response error-card" style="background: rgba(239, 68, 68, 0.15); border: 2px solid #ef4444; border-radius: 24px; padding: 30px; color: #fff; text-align: center;">
                <p style="font-size: 1.2rem; font-weight: 800; margin-bottom: 10px;">Oops! ${err.message}</p>
                <p style="font-size: 0.9rem; opacity:0.8; margin-bottom: 20px;">The AI is having a moment. Please try again.</p>
                <button onclick="location.reload()" class="back-btn" style="display:inline-flex; background:#ef4444; border:none; padding:12px 30px; cursor:pointer;">Try Again</button>
            </div>
        `;
    } finally {
        // Always hide loader — whether success, error, or retry
        loader.style.display = 'none';
        if (chatbotAnimation) chatbotAnimation.stop();
    }
}

/**
 * Renders text responses as beautiful glass cards
 */
function renderFormatted(text, mode) {
    const container = document.getElementById('ai-content');

    // Clean up text
    let cleanText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Split into sections based on headers or paragraphs
    // We look for patterns like <b>Title:</b> or just double newlines
    let html = '<div class="ai-response-grid">';

    if (mode === 'creative') {
        // Creative mode usually lacks strict headers, treating as one rich card
        html += `
            <div class="ai-card glass-panel" style="animation-delay: 0.1s">
                <div class="ai-card-body creative-text">
                    ${cleanText.replace(/\n\n/g, '<br><br>')}
                </div>
            </div>
        `;
    } else {
        // structured modes (Practical, Wellness, Travel)
        // Split by <b>...</b> or newlines
        const parts = cleanText.split(/(?=<b>)/); // Lookahead split

        if (parts.length > 1) {
            parts.forEach((part, index) => {
                if (!part.trim()) return;

                // Extract title vs content
                let title = "Insight";
                let content = part;

                const titleMatch = part.match(/<b>(.*?)<\/b>/);
                if (titleMatch) {
                    title = titleMatch[1].replace(':', '');
                    content = part.replace(titleMatch[0], '').trim();
                }

                // Clean content
                content = content.replace(/^:/, '').trim().replace(/\n/g, '<br>');

                html += `
                    <div class="ai-card glass-panel" style="animation-delay: ${index * 0.15}s">
                        <div class="ai-card-header">
                            <h3>${title}</h3>
                        </div>
                        <div class="ai-card-body">
                            ${content}
                        </div>
                    </div>
                `;
            });
        } else {
            // Fallback for non-split text (like the new simplified Assistant mode)
            html += `
                <div class="ai-card glass-panel" style="animation-delay: 0.1s">
                    <div class="ai-card-body">
                        ${cleanText.replace(/\n\n/g, '<br><br>')}
                    </div>
                </div>
            `;
        }

    }

    html += '</div>';

    // Add specific styles for this render
    const styleId = 'ai-card-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .ai-response-grid { display: flex; flex-direction: column; gap: 20px; width: 100%; }
            .ai-card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 24px; animation: cardSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
            .ai-card-header h3 { color: #5b9cf5; margin: 0 0 12px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
            .ai-card-body { color: rgba(255, 255, 255, 0.9); line-height: 1.6; font-size: 0.95rem; }
            .creative-text { font-family: 'Georgia', serif; font-style: italic; font-size: 1.1rem; color: #e9d5ff; }
            strong { color: #fff; font-weight: 600; }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = html;
}

function renderOutfitTimeline(forecast, currentRec) {
    // If no forecast data, try to show current recommendation as a single entry
    if (!forecast || !Array.isArray(forecast) || forecast.length === 0) {
        if (currentRec) {
            // Build a synthetic single-item forecast from the current recommendation
            forecast = [{
                time: 'Now',
                temp: '—',
                condition: 'Current',
                top: currentRec.top || '—',
                bottom: currentRec.bottom || '—',
                footwear: currentRec.footwear || '—',
                accessory: currentRec.accessory || '—'
            }];
        } else {
            throw new Error('No forecast data received from AI.');
        }
    }

    const container = document.getElementById('ai-content');
    let html = `
        <div class="outfit-modal-container">
            <div class="outfit-modal-header">
                <h2>Next 24 Hours</h2>
            </div>
            <div class="outfit-rows">
    `;

    forecast.forEach((hour, index) => {
        const top = hour.top || hour.layers || '—';
        const bottom = hour.bottom || '—';
        const footwear = hour.footwear || hour.shoes || '—';
        const accessory = hour.accessory || '—';
        const temp = hour.temp || '—';

        html += `
            <div class="outfit-row" style="animation-delay: ${index * 0.15}s">
                <div class="outfit-row-header">
                    <div class="outfit-weather-info">
                        <span class="weather-icon">${getWeatherEmoji(hour.condition)}</span>
                        <span class="outfit-temp">${temp}</span>
                        <span class="outfit-divider">•</span>
                        <span class="outfit-time">${hour.time}</span>
                    </div>
                </div>
                <div class="outfit-grid" style="grid-template-columns: repeat(4, 1fr);">
                    <div class="outfit-item">
                        <span class="outfit-icon">${getOutfitIcon(top)}</span>
                        <span class="outfit-value">${top}</span>
                    </div>
                    <div class="outfit-item">
                        <span class="outfit-icon">${getOutfitIcon(bottom)}</span>
                        <span class="outfit-value">${bottom}</span>
                    </div>
                    <div class="outfit-item">
                        <span class="outfit-icon">${getOutfitIcon(footwear)}</span>
                        <span class="outfit-value">${footwear}</span>
                    </div>
                     <div class="outfit-item">
                        <span class="outfit-icon">${getOutfitIcon(accessory)}</span>
                        <span class="outfit-value">${accessory}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div class="outfit-modal-footer">
                <button onclick="window.location.href='index.html'" class="close-modal-btn">CLOSE</button>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

function getOutfitIcon(item) {
    if (!item) return "👕";
    const text = item.toLowerCase();

    // 1. Specific Accessories/Gear
    if (text.includes("umbrella") || text.includes("raincoat")) return "☂️";
    if (text.includes("sunglass") || text.includes("shade")) return "🕶️";
    if (text.includes("watch")) return "⌚";
    if (text.includes("bag") || text.includes("backpack") || text.includes("purse")) return "🎒";
    if (text.includes("scarf") || text.includes("muffler")) return "🧣";
    if (text.includes("glove") || text.includes("mitten")) return "🧤";
    if (text.includes("hat") || text.includes("cap") || text.includes("beanie") || text.includes("beret")) return "🧢";
    if (text.includes("belt")) return "ベルト";

    // 2. Bodywear (Specific Category vs Generic)
    if (text.includes("dress") || text.includes("skirt") || text.includes("gown") || text.includes("frock") || text.includes("gown")) return "👗";
    if (text.includes("swim") || text.includes("bikini") || text.includes("trunks") || text.includes("speedo")) return "🩱";

    // 3. Layers & Outerwear
    if (text.includes("cardigan") || text.includes("blazer") || text.includes("suit")) return "🧥";
    if (text.includes("hoodie") || text.includes("sweatshirt")) return "🧥";
    if (text.includes("jacket") || text.includes("coat") || text.includes("parka") || text.includes("windbreaker")) return "🧥";
    if (text.includes("sweater") || text.includes("jumper") || text.includes("pullover")) return "🧥";

    // 4. Bottoms
    if (text.includes("short")) return "🩳";
    if (text.includes("jean") || text.includes("pant") || text.includes("trouser") || text.includes("bottom") || text.includes("leggings") || text.includes("thermals") || text.includes("slack") || text.includes("chinos")) return "👖";

    // 5. Footwear & Feet
    if (text.includes("sock") || text.includes("hosiery")) return "🧦";
    if (text.includes("slipper") || text.includes("flip flop") || text.includes("slide") || text.includes("thong")) return "🩴";
    if (text.includes("boot")) return "🥾";
    if (text.includes("heel") || text.includes("pump")) return "👠";
    if (text.includes("sneaker") || text.includes("shoe") || text.includes("footwear") || text.includes("loafers") || text.includes("trainer")) return "👟";

    // 6. Tops / Default
    if (text.includes("none") || text.includes("—")) return "✨";
    if (text.includes("t-shirt") || text.includes("tee")) return "👕";
    if (text.includes("shirt") || text.includes("polo") || text.includes("blouse") || text.includes("top") || text.includes("tank") || text.includes("vest") || text.includes("linen")) return "👕";

    return "👕"; // Final fallback
}

function getWeatherEmoji(condition) {
    if (!condition) return '☀️';
    const c = condition.toLowerCase();
    if (c.includes('cloud')) return '☁️';
    if (c.includes('rain')) return '🌧️';
    if (c.includes('clear')) return '☀️';
    if (c.includes('snow')) return '❄️';
    return '⛅';
}

function repairJson(jsonString) {
    // 1. Remove markdown code blocks if present
    let clean = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. Fix trailing commas (common AI error)
    clean = clean.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    // 3. Attempt to close unclosed braces/brackets if cut off
    // Simple heuristic: count openers and closers
    const openBraces = (clean.match(/{/g) || []).length;
    const closeBraces = (clean.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
        clean += '}'.repeat(openBraces - closeBraces);
    }

    const openBrackets = (clean.match(/\[/g) || []).length;
    const closeBrackets = (clean.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
        clean += ']'.repeat(openBrackets - closeBrackets);
    }

    return clean;
}

/**
 * --- SMART FALLBACK SYSTEM ---
 * Generates valid outfit JSON locally using real forecast data.
 * Used when AI service is offline, slow, or returns malformed data.
 */
function generateLocalOutfitRecommendation(weatherData) {
    if (!weatherData) return null;

    const getAdvice = (temp, cond) => {
        const t = parseInt(temp);
        const c = cond.toLowerCase();
        let top = "T-shirt";
        let bottom = "Jeans";
        let footwear = "Sneakers";
        let accessory = "Sunglasses";

        // Temperature Logic
        if (t < 5) {
            top = "Heavy Coat & Thermal";
            bottom = "Wool Trousers";
            footwear = "Winter Boots";
            accessory = "Scarf & Gloves";
        } else if (t < 15) {
            top = "Jacket & Sweater";
            bottom = "Jeans";
            footwear = "Boots";
            accessory = "Beanie";
        } else if (t < 22) {
            top = "Hoodie or Cardigan";
            bottom = "Chinos";
            footwear = "Sneakers";
            accessory = "Watch";
        } else if (t >= 22) {
            top = "T-shirt or Polo";
            bottom = "Shorts";
            footwear = "Sandals";
            accessory = "Sunglasses";
        }

        // Condition Overrides
        if (c.includes("rain") || c.includes("drizzle")) {
            top = "Raincoat";
            footwear = "Waterproof Boots";
            accessory = "Umbrella";
        } else if (c.includes("snow")) {
            top = "Puffer Jacket";
            footwear = "Snow Boots";
            accessory = "Ear Muffs";
        } else if (c.includes("thunder")) {
            top = "Waterproof Jacket";
        }

        return { top, bottom, footwear, accessory };
    };

    // 1. Current Rec
    const currentAdvice = getAdvice(weatherData.current.temp, weatherData.current.condition);
    
    // 2. Forecast Recs (Map real forecast data)
    let forecastRecs = [];
    if (weatherData.forecast && Array.isArray(weatherData.forecast)) {
        forecastRecs = weatherData.forecast.map(f => {
            const advice = getAdvice(parseFloat(f.temp), f.condition);
            return {
                time: f.time,
                temp: f.temp,
                condition: f.condition,
                top: advice.top,
                bottom: advice.bottom,
                footwear: advice.footwear,
                accessory: advice.accessory
            };
        });
    }

    return {
        current_recommendation: currentAdvice,
        forecast_24h: forecastRecs
    };
}
