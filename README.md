# 🌤️ Live Weather Dashboard

A **premium, real-time weather dashboard** powered by AI. Get hyperlocal weather data, an AI-driven Superstar briefing, detailed forecasts, and dynamic backgrounds — all in one place.

---

## 🚀 Features

### 🌡️ Main Dashboard (`index.html`)
- **Live Weather Data** — Temperature, humidity, wind, pressure, visibility
- **Feels-Like Engine** — Apparent temperature using humidity + wind chill
- **Dynamic Background** — Weather-reactive colors and animated backgrounds
- **Precipitation Bar** — Visual intensity meter with humanized text (Light Rain, Heavy Downpour)
- **UV Index Gauge** — Animated SVG gauge with dynamic color coding
- **5-Day Forecast** — Expandable hourly and daily forecast cards
- **Sunrise / Sunset** — Day arc with real sun position and day-length calculation
- **Live Weather Map** — Interactive radar with Precipitation, Wind, Cloud layers

### 🤖 AI Assistant (`ai.html`)
- **Superstar AI Mode** — Structured briefing: ⚡ Advice • 😄 Fun Zone • 🚀 Recommendation
- **Expert Persona** — Powered by Groq (Llama 3) with fallback to Pollinations AI
- **Smart Suggestion Pills** — Quick follow-up actions after every response
- **Auto-Retry** — Automatically retries once on connection failure

### 📊 Details Page (`details.html`)
- **Extended Forecast** — 8-slot hourly breakdown with condition icons
- **Daily Summary** — Descriptive paragraph about the day's weather
- **Moon Phase Card** — Current lunar phase with emoji representation
- **Pollen Risk Card** — Estimated risk level with color syncing
- **Astronomy & More** — Pressure, visibility, humidity depth cards

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js (vanilla HTTP server) |
| AI Engine | Groq API (Llama 3) + Pollinations.AI (fallback) |
| Weather API | OpenWeatherMap REST API |
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Animation | Lottie Web (chatbot animation) |
| Fonts | Google Fonts — Inter |

---

## 📁 Project Structure

```
LIVE WEATHER DASHBOARD/
├── index.html          # Main dashboard
├── ai.html             # AI Smart Assistant page
├── details.html        # Detailed weather analysis page
├── app.js              # Main dashboard logic
├── ai.js               # AI assistant logic + rendering
├── details.js          # Details page logic
├── backgrounds.js      # Dynamic weather background logic
├── style.css           # Global design system
├── server.js           # Node.js backend (API proxy + AI endpoint)
├── serve.bat           # One-click server launcher (Windows)
├── .env                # API keys (not committed to git)
├── Live chatbot.json   # Lottie animation for the chatbot
└── weather images/     # Static weather icons
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- **Node.js** v18 or higher — [Download](https://nodejs.org)
- A free **OpenWeatherMap API key** — [Get one](https://openweathermap.org/api)
- A free **Groq API key** — [Get one](https://console.groq.com)

### 2. Clone the Project
```bash
git clone https://github.com/your-username/live-weather-dashboard.git
cd live-weather-dashboard
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
```

> The OpenWeatherMap key is currently embedded in the client JS. For production, move it to `.env` and proxy it via `server.js`.

### 4. Run the Server
**Option A — Double-click (Windows):**
```
serve.bat
```

**Option B — Terminal:**
```bash
node server.js
```

The dashboard opens at **http://localhost:5500**

---

## 🔌 API Endpoints (server.js)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/weather?q={city}` | Current weather proxy |
| GET | `/api/forecast?q={city}` | 5-day forecast proxy |
| POST | `/api/chat` | AI insight (Groq + fallback) |
| GET | `/api/alerts?lat={}&lon={}` | Weather alerts |
| GET | `/api/tiles/*` | Weather map tiles proxy |

---

## 🤖 AI Assistant Modes

| Mode | Persona | Output |
|---|---|---|
| `practical` | ⚡ Superstar Advisor | Advice bullets + Fun + Recommendation |
| `creative` | 🎭 Weather Narrator | Engaging story / observation |
| `wellness` | 🌿 Health Consultant | Skin / Respiratory / Energy sections |
| `travel` | 🚗 Travel Advisor | Road / Flight / What to Carry sections |

---

## 🧪 Test Scripts

| File | Purpose |
|---|---|
| `test-simple.js` | Basic connectivity check |
| `test-assistant.js` | AI assistant API test |
| `test-modes.js` | All AI modes test |
| `test-groq.js` | Groq API direct test |
| `test-openai.js` | OpenAI API test |
| `test-pollinations.js` | Pollinations fallback test |
| `test-speed-all.js` | Response speed benchmark |

Run any test:
```bash
node test-assistant.js
```

---

## 🎨 Design System

- **Color Palette** — Deep dark (`#0d1117`) with purple/blue glassmorphism accents
- **Typography** — Inter (Google Fonts) — weights 300 to 800
- **Cards** — Glassmorphism with `backdrop-filter: blur` + gradient borders
- **Animations** — Lottie chatbot, CSS stagger reveals, SVG stroke animations
- **Responsive** — Mobile-first, adapts to 375px → desktop

---

## 🔒 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Groq API key for AI responses |

---

## 📄 License

MIT License — feel free to fork and build on top of this project.

---

## 🙌 Credits

Built with ❤️ using:
- [OpenWeatherMap](https://openweathermap.org) — Weather data
- [Groq](https://groq.com) — Ultra-fast AI inference
- [Pollinations.AI](https://pollinations.ai) — Free AI fallback
- [Lottie Web](https://airbnb.io/lottie) — Chatbot animations
- [Google Fonts](https://fonts.google.com) — Inter typeface
