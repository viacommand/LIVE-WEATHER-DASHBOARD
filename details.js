/* =============================================
   WEATHER DETAILS PAGE — details.js
   Standalone script: fetches all APIs and
   populates every element on details.html
   ============================================= */

const BASE_URL = '/api';
const ICON_URL = 'https://openweathermap.org/img/wn';
let isCelsius = localStorage.getItem('isCelsius') !== 'false';

// ——— Lottie Animation ———
let weatherLoader = null;
function initLottie() {
    const container = document.getElementById('lottie-container');
    if (container && typeof lottie !== 'undefined') {
        weatherLoader = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'Weather.json'
        });
    }
}
document.addEventListener('DOMContentLoaded', initLottie);

/* ——— Helpers ——— */
const $ = id => document.getElementById(id);
const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

function tempC(k) { return Math.round(k - 273.15); }
function tempF(k) { return Math.round((k - 273.15) * 9 / 5 + 32); }
function displayTemp(k) { return isCelsius ? tempC(k) : tempF(k); }
function unitSym() { return isCelsius ? '°C' : '°F'; }

function formatTime(ts, tzOff) {
    const d = new Date((ts + tzOff) * 1000);
    const h = d.getUTCHours(), m = d.getUTCMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}

function windDir(deg) {
    const d = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return d[Math.round(deg / 22.5) % 16];
}

function estimateUV(clouds, dt, sunrise, sunset) {
    if (dt < sunrise || dt > sunset) return 0;
    const prog = (dt - sunrise) / (sunset - sunrise);
    return Math.round(Math.sin(prog * Math.PI) * ((100 - clouds) / 100) * 11);
}

function getUVLabel(uv) {
    if (uv <= 2) return 'Low';
    if (uv <= 5) return 'Moderate';
    if (uv <= 7) return 'High';
    if (uv <= 10) return 'Very High';
    return 'Extreme';
}

function getUVColor(uv) {
    if (uv < 3) return '#4ade80';
    if (uv <= 7) return '#facc15';
    return '#ef4444';
}

function getMoonIcon(phase) {
    if (phase === 0 || phase === 1) return { icon: '🌑', text: 'New Moon' };
    if (phase < 0.25) return { icon: '🌒', text: 'Waxing Crescent' };
    if (phase === 0.25) return { icon: '🌓', text: 'First Quarter' };
    if (phase < 0.5) return { icon: '🌔', text: 'Waxing Gibbous' };
    if (phase === 0.5) return { icon: '🌕', text: 'Full Moon' };
    if (phase < 0.75) return { icon: '🌖', text: 'Waning Gibbous' };
    if (phase === 0.75) return { icon: '🌗', text: 'Last Quarter' };
    return { icon: '🌘', text: 'Waning Crescent' };
}

function getPrecipInsight(mm) {
    if (mm <= 0) return { text: 'Completely Dry', icon: '☀️', color: '#60a5fa' };
    if (mm < 0.5) return { text: 'Occasional Drizzle', icon: '💧', color: '#93c5fd' };
    if (mm < 2) return { text: 'Light Rain', icon: '🌦️', color: '#60a5fa' };
    if (mm < 10) return { text: 'Steady Rainfall', icon: '🌧️', color: '#3b82f6' };
    if (mm < 30) return { text: 'Heavy Downpour', icon: '⛈️', color: '#2563eb' };
    return { text: 'Extreme Intensity', icon: '🌊', color: '#1d4ed8' };
}

function getPositiveInsight(code, temp) {
    if (code <= 3) {
        if (temp > 25) return 'Beautiful sunny weather! Stay hydrated ☀️😎';
        if (temp > 15) return 'Perfect for a walk in the park! 🌳🚶';
        return 'Crisp and clear! Bundle up 🧥🌞';
    }
    if (code <= 48) return 'A bit foggy. Great for a warm coffee! ☕☁️';
    if (code <= 67 || (code >= 80 && code <= 82)) return 'Rainy day — cozy movie time! 🍿🎬';
    if (code <= 77) return 'Snow day! Hot cocoa season! ☃️☕';
    if (code >= 95) return 'Stormy! Stay safe indoors ⚡🏠';
    return 'Enjoy your day!';
}

function getWMODesc(code) {
    const map = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Icing fog',
        51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
        80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
        95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Thunderstorm + heavy hail'
    };
    return map[code] || 'Mixed weather';
}

function getAQIStatus(aqi) {
    return [
        { text: 'Good', color: '#4ade80' },
        { text: 'Fair', color: '#facc15' },
        { text: 'Moderate', color: '#f97316' },
        { text: 'Poor', color: '#ef4444' },
        { text: 'Very Poor', color: '#7f1d1d' }
    ][aqi - 1] || { text: 'Unknown', color: '#888' };
}

function pollenLevel(val) {
    if (!val || val <= 0) return { label: 'None', cls: 'none', pct: 0, color: '#4ade80' };
    if (val <= 10) return { label: 'Low', cls: 'low', pct: 20, color: '#4ade80' };
    if (val <= 50) return { label: 'Moderate', cls: 'moderate', pct: 50, color: '#facc15' };
    if (val <= 200) return { label: 'High', cls: 'high', pct: 80, color: '#f97316' };
    return { label: 'Extreme', cls: 'extreme', pct: 100, color: '#ef4444' };
}

function setCircularGauge(el, pct, color) {
    if (!el) return;
    const c = 2 * Math.PI * 40; // r=40 → circumference ≈ 251.2
    el.style.strokeDasharray = c;
    el.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, pct)));
    if (color) el.style.stroke = color;
}

/* ——— Sun Arc ——— */
function renderSunArc(sunrise, sunset, now) {
    const total = sunset - sunrise;
    const elapsed = Math.max(0, Math.min(now - sunrise, total));
    const pct = total > 0 ? elapsed / total : 0;

    const arcEl = $('sun-arc-progress');
    const dotEl = $('sun-dot');
    if (arcEl && dotEl) {
        const arcLen = 157;
        arcEl.setAttribute('stroke-dasharray', `${arcLen * pct} ${arcLen}`);
        const t = pct;
        const cx = (1 - t) * (1 - t) * 10 + 2 * (1 - t) * t * 60 + t * t * 110;
        const cy = (1 - t) * (1 - t) * 60 + 2 * (1 - t) * t * (-5) + t * t * 60;
        dotEl.setAttribute('cx', cx);
        dotEl.setAttribute('cy', cy);
    }

    // Day-length arc dot (insights section)
    const posDot = $('sun-position-dot');
    if (posDot) {
        posDot.style.left = `${pct * 100}%`;
        const y = 4 * pct * (1 - pct);
        posDot.style.bottom = `${y * 60}%`;
    }
}

/* ——— Loading UI ——— */
function showLoading() {
    const el = $('loading-overlay');
    if (el) { el.classList.remove('hidden'); return; }
    // Fallback: add a subtle spinner to the page title
    document.title = '⏳ Loading...';
}

function hideLoading() {
    const el = $('loading-overlay');
    if (el) el.classList.add('hidden');
    document.title = 'Weather Details';
}

function showError(msg) {
    const el = $('error-toast');
    const msgEl = $('error-message');
    if (el && msgEl) {
        msgEl.textContent = msg;
        el.classList.remove('hidden');
        el.classList.add('show');
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 400); }, 3500);
    } else {
        console.error('[Details]', msg);
    }
}

/* ——— Render: OWM current weather ——— */
function renderCurrent(w) {
    const tz = w.timezone;

    // City name
    set('city-name-details', w.name);

    // Wind
    const windSpd = Math.round(w.wind.speed * 3.6);
    const windDeg = w.wind.deg || 0;
    const dir = windDir(windDeg);
    const windEl = $('wind-value');
    if (windEl) windEl.innerHTML = `${windSpd} <small style="font-size:0.9rem;opacity:0.7;">km/h</small>`;
    set('wind-dir-label', `💨 Wind — ${dir}`);
    const needle = $('wind-needle');
    if (needle) needle.style.transform = `translateX(-50%) rotate(${windDeg}deg)`;

    // Sunrise / Sunset
    const sunrise = formatTime(w.sys.sunrise, tz);
    const sunset = formatTime(w.sys.sunset, tz);
    set('sunset-value', sunset);
    set('sunrise-time', sunrise);
    set('sunset-time-label', sunset);
    renderSunArc(w.sys.sunrise, w.sys.sunset, w.dt);

    // Day length (insights card)
    const diffMs = (w.sys.sunset - w.sys.sunrise) * 1000;
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    set('day-length-val', `${hrs}h ${mins}m`);
    set('insight-sunrise', sunrise);
    set('insight-sunset', sunset);

    // UV Index
    const uv = estimateUV(w.clouds.all, w.dt, w.sys.sunrise, w.sys.sunset);
    const uvLabel = getUVLabel(uv);
    const uvColor = getUVColor(uv);
    set('uv-value', uvLabel);
    set('uv-number', uv);
    setCircularGauge($('uv-fill'), uv / 11, uvColor);

    // Humidity
    const humidity = w.main.humidity;
    set('humidity-value', `${humidity}%`);
    setCircularGauge($('humidity-fill'), humidity / 100);

    // Pressure
    const pressure = w.main.pressure;
    set('pressure-value', pressure);
    setCircularGauge($('pressure-fill'), (pressure - 950) / 110);

    // RealFeel (feels_like from API)
    const feelsLike = displayTemp(w.main.feels_like);
    set('realfeel-value', `${feelsLike}°`);

    // Precipitation from current weather
    const rain = w.rain ? (w.rain['1h'] || w.rain['3h'] || 0) : 0;
    const snow = w.snow ? (w.snow['1h'] || w.snow['3h'] || 0) : 0;
    const total = rain + snow;
    const insight = getPrecipInsight(total);
    const rainProbEl = $('rain-prob-val');
    if (rainProbEl) rainProbEl.innerHTML = `${total > 0 ? 100 : 0}% <small style="font-size:0.75rem;opacity:0.8;display:block;font-weight:400;">${insight.text}</small>`;
    const rainFill = $('rain-bar-fill');
    if (rainFill) { rainFill.style.width = `${total > 0 ? 100 : 0}%`; rainFill.style.background = insight.color; }
    const rainAmt = $('rain-amt-val');
    if (rainAmt) rainAmt.innerHTML = total > 0 ? `<span>${insight.icon}</span> ${total.toFixed(1)} mm last hour` : '0 mm';

    // Visibility
    set('vis-value', `${(w.visibility / 1000).toFixed(1)} km`);
    set('cloud-value', `Clouds: ${w.clouds.all}%`);
    const cloudBar = $('cloud-bar');
    if (cloudBar) cloudBar.style.width = `${w.clouds.all}%`;

    // Moon phase (approximate from date)
    const LUNAR = 29.530588853;
    const knownNew = new Date('2024-01-11T11:57:00Z');
    const diff = (new Date(w.dt * 1000) - knownNew) / 86400000;
    let phase = (diff % LUNAR) / LUNAR;
    if (phase < 0) phase += 1;
    const moon = getMoonIcon(phase);
    const moonIcon = $('moon-icon');
    if (moonIcon) moonIcon.textContent = moon.icon;
    set('moon-text', moon.text);

    // Insight message
    const insightEl = $('insight-message');
    if (insightEl) {
        insightEl.textContent = 'Thinking about the weather...';
        setTimeout(() => { if (insightEl) insightEl.textContent = `${w.weather[0].description} in ${w.name}. Enjoy your day! 🌤️`; }, 800);
    }

    // Background
    if (typeof getBackgroundAssets === 'function') {
        const assets = getBackgroundAssets(w.weather[0].main, w.weather[0].id, w.weather[0].icon.includes('d'));
        const bgImg = $('bg-image');
        if (bgImg && assets.img) {
            bgImg.style.backgroundImage = `url('${assets.img.replace(/ /g, '%20')}')`;
            bgImg.classList.add('active');
        }
    }
}

/* ——— Render: Forecast (for rain probability) ——— */
function renderForecastData(forecast) {
    // Override rain probability with first forecast slot if available
    const firstSlot = forecast?.list?.[0];
    if (!firstSlot) return;
    const prob = Math.round((firstSlot.pop || 0) * 100);
    const rain = firstSlot.rain ? (firstSlot.rain['3h'] || 0) : 0;
    const snow = firstSlot.snow ? (firstSlot.snow['3h'] || 0) : 0;
    const total = rain + snow;
    const insight = getPrecipInsight(total);

    const rainProbEl = $('rain-prob-val');
    if (rainProbEl) rainProbEl.innerHTML = `${prob}% <small style="font-size:0.75rem;opacity:0.8;display:block;font-weight:400;">${insight.text}</small>`;
    const rainFill = $('rain-bar-fill');
    if (rainFill) {
        rainFill.style.width = `${prob}%`;
        rainFill.style.background = insight.color;
        if (total > 5) rainFill.classList.add('pulse-glow');
        else rainFill.classList.remove('pulse-glow');
    }
    const rainAmt = $('rain-amt-val');
    if (rainAmt) rainAmt.innerHTML = total > 0 ? `<span>${insight.icon}</span> ${total.toFixed(1)} mm expected` : `0 mm expected`;
}

/* ——— Render: Open-Meteo extra data ——— */
function renderExtra(extra) {
    if (!extra || !extra.daily) return;
    const today = 0; // index 0 = today

    // Override UV index with actual Open-Meteo value
    const uvMax = extra.daily.uv_index_max?.[today] ?? null;
    if (uvMax !== null) {
        const uvLabel = getUVLabel(uvMax);
        const uvColor = getUVColor(uvMax);
        set('uv-value', uvLabel);
        set('uv-number', uvMax);
        setCircularGauge($('uv-fill'), uvMax / 11, uvColor);
    }

    // Rain - better data from open-meteo
    const rainProb = extra.daily.precipitation_probability_max?.[today] ?? null;
    const rainAmt = extra.daily.precipitation_sum?.[today] ?? 0;
    const ins = getPrecipInsight(rainAmt);
    if (rainProb !== null) {
        const rainProbEl = $('rain-prob-val');
        if (rainProbEl) rainProbEl.innerHTML = `${rainProb}% <small style="font-size:0.75rem;opacity:0.8;display:block;font-weight:400;">${ins.text}</small>`;
        const fillEl = $('rain-bar-fill');
        if (fillEl) {
            fillEl.style.width = `${rainProb}%`;
            fillEl.style.background = ins.color;
            if (rainAmt > 5) fillEl.classList.add('pulse-glow');
            else fillEl.classList.remove('pulse-glow');
        }
        const amtEl = $('rain-amt-val');
        if (amtEl) amtEl.innerHTML = `<span>${ins.icon}</span> ${rainAmt} mm expected today`;
    }

    // Sunrise/Sunset from open-meteo (more accurate)
    if (extra.daily.sunrise?.[today]) {
        const srRaw = extra.daily.sunrise[today]; // "2025-02-20T06:15"
        const ssRaw = extra.daily.sunset?.[today];
        const srTime = srRaw.split('T')[1]?.slice(0, 5) || '--:--';
        const ssTime = ssRaw?.split('T')[1]?.slice(0, 5) || '--:--';
        // Convert to 12-hour format
        const to12 = t => {
            const [h, m] = t.split(':').map(Number);
            return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
        };
        const sr12 = to12(srTime), ss12 = to12(ssTime);
        set('insight-sunrise', sr12);
        set('insight-sunset', ss12);
        set('sunrise-time', sr12);
        set('sunset-time-label', ss12);
        set('sunset-value', ss12);

        // Day length
        const srDate = new Date(srRaw), ssDate = new Date(ssRaw);
        const diffMs = ssDate - srDate;
        const h = Math.floor(diffMs / 3600000), m = Math.floor((diffMs % 3600000) / 60000);
        set('day-length-val', `${h}h ${m}m`);
    }

    // Moon phase from open-meteo
    const moonPhase = extra.daily.moon_phase?.[today];
    if (moonPhase !== undefined) {
        const moon = getMoonIcon(moonPhase);
        const moonIcon = $('moon-icon');
        if (moonIcon) moonIcon.textContent = moon.icon;
        set('moon-text', moon.text);
    }

    // Visibility & Cloud cover (current hour)
    const hr = new Date().getHours();
    const vis = extra.hourly?.visibility?.[hr];
    if (vis !== undefined) set('vis-value', `${(vis / 1000).toFixed(1)} km`);
    const cc = extra.hourly?.cloudcover?.[hr];
    if (cc !== undefined) {
        set('cloud-value', `Clouds: ${cc}%`);
        const cloudBar = $('cloud-bar');
        if (cloudBar) cloudBar.style.width = `${cc}%`;
    }

    // Positive insight from weather code
    const code = extra.daily.weathercode?.[today] ?? 0;
    const maxT = extra.daily.temperature_2m_max?.[today] ?? 20;
    const insightEl = $('insight-message');
    if (insightEl) insightEl.textContent = getPositiveInsight(code, maxT);
}

/* ——— Render: OWM Air Quality ——— */
function renderAirQuality(data) {
    if (!data?.list?.[0]) return;
    const p = data.list[0];
    const aqi = p.main.aqi;
    const status = getAQIStatus(aqi);
    set('aqi-value', status.text);
    const pm25 = Math.round(p.components.pm2_5);
    set('aqi-text', `PM2.5: ${pm25} µg/m³`);
    const fill = $('aqi-fill');
    if (fill) {
        const arcLen = 125.6; // Half-circle arc for the SVG path used
        fill.style.stroke = status.color;
        fill.style.strokeDasharray = `${arcLen * (aqi / 5)} ${arcLen}`;
    }
}

/* ——— Render: Open-Meteo Pollen ——— */
function renderPollen(aqiData) {
    const pollenEl = $('pollen-list');
    if (!pollenEl || !aqiData?.hourly) return;
    const hr = new Date().getHours();
    const h = aqiData.hourly;

    const types = [
        { name: 'Grass', val: h.grass_pollen?.[hr] },
        { name: 'Birch', val: h.birch_pollen?.[hr] },
        { name: 'Alder', val: h.alder_pollen?.[hr] },
        { name: 'Olive', val: h.olive_pollen?.[hr] },
        { name: 'Ragweed', val: h.ragweed_pollen?.[hr] },
    ].filter(p => p.val !== undefined && p.val !== null);

    if (types.length === 0) { pollenEl.textContent = 'No data'; return; }

    pollenEl.innerHTML = types.map(p => {
        const lvl = pollenLevel(p.val);
        return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="opacity:0.85;">${p.name}</span>
            <span style="display:flex;align-items:center;gap:6px;">
                <span style="width:50px;height:5px;border-radius:3px;background:rgba(255,255,255,0.1);display:inline-block;overflow:hidden;">
                    <span style="display:block;height:100%;width:${lvl.pct}%;background:${lvl.color};border-radius:3px;"></span>
                </span>
                <span style="font-size:0.75rem;color:${lvl.color};font-weight:600;">${lvl.label}</span>
            </span>
        </div>`;
    }).join('');
}

/* ——— Animate gauges in ——— */
function animateIn() {
    const cards = document.querySelectorAll('.detail-card, .env-card, .daily-insights-card');
    cards.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(16px)';
        el.style.transition = `opacity 0.4s ease ${i * 60}ms, transform 0.4s ease ${i * 60}ms`;
        setTimeout(() => { el.style.opacity = ''; el.style.transform = ''; }, 50 + i * 60);
    });
}

/* ——— Main fetch ——— */
async function loadDetailsPage() {
    const city = localStorage.getItem('lastCity') || 'Delhi';
    showLoading();

    try {
        // Step 1: Current weather
        const wRes = await fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${config.OWM_KEY}`);
        if (!wRes.ok) throw new Error(`Weather API ${wRes.status}`);
        const w = await wRes.json();
        if (w.error) throw new Error(w.error);

        const { lat, lon } = w.coord;
        renderCurrent(w);

        // Step 2: Parallel fetches
        const [fRes, extraRes, aqiOWMRes, aqiMeteoRes] = await Promise.allSettled([
            fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${config.OWM_KEY}`),
            fetch(`${BASE_URL}/extra?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,moon_phase,uv_index_max,temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,precipitation_probability_max&hourly=visibility,cloudcover&forecast_days=3&timezone=auto`),
            fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${config.OWM_KEY}`),
            fetch(`${BASE_URL}/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,grass_pollen,birch_pollen,alder_pollen,olive_pollen,ragweed_pollen&timezone=auto&forecast_days=3`)
        ]);

        if (fRes.status === 'fulfilled' && fRes.value.ok) {
            const forecast = await fRes.value.json();
            renderForecastData(forecast);
        }
        if (extraRes.status === 'fulfilled' && extraRes.value.ok) {
            const extra = await extraRes.value.json();
            renderExtra(extra);
        }
        if (aqiOWMRes.status === 'fulfilled' && aqiOWMRes.value.ok) {
            const aqiData = await aqiOWMRes.value.json();
            renderAirQuality(aqiData);
        }
        if (aqiMeteoRes.status === 'fulfilled' && aqiMeteoRes.value.ok) {
            const aqiMeteo = await aqiMeteoRes.value.json();
            renderPollen(aqiMeteo);
        }

        animateIn();
    } catch (err) {
        console.error('[Details] Error:', err);
        showError(err.message || 'Failed to load weather details');
    } finally {
        hideLoading();
    }
}

/* ——— Config: pick up API key from app.js global or inline ——— */
// We read the API key from the same source as app.js
const config = { OWM_KEY: 'cdf2f4ac80633035d78cb79b0818fe79' };

/* ——— Boot ——— */
document.addEventListener('DOMContentLoaded', loadDetailsPage);
