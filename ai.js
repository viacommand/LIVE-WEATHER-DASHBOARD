/* =============================================
   SMART WEATHER AI — AI.JS
   Standalone logic for the AI Assistant & Outfit Planner
   ============================================= */

let isCelsius = localStorage.getItem('isCelsius') === 'true';
let currentCity = localStorage.getItem('lastCity') || 'Delhi';
let chatbotAnimation = null;
let bgAnimation = null;

/* ============================================================
   DYNAMIC LOCAL IMAGE BACKGROUND SLIDESHOW (Every 6 seconds)
   ============================================================ */
(function initBgSlideshow() {
    const images = [
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.27 AM (1).jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.27 AM.jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.30 AM.jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.31 AM (1).jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.31 AM.jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.32 AM (1).jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.32 AM (2).jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.32 AM.jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.33 AM (1).jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.33 AM (2).jpeg",
        "weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.33 AM.jpeg",
        "weather bgdimg/few clouds.jpg",
        "weather bgdimg/sunny weather.jpeg"
    ];

    let currentIndex = 0;
    let useA = true;

    const slideA = document.getElementById('bg-slide-a');
    const slideB = document.getElementById('bg-slide-b');
    if (!slideA || !slideB) return;

    function setSlide(el, imgPath) {
        const encoded = imgPath.split('/').map(encodeURIComponent).join('/');
        el.style.backgroundImage = `url("${encoded}")`;
    }

    function nextImage() {
        const nextIndex = (currentIndex + 1) % images.length;
        const incoming = useA ? slideA : slideB;
        const outgoing = useA ? slideB : slideA;
        setSlide(incoming, images[nextIndex]);
        incoming.classList.add('active');
        outgoing.classList.remove('active');
        currentIndex = nextIndex;
        useA = !useA;
    }

    setSlide(slideA, images[0]);
    slideA.classList.add('active');
    setInterval(nextImage, 6000); // Change every 6 seconds
})();

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
    const bgImage = document.getElementById('bg-image');
    if (bgImage && assets.img) {
        // Local Fallback
        const localUrl = assets.img.includes(' ') ? assets.img.replace(/ /g, '%20') : assets.img;
        bgImage.style.backgroundImage = `url('${localUrl}')`;
        bgImage.classList.add('active');

        // AI Generated Smart Background
        const prompt = `minimalist atmospheric cinematic landscape of ${cityArea} showing ${weatherMain} weather, high resolution, 8k, professional aesthetic, serene lighting`;
        const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1920&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

        const preloader = new Image();
        preloader.onload = () => {
            bgImage.style.transition = 'background-image 2s ease-in-out';
            bgImage.style.backgroundImage = `url('${aiUrl}')`;
        };
        preloader.src = aiUrl;
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
        const [weatherRes, forecastRes] = await Promise.all([
            fetch(`/api/weather?q=${encodeURIComponent(currentCity)}&appid=cdf2f4ac80633035d78cb79b0818fe79`),
            fetch(`/api/forecast?q=${encodeURIComponent(currentCity)}&appid=cdf2f4ac80633035d78cb79b0818fe79`)
        ]);

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
 * Renders the Superstar AI briefing — 3 distinct sections
 */
function renderFormatted(text, mode) {
    const container = document.getElementById('ai-content');

    if (mode === 'practical') {
        // Superstar Mode: parse Advice / Fun / Recommendation sections
        const adviceMatch = text.match(/Advice:\s*([\s\S]*?)(?=Fun:|$)/i);
        const funMatch = text.match(/Fun:\s*([\s\S]*?)(?=Recommendation:|$)/i);
        const recMatch = text.match(/Recommendation:\s*([\s\S]*?)$/i);

        const adviceBullets = adviceMatch
            ? adviceMatch[1].trim().split('\n')
                .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
                .filter(Boolean)
            : [];
        const funLines = funMatch
            ? funMatch[1].trim().split('\n').map(l => l.trim()).filter(Boolean)
            : [];
        const recLine = recMatch ? recMatch[1].trim() : '';

        let html = '<div class="superstar-grid">';

        // Section 1 — Advice
        if (adviceBullets.length) {
            html += `
            <div class="ss-section advice-section">
                <div class="ss-section-header">⚡ Superstar Advice</div>
                <ul class="advice-list">
                    ${adviceBullets.map((b, i) => `
                        <li class="advice-bullet" style="animation-delay:${(i * 0.07).toFixed(2)}s">${b}</li>
                    `).join('')}
                </ul>
            </div>`;
        }

        // Section 2 — Fun
        if (funLines.length) {
            html += `
            <div class="ss-section fun-section">
                <div class="ss-section-header">😄 Fun Zone</div>
                <div class="fun-lines">
                    ${funLines.map(l => `<p class="fun-line">${l}</p>`).join('')}
                </div>
            </div>`;
        }

        // Section 3 — Recommendation
        if (recLine) {
            html += `
            <div class="ss-section rec-section">
                <div class="ss-rec-icon">🚀</div>
                <div class="ss-rec-label">Premium Recommendation</div>
                <div class="ss-rec-text">${recLine}</div>
            </div>`;
        }

        html += '</div>';

        // Inject Superstar styles once
        if (!document.getElementById('superstar-styles')) {
            const style = document.createElement('style');
            style.id = 'superstar-styles';
            style.innerHTML = `
                .superstar-grid { display: flex; flex-direction: column; gap: 16px; width: 100%; }

                .ss-section {
                    border-radius: 20px; padding: 22px;
                    animation: ssSlideIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
                }
                .ss-section-header {
                    font-size: 0.7rem; font-weight: 900; letter-spacing: 0.12em;
                    text-transform: uppercase; margin-bottom: 14px;
                    display: flex; align-items: center; gap: 8px;
                }

                /* Advice Section */
                .advice-section {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .advice-section .ss-section-header { color: #a78bfa; }
                .advice-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
                .advice-bullet {
                    display: flex; align-items: flex-start; gap: 10px;
                    font-size: 0.93rem; color: rgba(255,255,255,0.9); line-height: 1.55;
                    animation: ssSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
                }
                .advice-bullet::before {
                    content: '✦'; color: #a78bfa; font-size: 0.7rem;
                    margin-top: 5px; flex-shrink: 0;
                }

                /* Fun Section */
                .fun-section {
                    background: rgba(250,204,21,0.06);
                    border: 1px solid rgba(250,204,21,0.18);
                    animation-delay: 0.15s;
                }
                .fun-section .ss-section-header { color: #fde68a; }
                .fun-lines { display: flex; flex-direction: column; gap: 8px; }
                .fun-line { margin: 0; font-size: 0.93rem; line-height: 1.6; color: rgba(255,255,255,0.85); }

                /* Recommendation Section */
                .rec-section {
                    background: linear-gradient(135deg, rgba(168,85,247,0.12), rgba(59,130,246,0.1));
                    border: 1px solid rgba(168,85,247,0.25);
                    text-align: center; animation-delay: 0.25s;
                }
                .ss-rec-icon { font-size: 2rem; margin-bottom: 8px; }
                .ss-rec-label {
                    font-size: 0.65rem; font-weight: 900; letter-spacing: 0.15em;
                    text-transform: uppercase; color: #c4b5fd; margin-bottom: 10px;
                }
                .ss-rec-text {
                    font-size: 1.05rem; font-weight: 700;
                    color: #fff; line-height: 1.5;
                }

                @keyframes ssSlideIn {
                    from { opacity: 0; transform: translateY(14px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        container.innerHTML = html;
        return;
    }

    // Non-practical modes: existing card rendering
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
