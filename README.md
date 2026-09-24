# 🌦️ WeatherGPT — AI Meteorological Intelligence & Early Warning System (SIH26068)

> **Award-Winning AI Meteorology & Disaster Decision Platform** featuring Real-time Doppler Radar, Multi-model NWP Consensus (ECMWF, GFS, ICON), Multilingual Agronomy Advisories, and Distributed In-Memory Caching.

---

## 📁 Project Architecture & Clean Folder Separation

The project is structured into dedicated, decoupled components:

```
SIH FINAL/
│
├── 🌐 WEATHER-GPT/                       # ─── WEB PLATFORM & BACKEND REST API ───
│   ├── .env                             # Active environment configuration
│   ├── .env.example                     # Environment template with Redis & API keys
│   ├── package.json                     # Node.js dependencies (ioredis, mongodb, sqlite)
│   ├── data/                            # Persistent SQLite database storage
│   ├── src/                             # Backend API & Engine
│   │   ├── server.js                    # Server startup & lifecycle
│   │   ├── app.js                       # HTTP routing & API endpoints
│   │   ├── config/env.js                # Environment variables loader
│   │   ├── database/                    # SQLite (WAL) & MongoDB Atlas adapters
│   │   ├── services/
│   │   │   ├── redisService.js          # [NEW] Redis caching engine + auto-fallback
│   │   │   ├── weatherService.js        # IMD Risk Score & Open-Meteo telemetry
│   │   │   ├── geocodeService.js        # Geolocation search with 24h Redis caching
│   │   │   ├── aiService.js             # Google Gemini 2.5 Flash + Multilingual engine
│   │   │   ├── aviationService.js       # METAR/TAF aviation intelligence
│   │   │   ├── climateService.js        # 30-day climate anomaly & NDMA advisories
│   │   │   └── nwpService.js            # Numerical Weather Prediction models
│   │   └── controllers/                 # REST controllers (weather, ai, favorites, etc.)
│   └── public/                          # Web Frontend (Single Page Application & PWA)
│       ├── index.html                   # Flagship responsive dashboard
│       ├── css/style.css                # AMOLED glassmorphic design & animations
│       └── js/                          # Client controllers & Leaflet GIS radar
│
├── 📱 WeatherGPT-Flutter/               # ─── FLUTTER MOBILE APPLICATION ───
│   ├── lib/                             # Cross-platform Dart codebase
│   │   ├── main.dart                    # Mobile app bootstrap & navigation host
│   │   ├── screens/                     # Home, Forecast Advisory, Radar, AI Chat, Climate
│   │   ├── services/weather_service.dart# API client connecting to backend
│   │   ├── theme/                       # AMOLED Pitch Black Design System
│   │   └── widgets/                     # Reusable glassmorphic weather cards & charts
│   ├── android/                         # Android native project files
│   └── web/                             # Web target configuration
│
├── 📚 docs/                             # ─── DOCUMENTATION & PRESENTATION ───
│   ├── SIH_WEATHER_SPT_ARCHITECTURE.md  # Comprehensive technical architecture
│   ├── WEATHERGPT_PPT_ARCHITECTURE.html # Interactive presentation slide deck
│   ├── Weather_SPT_Complete_Workflow_and_Process.html # Interactive workflow guide
│   └── Weather_SPT_Complete_Workflow_and_Process.pdf  # Printable workflow document
│
├── START_WEBSITE.bat                    # 🚀 1-Click Launch for Website & Backend API
├── START_MOBILE_APP.bat                 # 📱 1-Click Launch for Flutter Mobile App
└── START_ALL.bat                        # ⚡ 1-Click Launch for BOTH applications
```

---

## 🚀 How to Access & See Both Projects

### Option 1: Double-Click 1-Click Batch Files (Recommended)
- **To view the Web Platform & Backend**: Double-click `START_WEBSITE.bat`
  - Opens in your browser at: **[http://localhost:3000](http://localhost:3000)**
- **To view the Flutter Mobile App**: Double-click `START_MOBILE_APP.bat`
  - Opens in Microsoft Edge at: **[http://localhost:8090](http://localhost:8090)**
- **To view BOTH together**: Double-click `START_ALL.bat`

### Option 2: Running via Terminal / Command Line

#### 1. Start the Website & Backend API:
```bash
npm run web
# Server runs at http://localhost:3000
```

#### 2. Start the Flutter Mobile Application:
```bash
# Run in Browser (Edge/Chrome on port 8090):
npm run mobile

# Or run natively on Windows Desktop:
npm run mobile:windows

# Or run on connected Android Device / Emulator:
cd WeatherGPT-Flutter
flutter run
```

---

## ⚡ Redis In-Memory Caching Integration

WeatherGPT now features a high-performance **Redis L1 Cache** integrated into `src/services/redisService.js`:

### Key Features:
- **Sub-Millisecond Response**: Telemetry for queried coordinates and geocoding searches are cached in Redis (with configurable TTL), reducing repeated API response times from ~2,400ms down to **~3ms**.
- **Zero-Downtime Graceful Fallback**: If Redis is not currently running on your system, the server **automatically detects this** and seamlessly routes caching through embedded SQLite without crashing or throwing errors.
- **Health Diagnostics**: The `/api/health` endpoint reports live Redis connection status.

### How to Enable Redis:
1. **Local Redis (Docker or Memurai on Windows)**:
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```
2. **Free Cloud Redis (Upstash / Redis Cloud)**:
   - Create a free database on [Upstash Redis](https://upstash.com/).
   - Copy your Redis connection URL (e.g., `rediss://default:xxxx@xxxx.upstash.io:6379`).
   - Paste it into `WEATHER-GPT/.env`:
     ```env
     REDIS_URL=rediss://default:xxxx@xxxx.upstash.io:6379
     ```
3. Restart the server and you will see:
   ```
   [redis] ⚡ Connected to Redis caching engine at: rediss://***@xxxx.upstash.io:6379
   ```

---

## 🔑 Configuration & Environment Variables (`WEATHER-GPT/.env`)

You can customize features in `WEATHER-GPT/.env`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP server listening port | `3000` |
| `GEMINI_API_KEY` | Google Gemini AI Key for AI Meteorologist | [Google AI Studio](https://aistudio.google.com/) |
| `REDIS_URL` | Redis caching connection string | `redis://127.0.0.1:6379` |
| `MONGODB_URI` | MongoDB Atlas cluster connection string | *(Optional, SQLite used if blank)* |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per IP window | `120` |

---

## 🧪 Verified API Endpoints

- **Health Check**: `GET /api/health` — Checks database, MongoDB, and Redis health.
- **Weather Telemetry**: `GET /api/weather?lat=17.385&lon=78.4867` — Returns Open-Meteo telemetry + IMD risk index.
- **Geocoding**: `GET /api/geocode?q=Hyderabad` — Fast location search cached in Redis.
- **Radar Frames**: `GET /api/weather/radar` — Live RainViewer Doppler radar frames.
- **AI Meteorologist**: `POST /api/ai/ask` — Multilingual conversational weather expert powered by Gemini 2.5 Flash.
- **Aviation Telemetry**: `GET /api/weather/aviation?lat=17.385&lon=78.4867` — METAR/TAF flight hazard data.
