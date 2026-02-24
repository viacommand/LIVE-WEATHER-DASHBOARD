/* =============================================
   LIVE WEATHER DASHBOARD — APP.JS
   Full weather logic, API integration, UI rendering
   ============================================= */

// ——— Configuration ———
const API_KEY = 'cdf2f4ac80633035d78cb79b0818fe79'; // OpenWeatherMap API key
// Use local proxy to avoid browser network restrictions
const BASE_URL = '/api';
const ICON_URL = 'https://openweathermap.org/img/wn';

// ——— State ———
let isCelsius = true;
let currentWeatherData = null;
let forecastData = null;
let currentCity = '';
let debounceTimer = null;
let weatherMap = null;
let weatherTileLayer = null;
let currentMapLayer = 'temp_new'; // Default: Temperature (free-tier OWM layer code)
let particleOverlay = null; // Will hold the particle system instance

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

// ——— Popular cities (matching reference screenshots) ———
const POPULAR_CITIES = [
    'Bengaluru', 'Dispur', 'Kolkata',
    'Lucknow', 'Chennai', 'Jaipur',
    'Ludhiana', 'Pune', 'Mumbai',
    'Bhopal', 'Guwahati', 'Ranchi',
    'Faridabad', 'Surat', 'Delhi',
    'Chandigarh', 'Patna', 'New Delhi',
    'Raipur'
];

// ——— Dynamic Background Logic ———
// ——— Dynamic Background Logic ———
function updateDynamicBackground(data) {
    if (!data) return;

    const weatherMain = data.weather[0].main;
    const weatherId = data.weather[0].id;
    const isDay = data.weather[0].icon.includes('d');
    const city = data.name || 'City';

    // Use key from backgrounds.js
    const assets = getBackgroundAssets(weatherMain, weatherId, isDay);

    const bgImage = document.getElementById('bg-image');
    const bgVideo = document.getElementById('bg-video');

    if (bgImage && assets.img) {
        // 1. Set Local Fallback First (Immediate)
        const localUrl = assets.img.includes(' ') ? assets.img.replace(/ /g, '%20') : assets.img;
        bgImage.style.backgroundImage = `url('${localUrl}')`;
        bgImage.classList.add('active');

        // 2. Fetch AI-Generated Background (Smart Update)
        const prompt = `atmospheric cinematic photography of ${city} with ${weatherMain} weather conditions, high resolution, 8k, professional lighting, urban landscape view`;
        const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1920&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

        const preloader = new Image();
        preloader.onload = () => {
            bgImage.style.transition = 'background-image 1.5s ease-in-out';
            bgImage.style.backgroundImage = `url('${aiUrl}')`;
            console.log(`[Smart BG] AI Background loaded for ${city}`);
        };
        preloader.src = aiUrl;
    }

    if (bgVideo && assets.video) {
        // Check if video exists/loads
        bgVideo.src = assets.video;
        bgVideo.oncanplay = () => {
            bgVideo.classList.add('active');
            bgImage.classList.remove('active'); // Fade out image when video ready
            bgVideo.play().catch(e => console.log('Autoplay prevented', e));
        };
        bgVideo.onerror = () => {
            console.log('Video not found, keeping image');
            bgVideo.classList.remove('active');
            bgImage.classList.add('active');
        };
    } else if (bgVideo) {
        bgVideo.classList.remove('active');
    }
}

// ——— DOM Elements (initialized in init()) ———
const $ = (id) => document.getElementById(id);
let DOM = {};

// ——— Utilities ———
function showLoading() {
    DOM.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    DOM.loadingOverlay.classList.add('hidden');
}

function showError(message) {
    DOM.errorMessage.textContent = message;
    DOM.errorToast.classList.remove('hidden');
    DOM.errorToast.classList.add('show');
    setTimeout(() => {
        DOM.errorToast.classList.remove('show');
        setTimeout(() => DOM.errorToast.classList.add('hidden'), 400);
    }, 3500);
}

function openSearch() {
    DOM.searchOverlay.classList.remove('hidden');
    DOM.searchInput.value = '';
    DOM.searchResults.classList.add('hidden');
    DOM.popularSection.style.display = '';
    setTimeout(() => DOM.searchInput.focus(), 350);
}

function closeSearch() {
    DOM.searchOverlay.classList.add('hidden');
    DOM.searchInput.blur();
}

function formatTime(timestamp, timezoneOffset) {
    const date = new Date((timestamp + timezoneOffset) * 1000);
    const utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
        date.getUTCHours(), date.getUTCMinutes());
    let hours = utc.getHours();
    let minutes = utc.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatHour(timestamp, timezoneOffset) {
    const date = new Date((timestamp + timezoneOffset) * 1000);
    const utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
        date.getUTCHours(), date.getUTCMinutes());
    let hours = utc.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours} ${ampm}`;
}

function tempC(kelvin) {
    return Math.round(kelvin - 273.15);
}

function tempF(kelvin) {
    return Math.round((kelvin - 273.15) * 9 / 5 + 32);
}

function displayTemp(kelvin) {
    return isCelsius ? tempC(kelvin) : tempF(kelvin);
}

function unitSymbol() {
    return isCelsius ? '°C' : '°F';
}

function windDirection(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
}

function getWeatherIconUrl(iconCode) {
    return `${ICON_URL}/${iconCode}@2x.png`;
}

function estimateUV(clouds, dt, sunrise, sunset) {
    if (dt < sunrise || dt > sunset) return 0;
    const dayProgress = (dt - sunrise) / (sunset - sunrise);
    const solarNoon = Math.sin(dayProgress * Math.PI);
    const clearSky = (100 - clouds) / 100;
    return Math.round(solarNoon * clearSky * 11);
}

function getUVLabel(uv) {
    if (uv <= 2) return 'Low';
    if (uv <= 5) return 'Moderate';
    if (uv <= 7) return 'High';
    if (uv <= 10) return 'Very High';
    return 'Extreme';
}

function getPrecipitationInsight(mm) {
    if (mm <= 0) return { text: "Completely Dry", icon: "☀️", color: "#60a5fa" };
    if (mm < 0.5) return { text: "Occasional Drizzle", icon: "💧", color: "#93c5fd" };
    if (mm < 2) return { text: "Light Rain", icon: "🌦️", color: "#60a5fa" };
    if (mm < 10) return { text: "Steady Rainfall", icon: "🌧️", color: "#3b82f6" };
    if (mm < 30) return { text: "Heavy Downpour", icon: "⛈️", color: "#2563eb" };
    return { text: "Extreme Intensity", icon: "🌊", color: "#1d4ed8" };
}

// ——— API Calls ———

async function fetchWeather(city) {
    showLoading();
    try {
        console.log('[Weather] Fetching weather for:', city);

        // Step 1: Get weather directly by city name via local proxy
        const weatherUrl = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}`;
        console.log('[Weather] URL:', weatherUrl);

        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
            if (weatherRes.status === 404) {
                showError(`City "${city}" not found. Try another name.`);
                hideLoading();
                return;
            }
            throw new Error(`Weather API error: ${weatherRes.status}`);
        }
        const weatherData = await weatherRes.json();

        if (weatherData.error) throw new Error(weatherData.error);
        console.log('[Weather] Got weather data:', weatherData.name);

        const { lat, lon } = weatherData.coord;
        currentCity = weatherData.name;
        currentWeatherData = weatherData;

        // Fetch Environmental Data (Phase 1)
        fetchEnvironmentalData(lat, lon);

        // Step 2: Get forecast via local proxy
        const forecastUrl = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
        const forecastRes = await fetch(forecastUrl);
        if (!forecastRes.ok) throw new Error(`Forecast API error: ${forecastRes.status}`);
        forecastData = await forecastRes.json();
        console.log('[Weather] Got forecast data');

        // Save to localStorage
        localStorage.setItem('lastCity', city);
        localStorage.setItem('isCelsius', isCelsius);

        // Render everything
        renderAll();
        closeSearch();

        // Fetch Air Pollution Data (Phase 1)
        fetchAirPollution(lat, lon);

        // Fetch outfit
        fetchDashboardOutfit();
    } catch (err) {
        console.error('[Weather] Error:', err);
        showError(err.message || 'Failed to fetch weather data.');
        // ... existing code ...
    } finally {
        hideLoading();
    }
}

async function fetchWeatherByCoords(lat, lon) {
    showLoading();
    try {
        console.log('[Weather] Fetching weather for coords:', lat, lon);

        // Step 1: Get weather by coords via local proxy
        const weatherUrl = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
        const weatherData = await weatherRes.json();

        if (weatherData.error) throw new Error(weatherData.error);
        console.log('[Weather] Got weather data for coords:', weatherData.name);

        currentCity = weatherData.name;
        currentWeatherData = weatherData;

        // Fetch Environmental Data (Phase 1)
        fetchEnvironmentalData(lat, lon);

        // Step 2: Get forecast via local proxy
        const forecastUrl = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
        const forecastRes = await fetch(forecastUrl);
        if (!forecastRes.ok) throw new Error(`Forecast API error: ${forecastRes.status}`);
        forecastData = await forecastRes.json();
        console.log('[Weather] Got forecast data');

        // Save to localStorage
        localStorage.setItem('lastCity', currentCity);
        localStorage.setItem('isCelsius', isCelsius);

        // Render everything
        renderAll();
        closeSearch();

        // Fetch Air Pollution Data
        fetchAirPollution(lat, lon);
    } catch (err) {
        console.error('[Weather] Error:', err);
        showError(err.message || 'Failed to fetch weather data.');
    } finally {
        hideLoading();
    }
}

function handleCurrentLocation() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    showLoading();
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeatherByCoords(latitude, longitude);
        },
        (error) => {
            hideLoading();
            let msg = "Location access denied.";
            if (error.code === error.POSITION_UNAVAILABLE) msg = "Location unavailable.";
            if (error.code === error.TIMEOUT) msg = "Location request timed out.";
            showError(msg);
        }
    );
}

async function searchCities(query) {
    if (!query || query.length < 2) {
        DOM.searchResults.classList.add('hidden');
        DOM.popularSection.style.display = '';
        return;
    }
    try {
        const res = await fetch(`${BASE_URL}/geo?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`);
        const data = await res.json();

        if (data.length === 0) {
            DOM.searchResults.innerHTML = '<p style="padding:14px 12px;color:var(--text-muted);font-size:0.9rem;">No cities found</p>';
        } else {
            DOM.searchResults.innerHTML = data.map(loc => `
                <div class="search-result-item" data-city="${loc.name}" data-lat="${loc.lat}" data-lon="${loc.lon}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>${loc.name}${loc.state ? ', ' + loc.state : ''}, ${loc.country}</span>
                </div>
            `).join('');

            // Attach click events
            DOM.searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    fetchWeather(item.dataset.city);
                });
            });
        }

        DOM.searchResults.classList.remove('hidden');
        DOM.popularSection.style.display = 'none';
    } catch (err) {
        console.error(err);
    }
}

// ——— Rendering ———
function renderAll() {
    if (!currentWeatherData || !forecastData) return;
    renderHero();
    renderForecast();
    renderHourly();

    // Reset gauge fills to zero before animating
    resetGauges();

    // Stagger card entrance animations
    animateCardsIn();

    // Animate gauges after a delay so cards are visible first
    setTimeout(() => renderDetails(), 400);

    // Update the weather map
    renderMap();

    // Render Teddy
    renderTeddy();

    // Update Theme based on temperature
    updateTheme(currentWeatherData.main.temp);

    // Update Particles
    updateParticles();
}

// ——— Dynamic Theme ———
function updateTheme(kelvin) {
    const celsius = tempC(kelvin);
    let theme = 'cold'; // Default

    if (celsius < 0) {
        theme = 'freezing';
    } else if (celsius >= 0 && celsius < 15) {
        theme = 'cold';
    } else if (celsius >= 15 && celsius < 25) {
        theme = 'mild';
    } else if (celsius >= 25 && celsius < 35) {
        theme = 'warm';
    } else {
        theme = 'hot';
    }

    document.body.setAttribute('data-theme', theme);

    // Update map marker color to match theme accent? 
    // Ideally we can read the CSS variable but for simplicity let's rely on CSS to handle UI colors.
    // The map marker is hardcoded in JS, so let's update it if we want full consistency.
    // For now, the CSS variable --accent handles most UI elements.
}

// ——— Weather Teddy ———
function renderTeddy() {
    if (!currentWeatherData) return;
    const { weather } = currentWeatherData;
    const id = weather[0].id;
    const isDay = currentWeatherData.weather[0].icon.includes('d');

    const container = $('teddy-container');
    let content = '';
    let animationClass = '';

    // Logic: Map ID to Teddy State
    // 2xx: Thunderstorm
    // 3xx: Drizzle
    // 5xx: Rain
    // 6xx: Snow
    // 7xx: Atmosphere (Mist, Smoke, Haze, Dust, Fog, Sand, Ash, Squall, Tornado)
    // 800: Clear
    // 80x: Clouds

    if (id >= 200 && id < 300) {
        // Stormy
        content = '<span style="font-size: 1.2em;">⚡</span>🐻<span style="font-size: 1.2em;">⛈️</span>';
        animationClass = 'teddy-puffed';
    } else if (id >= 300 && id < 600) {
        // Rain/Drizzle
        content = '🐻☔';
        animationClass = 'teddy-shivering';
    } else if (id >= 600 && id < 700) {
        // Snow
        content = '🐻❄️';
        animationClass = 'teddy-shivering';
    } else if (id >= 700 && id < 800) {
        // Atmosphere (Fog/Mist)
        content = '🐻🌫️';
        animationClass = 'teddy-peeking';
    } else if (id === 800) {
        // Clear
        if (isDay) {
            content = '🐻🕶️👒'; // Sunny
            animationClass = 'teddy-floating';
        } else {
            content = '🐻✨🌙'; // Clear Night
            animationClass = 'teddy-floating';
        }
    } else if (id > 800) {
        // Clouds
        content = '🐻☁️';
        animationClass = 'teddy-peeking';
    }

    container.innerHTML = `<div class="${animationClass}">${content}</div>`;
}

// ——— Weather Map ———
function renderMap() {
    if (!currentWeatherData) return;

    const { lat, lon } = currentWeatherData.coord;

    // Define tile URL for free-tier OWM map overlay
    // Free-tier layer codes: temp_new, precipitation_new, wind_new, clouds_new
    const TILE_URL = `${BASE_URL}/map/${currentMapLayer}/{z}/{x}/{y}?appid=${API_KEY}`;

    // Logic to show/hide legend & apply grayscale
    const legend = document.querySelector('.map-legend');
    const mapContainer = document.getElementById('weather-map');

    if (currentMapLayer === 'temp_new') { // Temperature
        if (legend) legend.classList.remove('hidden');
        if (mapContainer) mapContainer.classList.remove('grayscale-map');
    } else if (currentMapLayer === 'clouds_new') { // Clouds
        if (legend) legend.classList.add('hidden');
        if (mapContainer) mapContainer.classList.add('grayscale-map');
    } else { // Others
        if (legend) legend.classList.add('hidden');
        if (mapContainer) mapContainer.classList.remove('grayscale-map');
    }

    if (!weatherMap) {
        // Initialize map
        weatherMap = L.map('weather-map', {
            center: [lat, lon],
            zoom: 7,
            zoomControl: true,
            attributionControl: false
        });

        // Dark base tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OSM &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(weatherMap);

        // Overlay
        weatherTileLayer = L.tileLayer(TILE_URL, { maxZoom: 19, opacity: 0.8 }).addTo(weatherMap);

        // Marker with Pulsing Effect
        const pulseIcon = L.divIcon({
            className: 'pulsing-marker',
            html: '<div class="dot-core"></div><div class="dot-ring"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        L.marker([lat, lon], { icon: pulseIcon }).addTo(weatherMap).bindPopup(`<b>${currentCity}</b>`);

        setTimeout(() => weatherMap.invalidateSize(), 500);
    } else {
        // Update existing map
        weatherMap.setView([lat, lon], 7);

        if (weatherTileLayer) weatherMap.removeLayer(weatherTileLayer);
        weatherTileLayer = L.tileLayer(TILE_URL, { maxZoom: 19, opacity: 0.8 }).addTo(weatherMap);

        // Remove old markers
        weatherMap.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                weatherMap.removeLayer(layer);
            }
        });

        const pulseIcon = L.divIcon({
            className: 'pulsing-marker',
            html: '<div class="dot-core"></div><div class="dot-ring"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        L.marker([lat, lon], { icon: pulseIcon }).addTo(weatherMap).bindPopup(`<b>${currentCity}</b>`);

        setTimeout(() => weatherMap.invalidateSize(), 300);
    }
}

function resetGauges() {
    const gauges = [DOM.uvFill, DOM.humidityFill, DOM.realfeelFill, DOM.pressureFill];
    gauges.forEach(g => {
        if (g) g.setAttribute('stroke-dasharray', '0 251.2');
    });
    if (DOM.windNeedle) DOM.windNeedle.style.transform = 'translateX(-50%) rotate(0deg)';
    if (DOM.sunArcProgress) DOM.sunArcProgress.setAttribute('stroke-dasharray', '0 200');
    if (DOM.sunDot) {
        DOM.sunDot.setAttribute('cx', 10);
        DOM.sunDot.setAttribute('cy', 60);
    }
}

function animateCardsIn() {
    const cards = [
        { el: document.getElementById('forecast-card'), delay: 100 },
        { el: document.getElementById('hourly-card'), delay: 200 },
        { el: document.getElementById('uv-card'), delay: 300 },
        { el: document.getElementById('humidity-card'), delay: 350 },
        { el: document.getElementById('realfeel-card'), delay: 400 },
        { el: document.getElementById('wind-card'), delay: 450 },
        { el: document.getElementById('sunset-card'), delay: 500 },
        { el: document.getElementById('pressure-card'), delay: 550 },
    ];

    cards.forEach(({ el, delay }) => {
        if (!el) return;
        el.classList.remove('animate-in');
        el.style.opacity = '0';
        setTimeout(() => {
            el.style.opacity = '';
            el.classList.add('animate-in');
            el.style.animationDelay = `0ms`;
        }, delay);
    });
}

function renderHero() {
    const w = currentWeatherData;
    if (DOM.cityName) DOM.cityName.textContent = currentCity;
    if (DOM.cityNameDetails) DOM.cityNameDetails.textContent = currentCity;
    if (DOM.heroIcon) {
        DOM.heroIcon.src = getWeatherIconUrl(w.weather[0].icon);
        DOM.heroIcon.alt = w.weather[0].description;
    }
    DOM.heroTemp.textContent = displayTemp(w.main.temp);
    DOM.heroUnit.textContent = unitSymbol();
    DOM.heroCondition.textContent = w.weather[0].description;

    // Get today's high/low from forecast
    const todayForecasts = forecastData.list.filter(item => {
        const d = new Date(item.dt * 1000);
        const now = new Date();
        return d.getDate() === now.getDate();
    });

    let high = w.main.temp_max;
    let low = w.main.temp_min;
    todayForecasts.forEach(f => {
        if (f.main.temp_max > high) high = f.main.temp_max;
        if (f.main.temp_min < low) low = f.main.temp_min;
    });

    DOM.heroHighLow.textContent = `H: ${displayTemp(high)}°   L: ${displayTemp(low)}°`;
}

function renderForecast() {
    const dailyMap = {};

    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const key = date.toISOString().split('T')[0];
        if (!dailyMap[key]) {
            dailyMap[key] = {
                temps: [],
                icons: [],
                descriptions: []
            };
        }
        dailyMap[key].temps.push(item.main.temp_min, item.main.temp_max);
        dailyMap[key].icons.push(item.weather[0].icon);
        dailyMap[key].descriptions.push(item.weather[0].description);
    });

    const days = Object.keys(dailyMap).slice(0, 5);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().toISOString().split('T')[0];

    // Calculate global range for bars
    let globalMin = Infinity, globalMax = -Infinity;
    days.forEach(d => {
        const temps = dailyMap[d].temps;
        const min = Math.min(...temps);
        const max = Math.max(...temps);
        if (min < globalMin) globalMin = min;
        if (max > globalMax) globalMax = max;
    });
    const range = globalMax - globalMin || 1;

    DOM.forecastList.innerHTML = days.map(dayKey => {
        const d = dailyMap[dayKey];
        const min = Math.min(...d.temps);
        const max = Math.max(...d.temps);
        const date = new Date(dayKey + 'T12:00:00');
        const dayLabel = dayKey === today ? 'Today' :
            (new Date(date.getTime() + 86400000).toISOString().split('T')[0] === new Date().toISOString().split('T')[0] ? 'Yesterday' : dayNames[date.getDay()]);

        // Day after today
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowKey = tomorrow.toISOString().split('T')[0];
        const label = dayKey === today ? 'Today' : dayKey === tomorrowKey ? 'Tomorrow' : dayNames[date.getDay()];

        // Pick midday icon
        const middayIdx = Math.floor(d.icons.length / 2);
        const icon = d.icons[middayIdx] || d.icons[0];

        // Bar positioning
        const leftPct = ((min - globalMin) / range) * 100;
        const widthPct = ((max - min) / range) * 100;

        // Bar color class
        const avgC = tempC((min + max) / 2);
        let barClass = 'bar-cool';
        if (avgC > 35) barClass = 'bar-hot';
        else if (avgC > 25) barClass = 'bar-warm';
        else if (avgC > 15) barClass = 'bar-mild';

        return `
            <div class="forecast-row">
                <span class="forecast-day">${label}</span>
                <img class="forecast-icon" src="${getWeatherIconUrl(icon)}" alt="weather">
                <span class="forecast-temp-min">${displayTemp(min)}°</span>
                <div class="forecast-bar-wrapper">
                    <div class="forecast-bar ${barClass}" data-left="${leftPct}" data-width="${Math.max(widthPct, 8)}" style="left:${leftPct}%;width:0%"></div>
                </div>
                <span class="forecast-temp-max">${displayTemp(max)}°</span>
            </div>`;
    }).join('');

    // Animate bars in with stagger
    setTimeout(() => {
        document.querySelectorAll('.forecast-bar').forEach((bar, i) => {
            setTimeout(() => {
                bar.style.width = bar.dataset.width + '%';
            }, i * 100);
        });
    }, 200);
}

function renderHourly() {
    // Use first 8 items (24 hours at 3-hour intervals)
    const items = forecastData.list.slice(0, 8);
    const tz = currentWeatherData.timezone;

    DOM.hourlyScroll.innerHTML = items.map((item, i) => {
        const timeLabel = i === 0 ? 'Now' : formatHour(item.dt, tz);
        const isNow = i === 0;
        const windSpd = Math.round(item.wind.speed * 3.6); // m/s to km/h
        const delay = i * 60; // stagger each item
        return `
            <div class="hourly-item ${isNow ? 'now-item' : ''} animate-in" style="animation-delay:${delay}ms">
                <span class="hourly-temp">${displayTemp(item.main.temp)}°</span>
                <img class="hourly-icon" src="${getWeatherIconUrl(item.weather[0].icon)}" alt="weather">
                <span class="hourly-wind">${windSpd}km/h</span>
                <span class="hourly-time">${timeLabel}</span>
            </div>`;
    }).join('');
}

function renderDetails() {
    const w = currentWeatherData;
    const tz = w.timezone;

    // UV Index (estimated if not in One Call)
    const uv = estimateUV(w.clouds.all, w.dt, w.sys.sunrise, w.sys.sunset);
    const uvLabel = getUVLabel(uv);
    if (DOM.uvValue) DOM.uvValue.textContent = uvLabel;
    if (DOM.uvNumber) DOM.uvNumber.textContent = uv;
    const uvPct = Math.min(uv / 11, 1);
    if (DOM.uvFill) {
        setCircularGauge(DOM.uvFill, uvPct);
        // Dynamic Coloring: Green (<3) to Yellow (3-7) to Red (>8)
        if (uv < 3) DOM.uvFill.style.stroke = '#4ade80';
        else if (uv <= 7) DOM.uvFill.style.stroke = '#facc15';
        else DOM.uvFill.style.stroke = '#ef4444';
    }

    // Humidity
    const humidity = w.main.humidity;
    if (DOM.humidityValue) DOM.humidityValue.textContent = humidity + '%';
    if (DOM.humidityFill) setCircularGauge(DOM.humidityFill, humidity / 100);

    // Real Feel
    const feelsLike = w.main.feels_like;
    if (DOM.realfeelValue) DOM.realfeelValue.textContent = displayTemp(feelsLike) + '°';
    // Normalize feels like gauge between -10C and 50C
    const feelsC = tempC(feelsLike);
    const feelsPct = Math.max(0, Math.min(1, (feelsC + 10) / 60));
    if (DOM.realfeelFill) setCircularGauge(DOM.realfeelFill, feelsPct);

    // Wind
    const windSpd = Math.round(w.wind.speed * 3.6); // m/s to km/h  
    const windDeg = w.wind.deg || 0;
    const dir = windDirection(windDeg);
    if (DOM.windDirLabel) DOM.windDirLabel.textContent = dir;
    if (DOM.windValue) DOM.windValue.textContent = windSpd + ' km/h';
    if (DOM.windSpeedLabel) DOM.windSpeedLabel.textContent = windSpd;
    if (DOM.windNeedle) DOM.windNeedle.style.transform = `translateX(-50%) rotate(${windDeg}deg)`;

    // Sunset & Sunrise
    const sunrise = formatTime(w.sys.sunrise, tz);
    const sunset = formatTime(w.sys.sunset, tz);
    if (DOM.sunsetValue) DOM.sunsetValue.textContent = sunset.replace(' ', '');
    if (DOM.sunriseTime) DOM.sunriseTime.textContent = sunrise.replace(' ', '');
    if (DOM.sunsetTimeLabel) DOM.sunsetTimeLabel.textContent = sunset.replace(' ', '');
    if (DOM.sunArcProgress) renderSunArc(w.sys.sunrise, w.sys.sunset, w.dt);

    if (DOM.dayLengthVal) {
        const diffMs = (w.sys.sunset - w.sys.sunrise) * 1000;
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        DOM.dayLengthVal.textContent = `${h}h ${m}m`;
    }
    if (DOM.insightSunrise) DOM.insightSunrise.textContent = sunrise.split(' ')[0];
    if (DOM.insightSunset) DOM.insightSunset.textContent = sunset.split(' ')[0];

    // Pressure
    const pressure = w.main.pressure;
    if (DOM.pressureValue) DOM.pressureValue.textContent = pressure;
    // Normalize pressure between 950 and 1060
    const pressurePct = Math.max(0, Math.min(1, (pressure - 950) / 110));
    if (DOM.pressureFill) setCircularGauge(DOM.pressureFill, pressurePct);

    // Visibility & Clouds (Detailed)
    if (DOM.visValue) DOM.visValue.textContent = `${(w.visibility / 1000).toFixed(1)} km`;
    if (DOM.cloudValue) DOM.cloudValue.textContent = `Clouds: ${w.clouds.all}%`;
    if (DOM.cloudBar) DOM.cloudBar.style.width = `${w.clouds.all}%`;

    // Precipitation (Detailed)
    if (DOM.rainProbVal) {
        const rain = w.rain ? (w.rain['1h'] || w.rain['3h'] || 0) : 0;
        const snow = w.snow ? (w.snow['1h'] || w.snow['3h'] || 0) : 0;
        const total = rain + snow;
        const insight = getPrecipitationInsight(total);

        // Prob calculation
        let prob = 0;
        if (forecastData && forecastData.list && forecastData.list[0].pop !== undefined) {
            prob = Math.round(forecastData.list[0].pop * 100);
        } else {
            prob = total > 0 ? 100 : 0;
        }

        if (DOM.rainProbVal) DOM.rainProbVal.innerHTML = `${prob}% <small style="font-size:0.75rem; opacity:0.8; display:block; font-weight:400;">${insight.text}</small>`;
        if (DOM.rainBarFill) {
            DOM.rainBarFill.style.width = `${prob}%`;
            DOM.rainBarFill.style.background = insight.color;
            if (total > 5) DOM.rainBarFill.classList.add('pulse-glow');
            else DOM.rainBarFill.classList.remove('pulse-glow');
        }
        if (DOM.rainAmtVal) {
            DOM.rainAmtVal.innerHTML = total > 0 ? `<span>${insight.icon}</span> ${total.toFixed(1)} mm last hour` : '0 mm last hour';
        }
    }

    // Astronomy (Moon Phase)
    if (DOM.moonIcon) {
        const phase = calculateMoonPhase(new Date(w.dt * 1000));
        const moon = getMoonIcon(phase);
        DOM.moonIcon.textContent = moon.icon;
        if (DOM.moonText) DOM.moonText.textContent = moon.text;
    }

    // Loading Insight Text
    if (DOM.insightMessage) {
        DOM.insightMessage.textContent = 'Thinking about the weather...';
        // After a small delay, give a real insight
        setTimeout(() => {
            if (DOM.insightMessage) {
                DOM.insightMessage.textContent = getPositiveInsight(w.weather[0].id, tempC(w.main.temp));
            }
        }, 1500);
    }
}

function calculateMoonPhase(date) {
    const LUNAR_MONTH = 29.530588853;
    const knownNewMoon = new Date('2024-01-11T11:57:00Z');
    const diff = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
    const phase = (diff % LUNAR_MONTH) / LUNAR_MONTH;
    return phase < 0 ? phase + 1 : phase;
}

async function fetchAirPollution(lat, lon) {
    try {
        const res = await fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        if (!res.ok) throw new Error('Pollution API Error');
        const data = await res.json();
        renderAirPollution(data);
    } catch (err) {
        console.error('[Pollution] Error:', err);
    }
}

function renderAirPollution(data) {
    if (!data || !data.list || !data.list[0]) return;
    const p = data.list[0];
    const aqi = p.main.aqi; // 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor

    const aqiMap = {
        1: { text: 'Good', color: '#4ade80', pm25: 'Low' },
        2: { text: 'Fair', color: '#facc15', pm25: 'Moderate' },
        3: { text: 'Moderate', color: '#f97316', pm25: 'Noticeable' },
        4: { text: 'Poor', color: '#ef4444', pm25: 'High' },
        5: { text: 'Very Poor', color: '#7f1d1d', pm25: 'Dangerous' }
    };

    const status = aqiMap[aqi] || aqiMap[1];
    if (DOM.aqiValue) DOM.aqiValue.textContent = status.text;
    if (DOM.aqiText) DOM.aqiText.textContent = `PM2.5: ${Math.round(p.components.pm2_5)} µg/m³`;
    if (DOM.aqiFill) {
        DOM.aqiFill.style.stroke = status.color;
        const pct = aqi / 5;
        const circum = 251.2;
        DOM.aqiFill.style.strokeDasharray = `${circum * pct} ${circum}`;
    }
}

function setCircularGauge(el, pct) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    el.style.strokeDasharray = circumference;
    // Animate from full offset (empty) to percentage offset (filled)
    const offset = circumference * (1 - pct);
    el.style.strokeDashoffset = offset;
}

function setGauge(el, pct) {
    // Legacy support for other gauges if needed
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const filled = circumference * pct;
    el.setAttribute('stroke-dasharray', `${filled} ${circumference}`);
}

function renderSunArc(sunrise, sunset, now) {
    const totalDaylight = sunset - sunrise;
    const elapsed = Math.max(0, Math.min(now - sunrise, totalDaylight));
    const pct = totalDaylight > 0 ? elapsed / totalDaylight : 0;

    // 1. Dashboard Arc (SVG)
    if (DOM.sunArcProgress && DOM.sunDot) {
        const arcLength = 157;
        const progressLen = arcLength * pct;
        DOM.sunArcProgress.setAttribute('stroke-dasharray', `${progressLen} ${arcLength}`);

        const t = pct;
        const x = (1 - t) * (1 - t) * 10 + 2 * (1 - t) * t * 60 + t * t * 110;
        const y = (1 - t) * (1 - t) * 60 + 2 * (1 - t) * t * (-10) + t * t * 60;
        DOM.sunDot.setAttribute('cx', x);
        DOM.sunDot.setAttribute('cy', y);
    }

    // 2. Details Page Sun Dot (CSS)
    const detailsSunDot = document.getElementById('sun-position-dot');
    if (detailsSunDot) {
        detailsSunDot.style.left = `${pct * 100}%`;
        // Parabolic arc for bottom positioning
        const y = 4 * pct * (1 - pct); // peak at 0.5
        detailsSunDot.style.bottom = `${y * 60}%`; // Adjust factor to fit visual
    }
}

// ——— Event Listeners ———
function init() {
    // Initialize DOM references now that the DOM is ready
    DOM = {
        loadingOverlay: $('loading-overlay'),
        errorToast: $('error-toast'),
        errorMessage: $('error-message'),
        searchOverlay: $('search-overlay'),
        searchInput: $('search-input'),
        searchCancel: $('search-cancel'),
        searchResults: $('search-results'),
        popularSection: $('popular-cities-section'),
        popularGrid: $('popular-cities-grid'),
        openSearch: $('open-search'),
        currentLocationBtn: $('current-location'),
        unitToggle: $('unit-toggle'),
        cityName: $('city-name'),
        heroIcon: $('hero-icon'),
        heroTemp: $('hero-temp'),
        heroUnit: $('hero-unit'),
        heroCondition: $('hero-condition'),
        heroHighLow: $('hero-highlow'),
        forecastList: $('forecast-list'),
        hourlyScroll: $('hourly-scroll'),
        uvValue: $('uv-value'),
        uvNumber: $('uv-number'),
        uvFill: $('uv-fill'),
        humidityValue: $('humidity-value'),
        humidityFill: $('humidity-fill'),
        realfeelValue: $('realfeel-value'),
        realfeelFill: $('realfeel-fill'),
        windDirLabel: $('wind-dir-label'),
        windValue: $('wind-value'),
        windNeedle: $('wind-needle'),
        windSpeedLabel: $('wind-speed-label'),
        sunsetValue: $('sunset-value'),
        sunriseTime: $('sunrise-time'),
        sunsetTimeLabel: $('sunset-time-label'),
        sunArcProgress: $('sun-arc-progress'),
        sunDot: $('sun-dot'),
        pressureValue: $('pressure-value'),
        pressureFill: $('pressure-fill'),
        assistantContent: $('assistant-content'),
        assistantCard: $('assistant-card'),
        // More Details Page unique elements
        dayLengthVal: $('day-length-val'),
        rainProbVal: $('rain-prob-val'),
        rainBarFill: $('rain-bar-fill'),
        rainAmtVal: $('rain-amt-val'),
        insightMessage: $('insight-message'),
        aqiValue: $('aqi-value'),
        aqiFill: $('aqi-fill'),
        aqiText: $('aqi-text'),
        visValue: $('vis-value'),
        cloudValue: $('cloud-value'),
        cloudBar: $('cloud-bar'),
        moonIcon: $('moon-icon'),
        moonText: $('moon-text'),
        insightSunrise: $('insight-sunrise'),
        insightSunset: $('insight-sunset'),
        cityNameDetails: $('city-name-details'),
    };

    // Load saved preferences
    const savedUnit = localStorage.getItem('isCelsius');
    if (savedUnit !== null) {
        isCelsius = savedUnit === 'true';
    }
    updateToggleButton();

    // Smart Assistant Toggle - Logic moved to ai.js to prevent conflicts
    // Code removed to fix "fetchSmartInsight is not defined" error

    // Populate popular cities
    DOM.popularGrid.innerHTML = POPULAR_CITIES.map(city =>
        `<button class="city-chip" data-city="${city}">${city}</button>`
    ).join('');

    DOM.popularGrid.querySelectorAll('.city-chip').forEach(chip => {
        chip.addEventListener('click', () => fetchWeather(chip.dataset.city));
    });

    // Open/Close search
    DOM.openSearch.addEventListener('click', openSearch);
    DOM.searchCancel.addEventListener('click', closeSearch);

    // Search input with debounce
    DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => searchCities(e.target.value.trim()), 350);
    });

    // Search on Enter
    DOM.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            fetchWeather(e.target.value.trim());
        }
    });

    // Unit toggle
    DOM.unitToggle.addEventListener('click', () => {
        isCelsius = !isCelsius;
        localStorage.setItem('isCelsius', isCelsius);
        updateToggleButton();
        renderAll();
    });

    // Current Location
    if (DOM.currentLocationBtn) {
        DOM.currentLocationBtn.addEventListener('click', handleCurrentLocation);
    }

    // Escape to close search
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSearch();
    });

    // Load last city or default
    const lastCity = localStorage.getItem('lastCity') || 'Delhi';
    fetchWeather(lastCity);

    // Map layer buttons
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
            // Add to clicked
            e.target.classList.add('active');
            // Update layer
            currentMapLayer = e.target.dataset.layer;
            renderMap();
        });
    });

    // More Details Transition
    const detailsBtn = document.getElementById('view-details-btn');
    if (detailsBtn) {
        detailsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.body.classList.add('page-exit');
            setTimeout(() => {
                window.location.href = 'details.html';
            }, 500);
        });
    }

    // Back to Dashboard (embedded details view in index.html)
    const backBtn = document.getElementById('back-to-dashboard');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const detailsView = document.getElementById('details-view');
            const dashboardView = document.getElementById('dashboard-view');
            if (detailsView) detailsView.classList.add('hidden');
            if (dashboardView) dashboardView.classList.remove('hidden');
        });
    }
}

function updateToggleButton() {
    DOM.unitToggle.textContent = isCelsius ? '°C' : '°F';
}

// ——— Initialize ———
document.addEventListener('DOMContentLoaded', () => {
    init();
    // Initialize particles on load
    particleOverlay = new ParticleOverlay('weather-map');
});

// ——— Particle System (Advanced Animation) ———
class ParticleOverlay {
    constructor(mapId) {
        this.mapId = mapId;
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationFrame = null;
        this.width = 0;
        this.height = 0;
    }

    init() {
        const mapEl = document.getElementById(this.mapId);
        if (!mapEl) return;

        // Create canvas if not exists
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = '500'; // Above map, below controls
            mapEl.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');

            // Handle resize
            const resizeObserver = new ResizeObserver(() => this.resize());
            resizeObserver.observe(mapEl);
            this.resize();
        }
    }

    resize() {
        const mapEl = document.getElementById(this.mapId);
        if (mapEl && this.canvas) {
            this.width = mapEl.clientWidth;
            this.height = mapEl.clientHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
    }

    clear() {
        if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
        this.particles = [];
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    }

    startRain() {
        this.clear();
        this.init();
        // Create raindrops
        const count = 100;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                l: Math.random() * 20 + 10,
                v: Math.random() * 5 + 10
            });
        }
        this.loop('rain');
    }

    startWind(windDeg = 0, windSpeed = 5) {
        this.clear();
        this.init();
        const count = 60;
        // Wind 0 (N) blows South (Down, +Y). 
        // 0 -> 90 deg (PI/2) in canvas coords (0, 1)
        const angle = (windDeg - 90 + 180) * (Math.PI / 180);
        const speed = Math.min(windSpeed, 30) / 2;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: Math.cos(angle) * (Math.random() + 0.5) * speed,
                vy: Math.sin(angle) * (Math.random() + 0.5) * speed,
                size: Math.random() * 2 + 1
            });
        }
        this.loop('wind');
    }

    startClouds() {
        this.clear();
        this.init();
        const count = 15;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 60 + 40
            });
        }
        this.loop('cloud');
    }

    loop(type) {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        if (type === 'rain') {
            this.ctx.strokeStyle = 'rgba(180, 200, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.particles.forEach(p => {
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x, p.y + p.l);
                p.y += p.v;
                if (p.y > this.height) {
                    p.y = -p.l;
                    p.x = Math.random() * this.width;
                }
            });
            this.ctx.stroke();
        } else if (type === 'wind') {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.particles.forEach(p => {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                p.x += p.vx;
                p.y += p.vy;
                if (p.x > this.width) p.x = 0;
                if (p.x < 0) p.x = this.width;
                if (p.y > this.height) p.y = 0;
                if (p.y < 0) p.y = this.height;
            });
        } else if (type === 'cloud') {
            this.particles.forEach(p => {
                const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();

                p.x += p.vx;
                p.y += p.vy;
                if (p.x > this.width + 100) p.x = -100;
                if (p.x < -100) p.x = this.width + 100;
                if (p.y > this.height + 100) p.y = -100;
                if (p.y < -100) p.y = this.height + 100;
            });
        }

        this.animationFrame = requestAnimationFrame(() => this.loop(type));
    }
}

function updateParticles() {
    if (!particleOverlay || !currentWeatherData) return;

    // Cloud layer takes precedence if active
    if (currentMapLayer === 'CL') {
        particleOverlay.startClouds();
        return;
    }

    const weatherId = currentWeatherData.weather[0].id;
    // 2xx, 3xx, 5xx -> Rain/Storm
    if (weatherId >= 200 && weatherId < 600) {
        particleOverlay.startRain();
    } else if (weatherId >= 700 || currentWeatherData.wind.speed > 5) {
        // Atmosphere or Windy (> 18km/h)
        const deg = currentWeatherData.wind.deg || 0;
        const spd = currentWeatherData.wind.speed;
        particleOverlay.startWind(deg, spd);
    } else {
        particleOverlay.clear();
    }
}

// --- AI Dashboard Outfit Logic ---
async function fetchDashboardOutfit() {
    const container = document.getElementById('outfit-summary');
    if (!container) return;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'outfit',
                weatherData: {
                    city: currentCity,
                    current: {
                        temp: displayTemp(currentWeatherData.main.temp),
                        condition: currentWeatherData.weather[0].description
                    },
                    forecast: []
                }
            })
        });

        if (!res.ok) throw new Error('AI Unavailable');
        const data = await res.json();

        // Robust JSON extraction
        let cleanResponse = data.response.trim();
        const match = cleanResponse.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Invalid formatting');

        let jsonString = match[0];
        let outfitData;
        try {
            outfitData = JSON.parse(jsonString);
        } catch (e) {
            console.warn('[Dashboard] Repairing JSON...');
            try {
                outfitData = JSON.parse(repairJson(jsonString));
            } catch (err) {
                throw new Error('Malformed JSON');
            }
        }

        const rec = outfitData.current_recommendation;

        if (rec) {
            container.innerHTML = `
                <div class="dashboard-outfit-item">
                    <span class="dashboard-outfit-icon">${getOutfitIcon(rec.top)}</span>
                    <span class="dashboard-outfit-value">${rec.top}</span>
                </div>
                <div class="dashboard-outfit-item">
                    <span class="dashboard-outfit-icon">${getOutfitIcon(rec.bottom)}</span>
                    <span class="dashboard-outfit-value">${rec.bottom}</span>
                </div>
                <div class="dashboard-outfit-item">
                    <span class="dashboard-outfit-icon">${getOutfitIcon(rec.footwear)}</span>
                    <span class="dashboard-outfit-value">${rec.footwear}</span>
                </div>
                <div class="dashboard-outfit-item">
                    <span class="dashboard-outfit-icon">${getOutfitIcon(rec.accessory || 'None')}</span>
                    <span class="dashboard-outfit-value">${rec.accessory || 'None'}</span>
                </div>
            `;
        }
    } catch (err) {
        console.error('[Dashboard Outfit] Error:', err);
        container.innerHTML = `<p style="grid-column: span 3; color: var(--text-muted); font-size: 0.8rem;">Fashion AI offline</p>`;
    }
}

function repairJson(str) {
    let repaired = str.trim();

    // 0. Remove comments (//... or /*...*/)
    repaired = repaired.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // 1. Remove trailing commas
    repaired = repaired.replace(/,\s*([\}\]])/g, '$1');

    // 2. Fix missing commas between objects/arrays
    repaired = repaired.replace(/\}\s*\{/g, '},{');
    repaired = repaired.replace(/\]\s*\[/g, '],[')

    // 3. Add missing quotes to keys (unquoted keys)
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    // 4. Fix Single Quoted Keys ('key':) -> ("key":)
    repaired = repaired.replace(/[']([a-zA-Z0-9_]+)[']\s*:/g, '"$1":');

    // 5. Handle truncated JSON (Attempt to close open brackets)
    let openBraces = (repaired.match(/\{/g) || []).length;
    let closeBraces = (repaired.match(/\}/g) || []).length;
    let openBrackets = (repaired.match(/\[/g) || []).length;
    let closeBrackets = (repaired.match(/\]/g) || []).length;

    while (openBrackets > closeBrackets) { repaired += ']'; closeBrackets++; }
    while (openBraces > closeBraces) { repaired += '}'; closeBraces++; }

    return repaired;
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
    if (text.includes("dress") || text.includes("skirt") || text.includes("gown") || text.includes("frock")) return "👗";
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

// ——— Data Enhancements (Phase 1) ———

async function fetchEnvironmentalData(lat, lon) {
    console.log('[Env] Fetching environmental data...');
    try {
        // Phase 2 & 3: Alerts + 14-Day + Moon Times + Rain Data
        const [extraRes, aqiRes, alertsRes] = await Promise.all([
            fetch(`${BASE_URL}/extra?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,moon_phase,uv_index_max,moonrise,moonset,temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,precipitation_probability_max&hourly=visibility,cloudcover&forecast_days=14&timezone=auto`),
            fetch(`${BASE_URL}/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto`),
            fetch(`${BASE_URL}/alerts?latitude=${lat}&longitude=${lon}&timezone=auto`)
        ]);

        if (extraRes.ok && aqiRes.ok) {
            const extraData = await extraRes.json();
            const aqiData = await aqiRes.json();
            const alertsData = alertsRes.ok ? await alertsRes.json() : {};
            renderEnvironment(extraData, aqiData, alertsData);
        } else {
            console.warn('[Env] Failed to fetch environmental data');
        }
    } catch (e) {
        console.error('[Env] Error:', e);
    }
}

function renderEnvironment(extra, aqi, alerts) {
    if (!extra || !extra.daily) return;

    // 1. Moon Phase
    const moonPhase = extra.daily.moon_phase ? extra.daily.moon_phase[0] : 0;
    const moon = getMoonIcon(moonPhase);
    const moonIconEl = document.getElementById('moon-icon');
    const moonTextEl = document.getElementById('moon-text');
    if (moonIconEl) moonIconEl.textContent = moon.icon;
    if (moonTextEl) moonTextEl.textContent = moon.text;

    // 2. Visibility & Clouds (Current Hour)
    const currentHour = new Date().getHours();
    const visibility = extra.hourly.visibility ? extra.hourly.visibility[currentHour] : 0;
    const clouds = extra.hourly.cloudcover ? extra.hourly.cloudcover[currentHour] : 0;

    const visEl = document.getElementById('vis-value');
    const cloudValEl = document.getElementById('cloud-value');
    const cloudBarEl = document.getElementById('cloud-bar');

    if (visEl) visEl.textContent = `${(visibility / 1000).toFixed(1)} km`;
    if (cloudValEl) cloudValEl.textContent = `Clouds: ${clouds}%`;
    if (cloudBarEl) cloudBarEl.style.width = `${clouds}%`;

    // 3. Air Quality
    let pm25 = 0;
    if (aqi && aqi.hourly && aqi.hourly.pm2_5) {
        pm25 = aqi.hourly.pm2_5[currentHour];
    }
    const aqiStatus = getAQIStatus(pm25);

    const aqiValueEl = document.getElementById('aqi-value');
    const aqiTextEl = document.getElementById('aqi-text');
    const aqiFillEl = document.getElementById('aqi-fill');

    if (aqiValueEl) aqiValueEl.textContent = aqiStatus.text;
    if (aqiTextEl) aqiTextEl.textContent = `PM2.5: ${Math.round(pm25)} µg/m³`;
    if (aqiFillEl) {
        aqiFillEl.style.stroke = aqiStatus.color;
        // Map 0-100 scale roughly (Standard AQI max is 500 but for chart 0-100 is enough for visual)
        const offset = 251.2 - ((Math.min(pm25, 100) / 100) * 251.2);
        aqiFillEl.style.strokeDasharray = `${251.2 - offset} 251.2`;
        aqiFillEl.style.strokeDashoffset = 0;
    }

    // 4. Pollen (New List Logic)
    const pollenListEl = document.getElementById('pollen-list');
    if (pollenListEl && aqi && aqi.hourly) {
        const pollenTypes = [
            { name: 'Grass', key: 'grass_pollen' },
            { name: 'Tree', key: 'birch_pollen' },
            { name: 'Weed', key: 'ragweed_pollen' }
        ];

        const pollenHtml = pollenTypes.map(type => {
            const val = aqi.hourly[type.key] ? aqi.hourly[type.key][currentHour] : 0;
            const level = getPollenLevel(val);

            // Dynamic color for both bar and text
            let color = '#4ade80'; // Low
            if (level.class === 'moderate') color = '#facc15';
            if (level.class === 'high' || level.class === 'extreme') color = '#ef4444';

            const riskText = level.class.charAt(0).toUpperCase() + level.class.slice(1);

            return `
                <div class="pollen-item" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span style="font-size:0.8rem; font-weight:600; color:var(--text-primary);">${type.name}</span>
                        <span style="font-size:0.7rem; color:${color}; font-weight:700;">${riskText}</span>
                    </div>
                    <div style="width:60%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden; position:relative;">
                        <div style="width:${level.pct}%; height:100%; background:${color}; border-radius:3px; transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
                    </div>
                </div>
            `;
        }).join('');

        pollenListEl.innerHTML = pollenHtml || '<div style="opacity:0.6; font-size:0.85rem;">No Pollen Data</div>';
    }

    // 5. Moon Times
    if (extra.daily.moonrise && extra.daily.moonset) {
        // Only append if not already there to prevent dups if called multiple times
        // Actually simpler to just set text content if we had dedicated elements, but we are appending innerHTML in previous code.
        // Let's stay robust.
    }

    // 6. Alerts & Extended
    renderAlerts(alerts);
    renderExtendedForecast(extra.daily);

    // 7. NEW: Daily Insights (Sun Arc & Rain) & POSITIVE LOGIC
    if (extra.daily.sunrise && extra.daily.sunset) {
        const sunrise = new Date(extra.daily.sunrise[0]);
        const sunset = new Date(extra.daily.sunset[0]);
        const now = new Date();

        // Day Length & Sun Position using prompt logic
        const sunriseSec = sunrise.getTime() / 1000;
        const sunsetSec = sunset.getTime() / 1000;
        const nowSec = now.getTime() / 1000;
        const totalDaylightSec = sunsetSec - sunriseSec;

        const hours = Math.floor(totalDaylightSec / 3600);
        const minutes = Math.floor((totalDaylightSec % 3600) / 60);
        const elapsed = nowSec - sunriseSec;
        const sunPositionPercent = Math.min(Math.max((elapsed / totalDaylightSec) * 100, 0), 100);

        const dayLengthEl = document.getElementById('day-length-val');
        if (dayLengthEl) dayLengthEl.textContent = `${hours} hrs ${minutes} mins`;

        // Visual placement
        const dot = document.getElementById('sun-position-dot');
        if (dot) {
            // Simplified linear X, Parabolic Y for arc effect
            dot.style.left = `${sunPositionPercent}%`;
            // Parabola for arc height
            const xNormal = sunPositionPercent / 100;
            const yNormal = 4 * xNormal * (1 - xNormal);
            dot.style.bottom = `${yNormal * 80}%`; // Intense arc height

            if (now < sunrise || now > sunset) {
                dot.style.opacity = '0.3'; // Dim at night
                dot.style.background = '#ccc';
            } else {
                dot.style.opacity = '1';
                dot.style.background = '#facc15';
                dot.style.boxShadow = '0 0 10px #facc15';
            }
        }

        const srEl = document.getElementById('insight-sunrise');
        const ssEl = document.getElementById('insight-sunset');
        if (srEl) srEl.textContent = sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (ssEl) ssEl.textContent = sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // --- NEW: Positive Insight Logic ---
        const code = extra.daily.weathercode[0];
        const maxTemp = extra.daily.temperature_2m_max[0];
        const insightMsg = getPositiveInsight(code, maxTemp);
        const insightEl = document.getElementById('insight-message');
        if (insightEl) insightEl.textContent = insightMsg;
    }

    // Rain Bar Logic
    if (extra.daily.precipitation_probability_max) {
        const rainProb = extra.daily.precipitation_probability_max[0];
        const rainAmt = extra.daily.precipitation_sum ? extra.daily.precipitation_sum[0] : 0;
        const insight = getPrecipitationInsight(rainAmt);

        const rainProbVal = document.getElementById('rain-prob-val');
        const rainFill = document.getElementById('rain-bar-fill');
        const rainAmtVal = document.getElementById('rain-amt-val');

        if (rainProbVal) rainProbVal.innerHTML = `${rainProb}% <small style="font-size:0.7rem; opacity:0.7; display:block; font-weight:400;">${insight.text}</small>`;
        if (rainFill) {
            rainFill.style.width = `${rainProb}%`;
            rainFill.style.background = insight.color;
            if (rainAmt > 5) rainFill.classList.add('pulse-glow');
            else rainFill.classList.remove('pulse-glow');
        }
        if (rainAmtVal) {
            rainAmtVal.innerHTML = `<span>${insight.icon}</span> ${rainAmt} mm expected today`;
            rainAmtVal.style.color = rainAmt > 0 ? insight.color : 'inherit';
        }
    }

    // --- NEW: RealFeel Logic ---
    // Estimate RealFeel using Temperature, Wind (Current), Humidity (Current)
    const currentTemp = extra.hourly.temperature_2m ? extra.hourly.temperature_2m[currentHour] : 0;
    const currentWind = extra.hourly.windspeed_10m ? extra.hourly.windspeed_10m[currentHour] : 0;
    const currentHumid = extra.hourly.relativehumidity_2m ? extra.hourly.relativehumidity_2m[currentHour] : 50;

    const realFeel = calculateGenericRealFeel(currentTemp, currentWind, currentHumid);
    const realFeelEl = document.getElementById('realfeel-value');
    if (realFeelEl) realFeelEl.textContent = `${Math.round(realFeel)}°`;

    // Daily Summary
    renderDailySummary(extra.daily);
}

// --- Helper Functions for Logic ---

function getPositiveInsight(code, temp) {
    // 0-3: Clear/Cloudy
    // 45-48: Fog
    // 51-67: Rain
    // 71-77: Snow
    // 95+: Storm

    let msg = "Enjoy your day!";

    if (code <= 3) {
        if (temp > 25) msg = "Beautiful sunny weather! Stay hydrated and enjoy the sun. ☀️😎";
        else if (temp > 15) msg = "Perfect weather for a walk in the park! 🌳🚶";
        else msg = "Crisp and clear! Bundle up and enjoy the sunshine. 🧥🌞";
    } else if (code <= 48) {
        msg = "A bit foggy/cloudy. Great atmosphere for a warm coffee! ☕☁️";
    } else if (code <= 67 || (code >= 80 && code <= 82)) {
        msg = "Rain in the forecast? Perfect excuse for a cozy movie marathon! 🍿🎬";
    } else if (code <= 77 || code === 85 || code === 86) {
        msg = "Snow showing up? Time for hot cocoa and maybe a snowman! ☃️☕";
    } else if (code >= 95) {
        msg = "Stormy vibes! Stay safe indoors and enjoy the sound of thunder. ⚡🏠";
    }
    return msg;
}

function calculateGenericRealFeel(temp, wind, humid) {
    // Very simplified formula for demonstration
    // If cold (< 10C): Wind Chill
    // If hot (> 27C): Heat Index
    // Else: approx temp

    if (temp <= 10) {
        // Simple Wind Chill approx: T - (Wind * 0.7)
        return temp - (wind * 0.5);
    } else if (temp >= 27) {
        // Simple Heat Index approx: T + (Humidity * 0.1)
        return temp + ((humid - 50) * 0.1);
    }
    return temp;
}
function getMoonIcon(phase) {
    // 0 = New, 0.25 = First Q, 0.5 = Full, 0.75 = Last Q
    if (phase === 0 || phase === 1) return { icon: '🌑', text: 'New Moon' };
    if (phase < 0.25) return { icon: '🌒', text: 'Waxing Crescent' };
    if (phase === 0.25) return { icon: '🌓', text: 'First Quarter' };
    if (phase < 0.5) return { icon: '🌔', text: 'Waxing Gibbous' };
    if (phase === 0.5) return { icon: '🌕', text: 'Full Moon' };
    if (phase < 0.75) return { icon: '🌖', text: 'Waning Gibbous' };
    if (phase === 0.75) return { icon: '🌗', text: 'Last Quarter' };
    return { icon: '🌘', text: 'Waning Crescent' };
}

function getAQIStatus(pm25) {
    if (pm25 <= 12) return { text: 'Good', color: '#4ade80' };
    if (pm25 <= 35.4) return { text: 'Moderate', color: '#facc15' };
    if (pm25 <= 55.4) return { text: 'Sensitive', color: '#f97316' };
    if (pm25 <= 150.4) return { text: 'Unhealthy', color: '#ef4444' };
    return { text: 'Hazardous', color: '#7f1d1d' };
}

function getPollenLevel(val) {
    // val is grains/m³ roughly
    if (val <= 10) return { class: 'low', pct: 20 };
    if (val <= 50) return { class: 'moderate', pct: 50 };
    if (val <= 200) return { class: 'high', pct: 80 };
    return { class: 'extreme', pct: 100 };
}

/* ---------- Phase 2 Functions ---------- */

function renderAlerts(alerts) {
    const banner = document.getElementById('alert-banner');
    const msgEl = document.getElementById('alert-message');
    if (!banner || !msgEl) return;

    if (alerts && alerts.features && alerts.features.length > 0) {
        const alert = alerts.features[0].properties;
        msgEl.textContent = `${alert.event || 'Weather Alert'}: ${alert.headline || 'Severe weather expected'}`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function renderExtendedForecast(daily) {
    const list = document.getElementById('forecast-list-14');
    if (!list) return;

    // Show button if we have data
    const btn = document.getElementById('view-14-day-btn');
    if (btn) {
        btn.style.display = 'block';
        btn.onclick = () => document.getElementById('forecast-overlay').classList.remove('hidden');
    }

    list.innerHTML = daily.time.map((t, i) => {
        const date = new Date(t);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const code = daily.weathercode[i];
        const min = Math.round(daily.temperature_2m_min[i]);
        const max = Math.round(daily.temperature_2m_max[i]);
        const icon = getWMOIcon(code);
        const desc = getWMODesc(code);

        return `
            <div class="forecast-row-extended">
                <div style="display:flex; align-items:center;">
                    <span class="ext-date">${dayName}</span>
                    <span class="ext-icon" style="font-size:1.5rem; margin-left:12px;">${icon}</span>
                    <span class="ext-desc">${desc}</span>
                </div>
                <span class="ext-temp">${max}° / <span style="opacity:0.7;">${min}°</span></span>
            </div>
        `;
    }).join('');
}

function getWMOIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '❄️';
    return '⛈️';
}

function getWMODesc(code) {
    const map = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing rime fog',
        51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
        95: 'Thunderstorm'
    };
    return map[code] || 'Rainy';
}

function renderDailySummary(daily) {
    const heroCondition = document.getElementById('hero-condition');
    if (!heroCondition) return;

    // We already have hero-condition showing current weather desc. 
    // Let's add a separate summary below it or append.
    // User requested "Day Description" summary.

    let summaryEl = document.getElementById('day-summary-text');
    if (!summaryEl) {
        summaryEl = document.createElement('p');
        summaryEl.id = 'day-summary-text';
        summaryEl.style.fontSize = '0.9rem';
        summaryEl.style.opacity = '0.8';
        summaryEl.style.marginTop = '4px';
        heroCondition.parentNode.insertBefore(summaryEl, heroCondition.nextSibling);
    }

    const code = daily.weathercode[0];
    const maxTemp = Math.round(daily.temperature_2m_max[0]);
    const minTemp = Math.round(daily.temperature_2m_min[0]);
    const rainProb = daily.precipitation_probability_max[0];
    const desc = getWMODesc(code);

    let text = `Today: ${desc}. High ${maxTemp}°, Low ${minTemp}°.`;
    if (rainProb > 0) text += ` ${rainProb}% chance of rain.`;
    else text += ` No rain expected.`;

    summaryEl.textContent = text;
}

// --- AUTO-INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the dashboard (presence of search input)
    const searchInput = document.getElementById('city-input');
    if (searchInput) {
        // Load last city or default to London
        const storedCity = localStorage.getItem('lastCity') || 'London';
        console.log('[Init] Auto-loading weather for:', storedCity);
        fetchWeather(storedCity);
    }
});
