# 🌦️ WeatherGPT — AI-Powered Weather Intelligence & Decision Support Platform

> **Smart India Hackathon (SIH) Project**
> **Problem Statement:** SIH26068
> **Project:** WeatherGPT
> **Team:** Syntax Squad

WeatherGPT is an **AI-powered, multilingual weather intelligence and decision-support platform** designed for India.

Instead of requiring users to understand complex weather data, WeatherGPT allows them to ask weather-related questions naturally using **text or voice** and receive understandable, location-specific responses.

The platform combines **real-time weather data, AI, risk analysis, disaster intelligence, agriculture guidance, maps, multilingual communication and voice interaction** into a single system.

---

## 🚀 Key Idea

Weather information is available through many different sources, but it is often:

* fragmented across different applications
* difficult for non-technical users to understand
* unavailable in the user's preferred Indian language
* difficult to interpret for farmers
* not presented as actionable decisions
* disconnected from disaster and risk information

### WeatherGPT solves this by creating a conversational weather intelligence layer.

A user can simply ask:

> **"Will it rain tomorrow?"**

or

> **"రేపు వర్షం పడుతుందా?"**

or

> **"कल बारिश होगी क्या?"**

WeatherGPT processes the question, obtains structured weather information and provides an understandable response.

---

# 🎯 Objectives

* Provide location-specific weather intelligence.
* Make weather information accessible to everyone.
* Support Indian regional languages.
* Provide voice-based weather interaction.
* Help farmers make weather-aware decisions.
* Detect and communicate weather risks.
* Display weather intelligence on an interactive map.
* Provide cyclone and hazard information.
* Reduce dependence on manually interpreting complex meteorological data.
* Prevent AI from inventing weather values.

---

# ✨ Major Features

## 🤖 WeatherGPT AI

Users can ask natural-language weather questions.

Examples:

* Will it rain today?
* What will the temperature be tomorrow?
* Is it safe to travel?
* What is the wind speed?
* Will there be heavy rainfall?
* What is the UV level?
* What is the air quality?
* What should farmers do today?
* What is the weather forecast for the next 7 days?

The AI uses structured weather information as context instead of generating weather values from memory.

---

## 🌍 Multilingual Support

WeatherGPT supports multiple Indian languages:

| Language     | Support |
| ------------ | ------- |
| 🇬🇧 English | ✅       |
| 🇮🇳 Telugu  | ✅       |
| 🇮🇳 Hindi   | ✅       |
| 🇮🇳 Marathi | ✅       |
| 🇮🇳 Kannada | ✅       |
| 🇮🇳 Tamil   | ✅       |

AI responses, Farmer Mode and other conversational features can respond in the selected language.

---

# 🎙️ Voice Interaction

WeatherGPT supports voice-based interaction using browser speech capabilities.

Users can:

1. Speak a question.
2. Convert speech into text.
3. Send the question to WeatherGPT.
4. Receive an AI-generated response.
5. Listen to the response using text-to-speech.

This improves accessibility for users who may not be comfortable typing.

---

# 👨‍🌾 Farmer Mode

Farmer Mode provides weather-aware agricultural decision support.

It can help users understand:

* rainfall conditions
* temperature
* humidity
* wind
* UV conditions
* forecast trends
* irrigation considerations
* weather risks
* suitable farming activities
* weather-sensitive planning

The system is designed to provide **decision support**, not replace agricultural or meteorological experts.

---

# 🗺️ India Weather Intelligence Map

WeatherGPT includes an interactive map for visualizing weather information.

The map architecture supports weather layers such as:

* 🌧️ Rain
* 💨 Wind
* 🌡️ Temperature
* ☁️ Clouds
* 💧 Humidity
* 🌀 Pressure
* ☀️ UV
* 🌫️ Air Quality
* 🌧️ Precipitation
* 🛰️ Satellite/weather visualization
* 🌀 Cyclone information
* ⚠️ Risk information

The map is designed to make complex weather information visually understandable.

---

# 🌀 Cyclone & Hazard Intelligence

WeatherGPT integrates disaster-awareness information to display cyclone-related information.

The system can visualize:

* cyclone locations
* cyclone tracks
* affected areas
* alert levels
* hazard information

Cyclone information is obtained through disaster-awareness data sources rather than being invented by the AI.

---

# ⚠️ Risk & Alert Intelligence

WeatherGPT uses weather conditions to identify potential risks.

Examples include:

* Heavy Rain Risk
* Extreme Heat Risk
* Strong Wind Risk
* Thunderstorm Risk
* Poor Air Quality
* High UV Risk
* Travel-related weather risk

The system can convert raw weather conditions into understandable caution levels.

### Example

```text
Temperature: 42°C
Humidity: High
Forecast: Hot and dry

Risk:
🔥 Extreme Heat

Recommendation:
Avoid prolonged outdoor exposure and stay hydrated.
```

---

# 📍 Location Intelligence

Users can search for:

* City
* Town
* Village
* District
* Region
* Other supported places

The system supports:

* location search
* autocomplete suggestions
* geocoding
* reverse geocoding
* device location

When device location is available, WeatherGPT can obtain the user's coordinates and identify the corresponding location.

---

# ✈️ Travel Weather Intelligence

WeatherGPT can help users understand weather conditions for travel.

Users can provide:

* starting location
* destination
* travel date
* duration

The system can provide weather-aware travel information and potential risks.

---

# 💡 Daily Weather Ideas

WeatherGPT can provide useful daily suggestions based on weather conditions.

Examples:

* Outdoor activity suggestions
* Travel suggestions
* Farming-related suggestions
* Heat precautions
* Rain precautions
* Weather-aware planning

The AI can explain these suggestions in the user's selected language.

---

# 🧠 Anti-Hallucination Architecture

One of the important design principles of WeatherGPT is:

> **AI should explain weather data, not invent weather data.**

The architecture separates:

```text
Weather Data
     ↓
Structured Weather Context
     ↓
Risk / Alert Engine
     ↓
AI Interpretation
     ↓
User-Friendly Response
```

Critical weather values are obtained from structured weather services.

The AI is instructed to:

* use supplied weather values
* avoid inventing numerical values
* clearly state when information is unavailable
* provide safety-first explanations
* avoid presenting guesses as facts

This makes WeatherGPT more reliable than a generic conversational AI that has no live weather context.

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────┐
                         │      User Device     │
                         │ Mobile / Desktop     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   WeatherGPT UI      │
                         │ HTML / CSS / JS      │
                         └──────────┬───────────┘
                                    │
                         REST API Requests
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Express Backend    │
                         │     Node.js          │
                         └──────────┬───────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
       ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
       │ Weather Service│  │ Gemini AI       │  │ Disaster Data  │
       │ Open-Meteo     │  │ Google Gemini   │  │ GDACS          │
       └────────────────┘  └────────────────┘  └────────────────┘
                │                   │                   │
                └───────────────────┼───────────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │ Risk & Decision      │
                         │ Intelligence Layer   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ SQLite Database      │
                         │ History / Chats      │
                         └──────────────────────┘
```

---

# 🛠️ Technology Stack

## Frontend

* HTML5
* CSS3
* JavaScript
* Responsive Web Design
* Leaflet.js
* Browser Geolocation API
* Web Speech API

## Backend

* Node.js
* Express.js
* REST APIs
* Helmet
* Compression
* Rate Limiting
* Request IDs
* SQLite

## Artificial Intelligence

* Google Gemini API
* Gemini 2.5 Flash
* Natural-language understanding
* Weather-context-based generation
* Multilingual response generation

## Weather Data

* Open-Meteo Weather API
* Open-Meteo Air Quality API

## Location

* Open-Meteo Geocoding
* OpenStreetMap / Nominatim
* Browser Geolocation

## Disaster Intelligence

* GDACS
* Cyclone geospatial data

## Mapping

* Leaflet
* OpenStreetMap

---

# 🔌 APIs & External Services

| Service                   | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| Open-Meteo                | Weather forecast and meteorological data |
| Open-Meteo Air Quality    | AQI and atmospheric information          |
| Google Gemini API         | AI conversational intelligence           |
| Open-Meteo Geocoding      | Place search                             |
| Nominatim / OpenStreetMap | Reverse geocoding                        |
| GDACS                     | Disaster/cyclone intelligence            |
| Leaflet                   | Interactive maps                         |
| OpenStreetMap             | Map tiles                                |
| Browser Geolocation API   | Device location                          |
| Web Speech API            | Voice input/output                       |

---

# 🔐 Security

WeatherGPT is designed with basic production-oriented security practices.

Implemented backend protections include:

* Helmet security headers
* Rate limiting
* AI-specific rate limiting
* JSON body size limits
* Environment variables for API keys
* Server-side Gemini API key handling
* Request IDs
* Input validation
* Timeout handling
* Error handling
* SQLite persistence

### Important

API keys should **never be placed directly inside frontend JavaScript**.

Use:

```env
GEMINI_API_KEY=your_api_key
```

inside the server environment.

---

# 💾 Database

WeatherGPT uses SQLite for lightweight persistence.

The database can store information such as:

* Search history
* AI conversations
* Saved places
* Weather snapshots

Database tables include:

```text
searches
ai_chats
saved_places
weather_snapshots
```

---

# 📂 Project Structure

```text
WeatherGPT/
│
├── public/
│   └── index.html
│
├── src/
│   ├── config/
│   │   └── env.js
│   │
│   ├── routes/
│   │   └── api.js
│   │
│   ├── services/
│   │   ├── weather.js
│   │   └── gemini.js
│   │
│   ├── db/
│   │   ├── index.js
│   │   └── schema.sql
│   │
│   ├── middleware/
│   │   └── security.js
│   │
│   └── utils/
│       └── http.js
│
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── Dockerfile
├── .dockerignore
├── README.md
├── DATABASE.md
└── ARCHITECTURE.txt
```

---

# ⚙️ Installation

## 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/WeatherGPT.git
cd WeatherGPT
```

## 2. Install dependencies

```bash
npm install
```

## 3. Create environment file

Create a `.env` file:

```env
NODE_ENV=development
PORT=3000

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

DB_PATH=./data/weathergpt.db

MAX_BODY_BYTES=128kb

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60

AI_RATE_LIMIT_MAX=12

WEATHER_CACHE_SECONDS=120

MAP_PROVIDER=leaflet-osm
```

## 4. Start the server

```bash
npm start
```

For development:

```bash
npm run dev
```

## 5. Open WeatherGPT

```text
http://localhost:3000
```

---

# 🩺 Health Check

The backend provides:

```text
GET /api/health
```

Example:

```text
http://localhost:3000/api/health
```

A successful response confirms that the backend is running.

---

# 🌐 Deployment

WeatherGPT can be deployed using a Node.js-compatible hosting platform such as Render.

### Recommended deployment architecture

```text
User Phone / Laptop
        ↓
HTTPS
        ↓
Render
        ↓
Node.js + Express
        ↓
Weather APIs + Gemini + GDACS
```

### Environment variables on deployment

Set:

```text
GEMINI_API_KEY
GEMINI_MODEL
NODE_ENV
PORT
DB_PATH
```

Never commit your real API keys to GitHub.

---

# 📱 Mobile Support

WeatherGPT is designed to work on:

* Android phones
* iPhones
* Tablets
* Laptops
* Desktop computers

The interface includes:

* responsive layout
* touch-friendly controls
* mobile navigation
* responsive maps
* mobile search
* responsive chat
* safe-area support for modern phones

For the best mobile experience, deploy the application using HTTPS.

---

# 🔄 AI Question Processing

Example:

```text
User:
"Will it rain tomorrow?"
        ↓
Natural Language Question
        ↓
Location Detection
        ↓
Weather API
        ↓
Structured Forecast Data
        ↓
AI Context Builder
        ↓
Gemini
        ↓
Safety / Accuracy Instructions
        ↓
Response in Selected Language
        ↓
User
```

---

# 🌾 Farmer Question Processing

Example:

```text
Farmer Question
       ↓
Language Detection / Selection
       ↓
Weather Context
       ↓
Forecast + Environmental Data
       ↓
Farmer Decision Logic
       ↓
Gemini Explanation
       ↓
Localized Response
```

The system provides weather-based guidance while avoiding unsupported chemical or pesticide dosage recommendations.

---

# 📊 Example Use Cases

### 👨‍🌾 Agriculture

A farmer can ask:

> "Is tomorrow suitable for irrigation?"

WeatherGPT can use forecast conditions to provide understandable guidance.

### 🚗 Travel

A traveler can ask:

> "Is it safe to travel tomorrow because of heavy rain?"

The system can combine forecast and risk information.

### 🏠 General Public

A user can ask:

> "What will the weather be like today?"

### 🌀 Disaster Awareness

A user can inspect cyclone and hazard information on the map.

### 🌡️ Extreme Weather

Users can receive understandable warnings for heat, rain, wind and other conditions.

---

# 💡 Innovation / USP

WeatherGPT is not simply:

```text
Chatbot + Weather API
```

The key innovation is the combination of:

### 1. Conversational Weather Intelligence

Users ask questions naturally instead of navigating complicated weather dashboards.

### 2. Warning-First Architecture

Critical weather and hazard information is prioritized separately from free-form AI generation.

### 3. Anti-Hallucination Design

Weather values come from structured data and the AI is used primarily for interpretation and communication.

### 4. Indian Language Accessibility

Weather information can be communicated in multiple Indian languages.

### 5. Voice Accessibility

Users can interact through speech.

### 6. Agriculture Decision Support

Weather information is transformed into understandable farming-oriented guidance.

### 7. Disaster Intelligence

Cyclone and hazard information can be visualized alongside weather information.

---

# 📈 Feasibility

## Technical Feasibility

The project uses established technologies:

* Node.js
* Express
* JavaScript
* REST APIs
* Gemini
* Open-Meteo
* Leaflet
* SQLite

Therefore the architecture can be implemented and extended using widely available development tools.

## Operational Feasibility

The system is web-based and can be accessed from mobile or desktop devices.

## Economic Feasibility

The architecture uses lightweight open technologies and APIs, reducing infrastructure requirements for an initial deployment.

---

# 🌍 Social Impact

Weather information can affect:

* farmers
* travelers
* students
* outdoor workers
* disaster-management teams
* rural communities
* general citizens

WeatherGPT aims to make important weather information easier to understand and act upon.

---

# 🎯 Benefits

### For Farmers

* Better weather awareness
* Weather-based planning
* Regional-language accessibility
* Voice interaction

### For Citizens

* Simple weather explanations
* Risk awareness
* Local weather intelligence

### For Travelers

* Weather-aware travel planning
* Risk information

### For Disaster Awareness

* Cyclone visualization
* Hazard information
* Weather risk communication

---

# 🔮 Future Scope

Future versions can include:

* IMD warning integration
* More official disaster-management sources
* More Indian languages
* Advanced satellite imagery
* ML-based local weather risk prediction
* Personalized farmer profiles
* Crop-specific weather intelligence
* SMS/WhatsApp alerts
* Offline/low-connectivity support
* IoT weather-station integration
* Advanced climate analytics
* Long-term climate trend analysis
* PWA/mobile application
* Push notifications

---

# ⚠️ Limitations

WeatherGPT depends on the availability and quality of external weather and disaster-data services.

AI-generated explanations should not replace:

* official emergency warnings
* meteorological authorities
* professional agricultural advice
* emergency services

For critical situations, users should follow official government and disaster-management instructions.

---

# 🧪 Testing

Testing should cover:

### Functional Testing

* Weather search
* Location detection
* Forecast
* AI chat
* Farmer Mode
* Map
* Cyclones
* Voice
* Language switching

### API Testing

```text
/api/health
/api/geocode
/api/reverse-geocode
/api/weather
/api/air-quality
/api/ai
/api/places
/api/history
/api/chats
/api/map-config
/api/cyclones
```

### Failure Testing

Test:

* No internet
* API timeout
* Invalid location
* Missing API key
* AI unavailable
* Location permission denied
* Empty search
* Mobile screen sizes

---

# 🏆 SIH Demonstration Flow

For the SIH presentation, the recommended demonstration sequence is:

```text
1. Open WeatherGPT
        ↓
2. Detect/Search location
        ↓
3. Show current weather
        ↓
4. Ask AI a weather question
        ↓
5. Switch language
        ↓
6. Ask the same question again
        ↓
7. Demonstrate voice
        ↓
8. Open Farmer Mode
        ↓
9. Show Risk & Alerts
        ↓
10. Open India Weather Map
        ↓
11. Show cyclone information
        ↓
12. Demonstrate travel/weather planning
```

---

# 🎤 SIH One-Minute Introduction

> **Weather information is available, but it is fragmented and often difficult to understand. WeatherGPT brings weather, forecasts, warnings and climate information into one conversational platform. Users can simply ask questions through text or voice, in their preferred Indian language, and receive location-specific answers grounded in structured weather data. Our warning-first architecture prioritizes critical information, while our anti-hallucination approach prevents the AI from inventing weather values. We extend this platform to agriculture, travel, disaster awareness and weather-risk intelligence, making complex meteorological information simple, accessible and actionable.**

---

# 🤝 Team

## Syntax Squad

**Smart India Hackathon Project**

### Project

**WeatherGPT — AI Weather Intelligence & Decision Support Platform**

### SIH Problem Statement

**SIH26068**

---

# 📚 References

* Open-Meteo — Weather and Forecast Data
* Open-Meteo Air Quality API
* Google Gemini API
* OpenStreetMap
* Nominatim
* Leaflet
* GDACS
* Browser Geolocation API
* Web Speech API

---

# ⚖️ Disclaimer

WeatherGPT is a technology demonstration and decision-support platform.

Weather forecasts and environmental information may change over time. Users should rely on official government and meteorological authorities for critical warnings and emergency decisions.

The AI component is intended to **explain and contextualize weather information**, not replace professional meteorological, agricultural or emergency-management expertise.

---

# ⭐ Project Vision

> **Make weather intelligence understandable, accessible and actionable for everyone.**

**WeatherGPT — Ask the Weather. Understand the Risk. Make Better Decisions.**

---

## ⭐ If you find this project useful

Star ⭐ the repository and follow the project for future improvements.

**Built for Smart India Hackathon 🚀**
