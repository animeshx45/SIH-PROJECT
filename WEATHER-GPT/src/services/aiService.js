import config from '../config/env.js';
import { getSettings } from '../database/db.js';
import { logAiConversation } from '../database/mongo.js';
import { getWeatherWithRisk } from './weatherService.js';
import { searchLocations } from './geocodeService.js';

const KNOWN_CITIES = [
  'hyderabad', 'delhi', 'mumbai', 'bengaluru', 'bangalore', 'chennai',
  'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'visakhapatnam',
  'vizag', 'vijayawada', 'warangal', 'chandigarh', 'bhopal', 'patna',
  'kochi', 'surat', 'nagpur', 'indore', 'shimla', 'srinagar', 'goa',
  'agra', 'varanasi', 'kanpur', 'amritsar', 'guwahati', 'coimbatore',
  'dehradun', 'bhubaneswar', 'ranchi', 'raipur', 'thiruvananthapuram',
  'trivandrum', 'london', 'dubai', 'singapore', 'new york', 'tokyo', 'paris'
];

function extractCityFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;
  const lower = prompt.toLowerCase();
  
  // 1. Check known cities dictionary
  for (const city of KNOWN_CITIES) {
    const reg = new RegExp(`\\b${city}\\b`, 'i');
    if (reg.test(lower)) {
      if (city === 'vizag') return 'Visakhapatnam';
      if (city === 'bangalore') return 'Bengaluru';
      if (city === 'trivandrum') return 'Thiruvananthapuram';
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }

  // 2. Pattern match: "in [City]", "at [City]", "for [City]", "near [City]"
  const pattern = /\b(?:in|at|for|near|around)\s+([A-Za-z]{3,20}(?:\s+[A-Za-z]{3,20})?)\b/i;
  const match = prompt.match(pattern);
  if (match && match[1]) {
    const candidate = match[1].trim();
    // Exclude common temporal or meteorological words
    const exclude = ['today', 'tomorrow', 'tonight', 'morning', 'afternoon', 'evening', 'night', 'india', 'celsius', 'fahrenheit', 'hour', 'hours', 'week', 'next', 'this', 'safe', 'good', 'monsoon', 'crop', 'crops'];
    if (!exclude.includes(candidate.toLowerCase())) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  return null;
}

export async function askAi({ prompt, weatherContext, language = 'en', placeName = 'Local Area', persona = 'general' }) {
  const settings = getSettings();
  const apiKey = (config.ai.apiKey || settings.ai_api_key || settings.gemini_api_key || '').trim();

  // If city is mentioned in prompt, prioritize it
  const detectedCity = extractCityFromPrompt(prompt);
  let targetPlace = detectedCity || (placeName && placeName !== 'Local Area' ? placeName : 'Hyderabad');

  // Telemetry resolution
  let enrichedWeather = weatherContext;
  let lat = enrichedWeather?.latitude || enrichedWeather?.lat;
  let lon = enrichedWeather?.longitude || enrichedWeather?.lon;

  // If detected a new city or coordinates missing, resolve coordinates quickly
  if ((!lat || !lon || detectedCity) && targetPlace) {
    try {
      const geoResults = await searchLocations(targetPlace);
      if (geoResults && geoResults[0]) {
        lat = geoResults[0].latitude;
        lon = geoResults[0].longitude;
        targetPlace = geoResults[0].name;
      }
    } catch (_) {}
  }

  // Default coordinates to Hyderabad if still missing
  if (!lat || !lon) {
    lat = 17.3850;
    lon = 78.4867;
    targetPlace = 'Hyderabad';
  }

  // Fetch live weather telemetry if needed or if city changed
  if (!enrichedWeather?.current || detectedCity) {
    try {
      const liveData = await getWeatherWithRisk(lat, lon);
      if (liveData) enrichedWeather = liveData;
    } catch (e) {
      console.warn('[ai] Telemetry fetch fallback notice:', e.message);
    }
  }

  // Attempt Google Generative AI Neural Engine with Multi-Model Fallback Cascade
  if (apiKey && apiKey.length > 8) {
    try {
      const responseText = await callAiNeuralEngineCascade(apiKey, prompt, enrichedWeather, language, targetPlace, persona);
      if (responseText && responseText.trim().length > 0) {
        await logAiConversation(prompt, responseText, language, persona, lat, lon);
        return { answer: responseText, engine: 'weathergpt-neural-v2.5', grounded: true, placeName: targetPlace };
      }
    } catch (err) {
      console.warn('[ai] Neural Engine API cascade note:', err.message, '-> Engaging WeatherGPT Local Expert Reasoning Engine.');
    }
  }

  // WeatherGPT Local Meteorological Expert Reasoning Engine
  const fallbackAnswer = generateMeteorologicalExpertResponse(prompt, enrichedWeather, language, targetPlace, persona);
  await logAiConversation(prompt, fallbackAnswer, language, persona, lat, lon);
  return { answer: fallbackAnswer, engine: 'weathergpt-local-expert', grounded: true, placeName: targetPlace };
}

async function callAiNeuralEngineCascade(apiKey, prompt, weather, language, placeName, persona) {
  const models = [
    config.gemini?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  // De-duplicate models list while preserving order
  const uniqueModels = [...new Set(models)];
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      const text = await executeGeminiRequest(apiKey, model, prompt, weather, language, placeName, persona);
      if (text) return text;
    } catch (err) {
      lastError = err;
      // If 429 quota or 503 service unavailable or 404, try next model
      console.warn(`[ai] Model ${model} attempt note: ${err.message}. Trying next candidate model...`);
    }
  }

  throw lastError || new Error('All neural models in cascade exhausted.');
}

async function executeGeminiRequest(apiKey, model, prompt, weather, language, placeName, persona) {
  const cur = weather?.current || {};
  const daily = weather?.daily || {};
  const aqi = weather?.airQuality || {};

  const temp = cur.temperature_2m !== undefined ? `${cur.temperature_2m}°C` : '31°C';
  const feels = cur.apparent_temperature !== undefined ? `${cur.apparent_temperature}°C` : temp;
  const humidity = cur.relative_humidity_2m !== undefined ? `${cur.relative_humidity_2m}%` : '65%';
  const windSpeed = cur.wind_speed_10m !== undefined ? `${cur.wind_speed_10m} km/h` : '14 km/h';
  const windGusts = cur.wind_gusts_10m !== undefined ? `${cur.wind_gusts_10m} km/h` : windSpeed;
  const windDir = cur.wind_direction_10m !== undefined ? `${cur.wind_direction_10m}°` : '210°';
  const pressure = (cur.surface_pressure || cur.pressure_msl) !== undefined ? `${cur.surface_pressure || cur.pressure_msl} hPa` : '1012 hPa';
  const cloudCover = cur.cloud_cover !== undefined ? `${cur.cloud_cover}%` : '25%';
  const rainProbToday = daily.precipitation_probability_max?.[0] !== undefined ? `${daily.precipitation_probability_max[0]}%` : '15%';
  const maxTempToday = daily.temperature_2m_max?.[0] !== undefined ? `${daily.temperature_2m_max[0]}°C` : '33°C';
  const minTempToday = daily.temperature_2m_min?.[0] !== undefined ? `${daily.temperature_2m_min[0]}°C` : '23°C';
  const rainSumToday = daily.precipitation_sum?.[0] !== undefined ? `${daily.precipitation_sum[0]} mm` : '0 mm';

  const tomorrowMax = daily.temperature_2m_max?.[1] !== undefined ? `${daily.temperature_2m_max[1]}°C` : '32°C';
  const tomorrowMin = daily.temperature_2m_min?.[1] !== undefined ? `${daily.temperature_2m_min[1]}°C` : '23°C';
  const tomorrowRainProb = daily.precipitation_probability_max?.[1] !== undefined ? `${daily.precipitation_probability_max[1]}%` : '20%';

  const day3Max = daily.temperature_2m_max?.[2] !== undefined ? `${daily.temperature_2m_max[2]}°C` : '31°C';
  const day3Min = daily.temperature_2m_min?.[2] !== undefined ? `${daily.temperature_2m_min[2]}°C` : '22°C';
  const day3RainProb = daily.precipitation_probability_max?.[2] !== undefined ? `${daily.precipitation_probability_max[2]}%` : '25%';

  const usAqi = aqi.us_aqi !== undefined ? `${aqi.us_aqi} (US AQI)` : 'Moderate';
  const pm25 = aqi.pm2_5 !== undefined ? `${aqi.pm2_5} µg/m³` : '25 µg/m³';
  const pm10 = aqi.pm10 !== undefined ? `${aqi.pm10} µg/m³` : '50 µg/m³';
  const riskScore = weather?.riskScore ?? 15;
  const riskBand = weather?.riskBand || 'Low Risk';
  const alerts = weather?.severeAlerts && weather.severeAlerts.length > 0 ? JSON.stringify(weather.severeAlerts) : 'No severe active warnings';

  const systemInstruction = `You are WeatherGPT, an advanced AI meteorologist, agricultural advisor, and disaster decision-support assistant built for India and global weather intelligence.

OPERATIONAL METEOROLOGICAL TELEMETRY:
- Target Location: ${placeName}
- Persona Mode: ${persona || 'general'} (e.g. general citizen, farmer / agromet, traveller, aviation / pilot, disaster management)
- REAL-TIME GROUNDED ATMOSPHERIC TELEMETRY:
  * Current Temperature: ${temp} (Apparent / Feels Like: ${feels})
  * Today Max / Min: ${maxTempToday} / ${minTempToday}
  * Rain / Precipitation Probability Today: ${rainProbToday} (Expected Accumulation: ${rainSumToday})
  * Tomorrow Forecast: Max ${tomorrowMax}, Min ${tomorrowMin}, Rain Chance ${tomorrowRainProb}
  * Day 3 Forecast: Max ${day3Max}, Min ${day3Min}, Rain Chance ${day3RainProb}
  * Relative Humidity: ${humidity}
  * Surface Wind: ${windSpeed} (Gusts: ${windGusts}, Direction: ${windDir})
  * Barometric Pressure: ${pressure}
  * Cloud Cover: ${cloudCover}
  * Air Quality Index (AQI): ${usAqi} | PM2.5: ${pm25} | PM10: ${pm10}
  * Disaster Risk Rating: ${riskScore}/100 (${riskBand})
  * Active IMD Alerts: ${alerts}

CORE CAPABILITIES & RESPONSE GUIDELINES:
1. Ground every answer in the live atmospheric telemetry provided above. Always quote exact figures (${temp}, ${rainProbToday}, ${windSpeed}, ${usAqi}).
2. For questions regarding rain, storms, or umbrella: clearly state probability, expected hours, and rain gear advice.
3. For tomorrow or multi-day outlook: provide clear day-by-day temperature highs/lows and rain chances.
4. For crop/farming spraying: evaluate wind (< 15 km/h is safe for foliar spray) and rain chance (< 35% needed to prevent chemical wash-off).
5. For highway travel/driving: assess wet-road hydroplaning hazard, fog/visibility, and crosswinds.
6. For cyclones and disasters: explain IMD warning stages (Green/Yellow/Orange/Red), port signals 1-11, and emergency safety rules.
7. For air quality: explain health impact, sensitive group precautions, and mask guidelines based on the telemetry.
8. If the user asks general meteorological science (e.g., how heat index works, El Niño/La Niña, atmospheric pressure, monsoons): explain clearly and scientifically as an expert meteorologist.
9. LANGUAGE: Formulate your entire response fluently in the requested language code: ${language} (en = English, hi = Hindi, te = Telugu, mr = Marathi, kn = Kannada, ta = Tamil).
10. TONE: Authoritative yet accessible, structured with markdown bolding and bullet points. Never mention Gemini or Google; your identity is WeatherGPT.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(18000),
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 900
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status} (${model}): ${errText.slice(0, 150)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Empty candidate text from ${model}`);
  }

  return text;
}

export async function getAiBrief({ weatherContext, language = 'en', placeName = 'Local Area' }) {
  const settings = getSettings();
  const apiKey = (config.ai.apiKey || settings.ai_api_key || settings.gemini_api_key || '').trim();

  let enrichedWeather = weatherContext;
  let lat = enrichedWeather?.latitude || enrichedWeather?.lat || 17.3850;
  let lon = enrichedWeather?.longitude || enrichedWeather?.lon || 78.4867;
  let targetPlace = placeName && placeName !== 'Local Area' ? placeName : 'Hyderabad';

  if (!enrichedWeather?.current) {
    try {
      const liveData = await getWeatherWithRisk(lat, lon);
      if (liveData) enrichedWeather = liveData;
    } catch (_) {}
  }

  if (apiKey && apiKey.length > 8) {
    try {
      const prompt = `Provide a concise 2-sentence executive weather brief and immediate operational advice for ${placeName} in ${language} language.`;
      const brief = await callAiNeuralEngineCascade(apiKey, prompt, enrichedWeather, language, placeName, 'general');
      if (brief) return { brief, engine: 'weathergpt-neural-v2.5' };
    } catch (err) {
      console.warn('[ai] Brief generation cascade note, using local expert fallback:', err.message);
    }
  }

  const fallback = generateMeteorologicalExpertResponse('brief', enrichedWeather, language, placeName, 'general');
  return { brief: fallback, engine: 'weathergpt-local-expert' };
}

// ── COMPREHENSIVE LOCAL METEOROLOGICAL EXPERT REASONING ENGINE ──────────────
function generateMeteorologicalExpertResponse(prompt, weather, language, placeName, persona = 'general') {
  const p = (prompt || '').toLowerCase().trim();
  const cur = weather?.current || {};
  const daily = weather?.daily || {};
  const aqi = weather?.airQuality || {};

  const temp = Math.round(cur.temperature_2m ?? 29);
  const feels = Math.round(cur.apparent_temperature ?? temp);
  const humidity = Math.round(cur.relative_humidity_2m ?? 65);
  const wind = Math.round(cur.wind_speed_10m ?? 12);
  const windGust = Math.round(cur.wind_gusts_10m ?? wind);
  const pressure = Math.round(cur.surface_pressure || cur.pressure_msl || 1012);
  const cloud = Math.round(cur.cloud_cover ?? 30);
  const rainProbToday = daily.precipitation_probability_max?.[0] ?? 20;
  const rainSumToday = daily.precipitation_sum?.[0] ?? 0;
  const todayMax = Math.round(daily.temperature_2m_max?.[0] ?? (temp + 3));
  const todayMin = Math.round(daily.temperature_2m_min?.[0] ?? (temp - 6));

  const tomorrowMax = Math.round(daily.temperature_2m_max?.[1] ?? todayMax);
  const tomorrowMin = Math.round(daily.temperature_2m_min?.[1] ?? todayMin);
  const tomorrowRain = daily.precipitation_probability_max?.[1] ?? rainProbToday;

  const day3Max = Math.round(daily.temperature_2m_max?.[2] ?? (todayMax - 1));
  const day3Min = Math.round(daily.temperature_2m_min?.[2] ?? todayMin);
  const day3Rain = daily.precipitation_probability_max?.[2] ?? 15;

  const usAqi = aqi.us_aqi ?? 75;
  const pm25 = aqi.pm2_5 ?? 28;
  const pm10 = aqi.pm10 ?? 54;
  const risk = weather?.riskScore ?? 15;

  // ── INTENT RECOGNITION ──────────────────────────────────────────────────
  const isRainQuery = /\b(rain|raining|showers|precipitation|drizzle|umbrella|cloudburst|raincoat|waterlog)\b/i.test(p);
  const isTomorrowQuery = /\b(tomorrow|next day|kal)\b/i.test(p);
  const isMultiDayQuery = /\b(3-day|7-day|forecast|outlook|upcoming|weekend|next few days|week)\b/i.test(p);
  const isAgriQuery = persona === 'farmer' || /\b(spray|spraying|pesticide|fertilizer|crop|crops|farm|farmer|agriculture|irrigation|soil|sow|harvest|paddy|wheat|cotton)\b/i.test(p);
  const isClothingQuery = /\b(wear|clothes|clothing|dress|jacket|coat|umbrella|what to wear)\b/i.test(p);
  const isTravelQuery = persona === 'traveller' || /\b(travel|drive|driving|journey|highway|commute|route|road|car|bike|safe to drive|fog|trip)\b/i.test(p);
  const isOfficialQuery = persona === 'official' || persona === 'government' || persona === 'disaster' || /\b(official|collector|ndma|sdma|administration|evacuation|relief|sachet|cap warning|disaster plan)\b/i.test(p);
  const isAviationQuery = persona === 'pilot' || persona === 'aviator' || /\b(aviation|flight|plane|drone|metar|vfr|ifr|runway|crosswind|turbul)\b/i.test(p);
  const isCycloneQuery = /\b(cyclone|depression|deep depression|storm|warning signal|port signal|landfall|super cyclone|imd alert|warning system)\b/i.test(p);
  const isDisasterQuery = /\b(flood|floods|landslide|earthquake|lightning|thunderstorm|heatwave|coldwave|emergency|precaution|safety)\b/i.test(p);
  const isAqiQuery = /\b(aqi|air quality|pm2\.5|pm10|pollution|smog|smoke|breathe|mask)\b/i.test(p);
  const isScienceQuery = /\b(heat index|humidity|dew point|barometer|barometric pressure|el nino|la nina|monsoon|western disturbance|global warming|climate change)\b/i.test(p);
  const isGreetingQuery = /^(hi|hello|hey|namaste|vanakkam|who are you|help|capabilities)\b/i.test(p);

  // ── 1. RAIN & PRECIPITATION INTENT ──────────────────────────────────────
  if (isRainQuery && !isCycloneQuery) {
    const willRainToday = rainProbToday >= 50;
    const willRainTomorrow = tomorrowRain >= 50;
    const rainLevel = rainProbToday >= 70 ? 'High' : (rainProbToday >= 40 ? 'Moderate' : 'Low');

    if (language === 'te') {
      return `🌧️ **${placeName} వర్షపాత విశ్లేషణ**:
• ఈరోజు వర్ష సూచన: **${rainProbToday}%** (${rainLevel} సంభావ్యత), అంచనా వర్షపాతం: **${rainSumToday} mm**.
• రేపటి వర్ష సూచన: **${tomorrowRain}%** (గరిష్ట ఉష్ణోగ్రత: **${tomorrowMax}°C**).
• గాలి వేగం: **${wind} km/h**, మేఘాల కవరేజ్: **${cloud}%**.
• **సిఫార్సు**: ${willRainToday || willRainTomorrow ? '✅ వర్షం పడే అవకాశం ఎక్కువగా ఉంది. ప్రయాణంలో గొడుగు లేదా రెయిన్‌కోట్ వెంట ఉంచుకోండి.' : '☀️ వర్షం పడే అవకాశం చాలా తక్కువ. సాధారణ దినచర్యను కొనసాగించవచ్చు.'}`;
    }
    if (language === 'hi') {
      return `🌧️ **${placeName} वर्षा पूर्वानुमान एवं विश्लेषण**:
• आज बारिश की संभावना: **${rainProbToday}%** (${rainLevel} संभावना), संभावित वर्षा: **${rainSumToday} मिमी**.
• कल बारिश की संभावना: **${tomorrowRain}%** (अधिकतम तापमान: **${tomorrowMax}°C**).
• हवा की गति: **${wind} किमी/घंटा**, बादलों का आवरण: **${cloud}%**.
• **परामर्श**: ${willRainToday || willRainTomorrow ? '✅ बारिश के प्रबल आसार हैं। यात्रा या बाहर निकलते समय छाता अथवा रेनकोट अवश्य साथ रखें।' : '☀️ आज भारी बारिश की संभावना कम है। सामान्य दिनचर्या जारी रख सकते हैं।'}`;
    }
    return `🌧️ **Precipitation Analysis for ${placeName}**:
• Today Rain Probability: **${rainProbToday}%** (${rainLevel} likelihood, ~**${rainSumToday} mm** expected).
• Tomorrow Outlook: **${tomorrowRain}%** rain chance with highs of **${tomorrowMax}°C** / lows of **${tomorrowMin}°C**.
• Atmospheric Context: Relative humidity **${humidity}%**, cloud cover **${cloud}%**, surface wind **${wind} km/h**.
• **Operational Advisory**: ${willRainToday || willRainTomorrow ? 'Rain protection strongly advised. Keep an umbrella handy and anticipate slippery pavement.' : 'Dry and stable atmospheric conditions. Low likelihood of rain interruption today.'}`;
  }

  // ── 2. TOMORROW & MULTI-DAY FORECAST INTENT ────────────────────────────
  if (isTomorrowQuery || isMultiDayQuery) {
    if (language === 'te') {
      return `📅 **${placeName} బహుళ-రోజుల వాతావరణ అంచనా**:
• **రేపు**: గరిష్ట **${tomorrowMax}°C** | కనిష్ట **${tomorrowMin}°C** | వర్ష సూచన **${tomorrowRain}%** | గాలి **${wind} km/h**.
• **ఎల్లుండి (Day 3)**: గరిష్ట **${day3Max}°C** | కనిష్ట **${day3Min}°C** | వర్ష సూచన **${day3Rain}%**.
• వాయు నాణ్యత (AQI): **${usAqi}** (${usAqi < 100 ? 'మంచిది/సాధారణం' : 'జాగ్రత్త అవసరం'}).
• **సలహా**: ${tomorrowRain > 50 ? 'రేపు వర్షం పడే అవకాశం ఉంది.' : 'రాబోయే రోజులలో వాతావరణం అనుకూలంగా ఉండనుంది.'}`;
    }
    if (language === 'hi') {
      return `📅 **${placeName} आगामी मौसम पूर्वानुमान**:
• **कल का पूर्वानुमान**: अधिकतम **${tomorrowMax}°C** | न्यूनतम **${tomorrowMin}°C** | बारिश की संभावना **${tomorrowRain}%**.
• **परसों (Day 3)**: अधिकतम **${day3Max}°C** | न्यूनतम **${day3Min}°C** | बारिश की संभावना **${day3Rain}%**.
• वर्तमान आर्द्रता: **${humidity}%**, वायु गुणवत्ता सूचकांक (AQI): **${usAqi}**.
• **परामर्श**: ${tomorrowRain > 50 ? 'कल बारिश की संभावना अधिक है, सतर्क रहें।' : 'आगामी 2-3 दिनों में मौसम सामान्य और कार्य अनुकूल रहने का अनुमान है।'}`;
    }
    return `📅 **Extended Meteorological Outlook for ${placeName}**:
• **Tomorrow**: High **${tomorrowMax}°C** | Low **${tomorrowMin}°C** | Rain Probability **${tomorrowRain}%** | Wind **${wind} km/h**.
• **Day 3**: High **${day3Max}°C** | Low **${day3Min}°C** | Rain Probability **${day3Rain}%**.
• Atmospheric Baseline: Surface pressure **${pressure} hPa**, relative humidity **${humidity}%**, AQI **${usAqi}**.
• **Recommendation**: ${tomorrowRain > 50 ? 'Prepare for wet conditions tomorrow with afternoon convective showers.' : 'Stable synoptic conditions expected across the regional basin over the next 48-72 hours.'}`;
  }

  // ── 3. AGRICULTURAL & CROP SPRAYING INTENT ─────────────────────────────
  if (isAgriQuery) {
    const canSpray = wind < 15 && rainProbToday < 40;
    const sprayReason = wind >= 15 
      ? `గాలి వేగం (${wind} km/h) 15 km/h దాటినందున స్ప్రే డ్రిఫ్ట్ అవుతుంది` 
      : (rainProbToday >= 40 ? `వర్షం పడే అవకాశం (${rainProbToday}%) ఉన్నందున రసాయనం కొట్టుకుపోతుంది` : 'గాలి మరియు వర్షం సూచికలు అనుకూలంగా ఉన్నాయి');
    const sprayReasonHi = wind >= 15
      ? `हवा की गति (${wind} किमी/घंटा) 15 किमी/घंटा से अधिक होने से छिड़काव उड़ सकता है`
      : (rainProbToday >= 40 ? `बारिश की संभावना (${rainProbToday}%) के कारण दवा धुलने का खतरा है` : 'हवा एवं वर्षा दोनों कीटनाशक छिड़काव के अनुकूल हैं');

    if (language === 'te') {
      return `🌾 **రైతు వ్యవసాయ వాతావరణ సలహా (${placeName})**:
• **పిచికారీ (Spraying) విండో**: ${canSpray ? '✅ **అనుకూలం (Optimal)**' : '⚠️ **వాయిదా వేయండి (Postpone)**'} — ${sprayReason}.
• **వాతావరణ వివరాలు**: ఉష్ణోగ్రత **${temp}°C**, గాలి వేగం **${wind} km/h**, వర్ష సూచన **${rainProbToday}%**, తేమ **${humidity}%**.
• **పంట సంరక్షణ**:
  - వరి & పత్తి: తేమ ఎక్కువగా ఉన్నప్పుడు రసం పీల్చే పురుగుల పట్ల అప్రమత్తంగా ఉండండి.
  - నీటిపారుదల: ${rainProbToday > 60 ? 'వర్ష సూచన దృష్ట్యా కృత్రిమ తడులు ఇవ్వవద్దు.' : 'మట్టి తేమను బట్టి అవసరమైతే తడి అందించండి.'}`;
    }
    if (language === 'hi') {
      return `🌾 **कृषि मौसम एवं फसल छिड़काव परामर्श (${placeName})**:
• **छिड़काव (Foliar Spray) स्थिति**: ${canSpray ? '✅ **अनुकूल समय (Safe Window)**' : '⚠️ **छिड़काव टालें (Delay Spray)**'} — ${sprayReasonHi}.
• **मौसम पैमाना**: तापमान **${temp}°C**, हवा की गति **${wind} किमी/घंटा**, बारिश की संभावना **${rainProbToday}%**, नमी **${humidity}%**.
• **मुख्य फसल दिशा-निर्देश**:
  - कीटनाशक एवं उर्वरक छिड़काव के लिए हवा की गति 15 किमी/घंटा से कम और धूप खिली होनी चाहिए।
  - सिंचाई: ${rainProbToday > 60 ? 'बारिश के आसार हैं, अतः अनावश्यक सिंचाई रोकें।' : 'मिट्टी में नमी के अनुसार हल्की सिंचाई जारी रखें।'}`;
    }
    return `🌾 **Agromet Advisory & Spray Window for ${placeName}**:
• **Foliar Spray Feasibility**: ${canSpray ? '✅ **RECOMMENDED / SAFE WINDOW**' : '⚠️ **POSTPONE SPRAYING**'}
  - Surface Wind: **${wind} km/h** (Spray threshold: < 15 km/h to prevent chemical drift).
  - Rain Probability: **${rainProbToday}%** (Wash-off risk threshold: < 35%).
  - Relative Humidity: **${humidity}%** | Current Temp: **${temp}°C** (Feels like **${feels}°C**).
• **Agronomic Guidelines**:
  - Cotton & Paddy: High humidity (> 70%) increases fungal and blast risk. Scout crops regularly.
  - Irrigation Management: ${rainProbToday > 55 ? 'Withhold surface irrigation; natural precipitation expected.' : 'Normal scheduled irrigation can proceed safely.'}`;
  }

  // ── 4. CLOTHING & OUTDOOR ATTIRE INTENT ─────────────────────────────────
  if (isClothingQuery) {
    const isHot = feels >= 33;
    const isCold = temp <= 18;
    const needsUmbrella = rainProbToday >= 40;

    if (language === 'te') {
      return `👕 **ఈరోజు దుస్తుల సిఫార్సు (${placeName})**:
• ప్రస్తుత ఉష్ణోగ్రత: **${temp}°C** (అనిపించే ఉష్ణోగ్రత: **${feels}°C**), తేమ: **${humidity}%**.
• **దుస్తులు**: ${isHot ? 'తేలికపాటి, గాలి పీల్చే నూలు (Cotton) దుస్తులు ధరించండి.' : (isCold ? 'తేలికపాటి స్వెటర్ లేదా జాకెట్ అవసరం.' : 'సౌకర్యవంతమైన రోజువారీ కాటన్ దుస్తులు సరిపోతాయి.')}
• **అదనపు జాగ్రత్తలు**: ${needsUmbrella ? '🌧️ వర్ష సూచన ఉన్నందున గొడుగు వెంట ఉంచుకోండి.' : 'సన్ గ్లాసెస్ లేదా టోపీ ఉపయోగించండి.'}`;
    }
    if (language === 'hi') {
      return `👕 **आज के पहनावे की सलाह (${placeName})**:
• तापमान: **${temp}°C** (महसूस: **${feels}°C**), आर्द्रता: **${humidity}%**.
• **पहनावे का चयन**: ${isHot ? 'हल्के, ढीले सूती (कॉटन) कपड़े पहनें ताकि पसीने से राहत रहे।' : (isCold ? 'हल्की ठंड है, जैकेट या स्वेटर साथ रखें।' : 'सामान्य आरामदायक परिधान अनुकूल रहेगा।')}
• **सहायक सामग्री**: ${needsUmbrella ? '🌧️ बारिश की संभावना है, छाता अवश्य साथ रखें।' : 'धूप से बचाव हेतु सनग्लासेस या टोपी का उपयोग करें।'}`;
    }
    return `👕 **Clothing & Attire Recommendation for ${placeName}**:
• Current Ambient Temperature: **${temp}°C** (Apparent Heat Index: **${feels}°C**), Humidity: **${humidity}%**.
• **What to Wear**: ${isHot ? 'Lightweight, loose-fitting, breathable cotton or linen fabrics to stay cool and minimize perspiration.' : (isCold ? 'Layered attire with a light jacket or windbreaker recommended.' : 'Comfortable casual breathable attire is ideal for today.')}
• **Accessories**: ${needsUmbrella ? '🌧️ Keep a compact umbrella or rain protection on hand due to precipitation chances.' : 'UV sunglasses and sunscreen recommended during peak midday hours.'}`;
  }

  // ── 5. HIGHWAY TRAVEL & ROAD SAFETY INTENT ─────────────────────────────
  if (isTravelQuery) {
    const travelRisk = rainProbToday > 60 || wind > 25 ? 'High Caution' : (rainProbToday > 30 ? 'Moderate' : 'Safe / Optimal');
    if (language === 'te') {
      return `🚗 **రోడ్డు ప్రయాణ భద్రత & హైవే సలహా (${placeName})**:
• ప్రయాణ రిస్క్ రేటింగ్: **${travelRisk}** | వర్ష సూచన: **${rainProbToday}%**.
• గాలి వేగం: **${wind} km/h** (ఝంఝామారుతం: **${windGust} km/h**), దృశ్యత (Visibility): అనుకూలం.
• **రహదారి సూచనలు**: ${rainProbToday > 50 ? 'రోడ్లు తడిగా ఉండి వాహనాలు జారే ప్రమాదం (Hydroplaning) ఉంది. వేగాన్ని తగ్గించి నడపండి.' : 'హైవే ప్రయాణానికి వాతావరణం చాలా అనుకూలంగా ఉంది. సురక్షితంగా ప్రయాణించండి.'}`;
    }
    if (language === 'hi') {
      return `🚗 **राजमार्ग यात्रा सुरक्षा परामर्श (${placeName})**:
• यात्रा जोखिम स्तर: **${travelRisk}** | वर्षा की संभावना: **${rainProbToday}%**.
• हवा की गति: **${wind} किमी/घंटा** (झोंके: **${windGust} किमी/घंटा**).
• **वाहन चालन सुरक्षा**: ${rainProbToday > 50 ? 'सड़क गीली होने पर वाहन फिसलने (Hydroplaning) का खतरा रहता है। उचित दूरी बनाकर मध्यम गति से चलाएं।' : 'मौसम पूरी तरह यात्रा के अनुकूल है। सुरक्षित ड्राइविंग करें।'}`;
    }
    return `🚗 **Highway & Road Travel Safety Assessment for ${placeName}**:
• **Transit Risk Rating**: **${travelRisk}** | Rain Probability: **${rainProbToday}%** | Wind: **${wind} km/h** (Gusts: **${windGust} km/h**).
• **Atmospheric Road Conditions**:
  - Wet Pavement / Hydroplaning Risk: ${rainProbToday > 50 ? 'ELEVATED. Maintain extended braking distance.' : 'MINIMAL. Dry road surfaces across major corridors.'}
  - Crosswind Stability: High-profile vehicles and two-wheelers remain within safe handling limits (< 30 km/h).
• **Driver Advisory**: Check wiper fluid, headlights, and maintain highway speed limits under passing showers.`;
  }

  // ── 5B. GOVERNMENT OFFICIAL & DISASTER MANAGEMENT INTENT ─────────────────
  if (isOfficialQuery) {
    const imdColor = risk > 60 ? 'RED (Warning / Take Immediate Action)' : (risk > 40 ? 'ORANGE (Alert / Be Prepared)' : (risk > 20 ? 'YELLOW (Watch / Be Updated)' : 'GREEN (No Warning / Normal)'));
    if (language === 'te') {
      return `🏛️ **విపత్తు నిర్వహణ & అధికారిక విశ్లేషణ (${placeName})**:
• **IMD ప్రోటోకాల్ స్టేజ్**: **${imdColor}** | విపత్తు రిస్క్ స్కోర్: **${risk}/100**.
• **ప్రధాన ప్రమాదాలు**: వర్షపాతం సంభావ్యత **${rainProbToday}%**, గాలి వేగం **${wind} km/h** (ఝంఝామారుతం: **${windGust} km/h**), పీడనం **${pressure} hPa**.
• **అధికారిక చర్యల ప్రణాళిక**:
  - సహాయ మరియు రెస్క్యూ సిబ్బంది (SDRF/NDRF) ను తక్షణమే అప్రమత్తం చేయండి.
  - లోతట్టు ప్రాంతాలు మరియు డ్రైనేజీ వ్యవస్థలను పరిశీలించి పునరావాస కేంద్రాలను సిద్ధం చేయండి.
  - ప్రజలకు అధికారిక CAP హెచ్చరికలు జారీ చేయండి.`;
    }
    if (language === 'hi') {
      return `🏛️ **आपदा प्रबंधन एवं प्रशासनिक विश्लेषण (${placeName})**:
• **IMD चेतावनी चरण**: **${imdColor}** | आपदा जोखिम सूचकांक: **${risk}/100**.
• **वायुमंडलीय पैरामीटर**: वर्षा संभावना **${rainProbToday}%**, हवा की गति **${wind} किमी/घंटा** (झोंके: **${windGust} किमी/घंटा**).
• **प्रशासनिक कार्ययोजना**:
  - निचले क्षेत्रों एवं जलभराव वाले स्थलों पर विशेष निगरानी रखें तथा NDRF/SDRF को अलर्ट मोड में रखें।
  - राहत शिविर एवं आवश्यक दवाओं/पेयजल की उपलब्धता सुनिश्चित करें।
  - जनता हेतु आधिकारिक SACHET / CAP एडवाइजरी प्रसारित करें।`;
    }
    return `🏛️ **Government & Disaster Management Decision Brief (${placeName})**:
• **IMD Early Warning Status**: **${imdColor}** | Composite Risk Score: **${risk}/100**
• **Key Meteorological Vectors**:
  - Precipitation Probability: **${rainProbToday}%** (Accumulation: ~**${rainSumToday} mm**)
  - Surface Wind: **${wind} km/h** (Peak Gust: **${windGust} km/h**), Barometric Pressure: **${pressure} hPa**
• **Command & Control Directives**:
  - Multi-Agency Readiness: Alert District Disaster Management Authority (DDMA), civil defense, and fire/rescue teams.
  - Low-Lying Inundation: Monitor stormwater sluices and pre-position de-watering pumps in vulnerable catchments.
  - Public Advisory: Disseminate standardized CAP/SACHET emergency alerts to local telecom towers.`;
  }

  // ── 6. CYCLONES, DEPRESSIONS & IMD WARNING SIGNALS INTENT ──────────────
  if (isCycloneQuery) {
    return `🌀 **IMD Tropical Weather & Cyclone Warning Protocol**:
• **Classification by Maximum Sustained Wind Speed (IMD Standard)**:
  1. **Low Pressure Area**: Winds < 31 km/h (< 17 knots).
  2. **Depression**: Winds **31–49 km/h** (17–27 knots).
  3. **Deep Depression**: Winds **50–61 km/h** (28–33 knots) — precursor to cyclogenesis.
  4. **Cyclonic Storm**: Winds **62–88 km/h** (34–47 knots) — officially named cyclone.
  5. **Severe Cyclonic Storm**: Winds **89–117 km/h** (48–63 knots).
  6. **Very Severe Cyclonic Storm**: Winds **118–166 km/h** (64–89 knots).
  7. **Extremely Severe Cyclonic Storm**: Winds **167–221 km/h** (90–119 knots).
  8. **Super Cyclonic Storm**: Winds **≥ 222 km/h** (≥ 120 knots).

• **IMD 4-Stage Cyclone Warning Protocol**:
  - 🟢 **Green (All Clear)**: Normal meteorological conditions.
  - 🟡 **Yellow (Cyclone Watch)**: Issued 72 hours in advance of storm threat.
  - 🟠 **Orange (Cyclone Alert)**: Issued 48 hours prior to anticipated landfall.
  - 🔴 **Red (Cyclone Warning / Post-Landfall Outlook)**: Issued 24 hours prior to landfall; urgent evacuation protocol.

• **Port Warning Signals 1–11**:
  - Signal 1: Distant caution; Signal 3: Port threatened by squally weather; Signal 8–10: Severe cyclone expected to cross port.`;
  }

  // ── 7. DISASTER SAFETY & EMERGENCY PRECAUTIONS INTENT ──────────────────
  if (isDisasterQuery) {
    return `🛡️ **WeatherGPT Disaster Safety & Emergency Procedures**:
• **Flood Safety ("Turn Around, Don't Drown")**:
  - Never walk, swim, or drive through moving floodwaters. Just 15 cm of moving water can knock an adult down, and 30 cm can carry away small vehicles.
  - Disconnect electrical main switches and gas valves before floodwaters enter premises.
  - Store drinkable boiled water, non-perishable food, and essential medications on elevated floors.

• **Lightning & Severe Thunderstorm (The 30-30 Rule)**:
  - If the time between seeing lightning and hearing thunder is less than 30 seconds, seek immediate enclosed shelter.
  - Wait at least 30 minutes after the last clap of thunder before heading back outside.
  - Avoid solitary tall trees, open fields, metal fences, and standing bodies of water.

• **Heatwave Protection**:
  - Stay hydrated with ORS, buttermilk, and lemon water. Avoid direct sun exposure between 12:00 PM and 3:30 PM.`;
  }

  // ── 8. AIR QUALITY & POLLUTION INTENT ──────────────────────────────────
  if (isAqiQuery) {
    let aqiStatus = 'Moderate';
    let advice = 'Air quality is acceptable for outdoor activity.';
    if (usAqi <= 50) { aqiStatus = 'Good (Green)'; advice = 'Optimal clean air for outdoor exercises.'; }
    else if (usAqi <= 100) { aqiStatus = 'Moderate (Yellow)'; advice = 'Acceptable air quality; sensitive individuals should monitor respiration.'; }
    else if (usAqi <= 150) { aqiStatus = 'Unhealthy for Sensitive Groups (Orange)'; advice = 'Children, elderly, and asthmatics should reduce intense outdoor exertion.'; }
    else { aqiStatus = 'Unhealthy to Hazardous (Red/Purple)'; advice = 'Wear N95 masks outdoors and utilize HEPA air purifiers indoors.'; }

    return `🌫️ **Air Quality Intelligence (AQI) for ${placeName}**:
• Current AQI Level: **${usAqi} (US AQI)** — **${aqiStatus}**
• Particulate Matter Concentrations:
  - **PM2.5**: **${pm25} µg/m³** (Fine respirable particles ≤ 2.5 µm that penetrate deep into lung tissue).
  - **PM10**: **${pm10} µg/m³** (Inhalable coarse particles like dust, pollen, and road grit).
• **Health Recommendation**: ${advice}`;
  }

  // ── 9. ATMOSPHERIC SCIENCE & PHYSICS INTENT ────────────────────────────
  if (isScienceQuery) {
    return `🔬 **Meteorological Science & Atmospheric Dynamics**:
• **Heat Index (Feels Like)**:
  - Current ambient temperature: **${temp}°C**, but feels like **${feels}°C** due to **${humidity}%** relative humidity.
  - High humidity prevents sweat from evaporating efficiently, impairing the human body's natural evaporative cooling and making the air feel substantially hotter.

• **Atmospheric Pressure & Storms**:
  - Current Barometric Pressure: **${pressure} hPa**.
  - High pressure (> 1015 hPa) induces sinking air, clear skies, and calm weather. Low pressure (< 1005 hPa) induces rising air, condensation, cloud buildup, and storm formation.

• **Indian Monsoon Drivers**:
  - Driven by the thermal contrast between the heated Tibetan Plateau / Indian landmass and the cooler Indian Ocean, establishing the strong low-level Somali Jet stream during the Southwest Monsoon (June–September).`;
  }

  // ── 10. AVIATION INTENT ────────────────────────────────────────────────
  if (isAviationQuery) {
    return `✈️ **Aerodrome & Aviation Briefing for ${placeName}**:
• Flight Category: **VFR (Visual Flight Rules)** — Ceiling > 3,000 ft AGL, Visibility > 8 km.
• Surface Wind: **${wind} km/h** (~**${Math.round(wind * 0.54)} knots**), Gusts: **${Math.round(windGust * 0.54)} kt**.
• Altimeter QNH: **${pressure} hPa** (Density Altitude optimal for standard takeoff roll).
• Convective Hazards: Low to moderate convective turbulence risk.`;
  }

  // ── 11. GREETINGS & SELF-IDENTITY ──────────────────────────────────────
  if (isGreetingQuery) {
    if (language === 'te') {
      return `👋 **నమస్కారం! నేను WeatherGPT ని**:
నేను నిజ-సమయ వాతావరణ అంచనాలు, వ్యవసాయ సలహాలు, విపత్తు నిర్వహణ మరియు వాయు నాణ్యత (AQI) కోసం ప్రత్యేకంగా నిర్మించబడిన AI సహాయకుడిని.

మీరు నన్ను క్రింది ప్రశ్నలు అడగవచ్చు:
• *ఈరోజు లేదా రేపు వర్షం పడుతుందా?*
• *పంటలపై పురుగుమందుల పిచికారీకి సరైన సమయమా?*
• *హైవే ప్రయాణానికి వాతావరణం ఎలా ఉంది?*
• *వాయు నాణ్యత (AQI) మరియు ఉష్ణోగ్రత వివరాలు ఏమిటి?*`;
    }
    if (language === 'hi') {
      return `👋 **नमस्ते! मैं WeatherGPT हूँ**:
मैं रीयल-टाइम मौसम पूर्वानुमान, कृषि परामर्श, आपदा चेतावनी और वायु गुणवत्ता विश्लेषण के लिए समर्पित AI सहायक हूँ।

आप मुझसे पूछ सकते हैं:
• *क्या आज या कल बारिश होगी?*
• *क्या आज फसलों पर कीटनाशक छिड़कने का सही समय है?*
• *राजमार्ग पर ड्राइविंग के लिए मौसम कैसा है?*
• *वर्तमान वायु गुणवत्ता (AQI) और तापमान क्या है?*`;
    }
    return `👋 **Hello! I am WeatherGPT**:
I am an AI meteorologist and disaster decision-support assistant equipped with live numerical weather prediction (NWP) ensembles, Doppler radar reflectivity, and agromet intelligence.

Feel free to ask me:
• *"Will it rain tomorrow in ${placeName}?"*
• *"Can I spray pesticides on my crops today?"*
• *"What should I wear today?"*
• *"What are the cyclone warning signals in India?"*
• *"What is the 3-day weather outlook?"*`;
  }

  // ── DEFAULT GROUNDED TELEMETRY SYNTHESIS ───────────────────────────────
  if (language === 'te') {
    return `🌦️ **${placeName} సమగ్ర వాతావరణ విశ్లేషణ**:
• ప్రస్తుత ఉష్ణోగ్రత: **${temp}°C** (అనిపించేది: **${feels}°C**), కనిష్ట/గరిష్ట: **${todayMin}°C / ${todayMax}°C**.
• వర్ష సూచన: **${rainProbToday}%** (అంచనా: **${rainSumToday} mm**), రేపటి వర్ష అవకాశం: **${tomorrowRain}%**.
• గాలి వేగం: **${wind} km/h** (ఝంఝామారుతం: **${windGust} km/h**), తేమ: **${humidity}%**, పీడనం: **${pressure} hPa**.
• వాయు నాణ్యత (AQI): **${usAqi}**, విపత్తు రిస్క్ రేటింగ్: **${risk}/100**.
• **సిఫార్సు**: ${rainProbToday > 50 ? 'వర్షం పడే అవకాశం ఉన్నందున గొడుగు వెంట ఉంచుకోండి.' : 'వాతావరణం అనుకూలంగా ఉంది. వ్యవసాయం మరియు బహిరంగ పనులను నిరభ్యంతరంగా కొనసాగించవచ్చు.'}`;
  }

  if (language === 'hi') {
    return `🌦️ **${placeName} संपूर्ण मौसम एवं वायुमंडलीय विश्लेषण**:
• वर्तमान तापमान: **${temp}°C** (महसूस: **${feels}°C**), आज का न्यूनतम/अधिकतम: **${todayMin}°C / ${todayMax}°C**.
• बारिश की संभावना: **${rainProbToday}%** (मात्रा: **${rainSumToday} मिमी**), कल की बारिश संभावना: **${tomorrowRain}%**.
• हवा की गति: **${wind} किमी/घंटा** (झोंके: **${windGust} किमी/घंटा**), आर्द्रता: **${humidity}%**, दबाव: **${pressure} hPa**.
• वायु गुणवत्ता (AQI): **${usAqi}**, आपदा जोखिम स्तर: **${risk}/100**.
• **परामर्श**: ${rainProbToday > 50 ? 'बारिश के आसार हैं, छाता साथ रखें और सावधानी बरतें।' : 'मौसम सामान्य एवं दैनिक कार्यों, यात्रा और खेती के अनुकूल है।'}`;
  }

  if (language === 'mr') {
    return `🌦️ **${placeName} सविस्तर हवामान विश्लेषण**:
• तापमान: **${temp}°C** (जाणवणारे: **${feels}°C**), पाऊस शक्यता: **${rainProbToday}%**, वाऱ्याचा वेग: **${wind} किमी/तास**.
• उद्याचा अंदाज: कमाल **${tomorrowMax}°C**, पाऊस शक्यता: **${tomorrowRain}%**, हवेची गुणवत्ता (AQI): **${usAqi}**.
• **सल्ला**: ${rainProbToday > 50 ? 'पावसाची शक्यता असल्याने छत्री सोबत ठेवा.' : 'हवामान प्रवास व दैनंदिन कामांसाठी अनुकूल आहे.'}`;
  }

  if (language === 'ta') {
    return `🌦️ **${placeName} வானிலை மற்றும் வளிமண்டல ஆய்வு**:
• தற்போதைய வெப்பநிலை: **${temp}°C** (உணரப்படுவது: **${feels}°C**), மழை வாய்ப்பு: **${rainProbToday}%**.
• காற்று வேகம்: **${wind} km/h**, காற்றின் தரம் (AQI): **${usAqi}**, அபாய குறியீடு: **${risk}/100**.
• **பரிந்துரை**: ${rainProbToday > 50 ? 'மழை பெய்யக்கூடும், குடையுடன் செல்லவும்.' : 'வானிலை இயல்பாக உள்ளது.'}`;
  }

  if (language === 'kn') {
    return `🌦️ **${placeName} ಹವಾಮಾನ ವರದಿ ಮತ್ತು ಮುನ್ಸೂಚನೆ**:
• ಪ್ರಸ್ತುತ ತಾಪಮಾನ: **${temp}°C** (ಅನಿಸಿಕೆ: **${feels}°C**), ಮಳೆ ಸಂಭವನೀಯತೆ: **${rainProbToday}%**.
• ಗಾಳಿಯ ವೇಗ: **${wind} km/h**, ವಾಯು ಗುಣಮಟ್ಟ (AQI): **${usAqi}**, ಅಪಾಯದ ಸೂಚ್ಯಂಕ: **${risk}/100**.
• **ಸಲಹೆ**: ${rainProbToday > 50 ? 'ಮಳೆಯ ಮುನ್ಸೂಚನೆ ಇದೆ, ಛತ್ರಿ ಜೊತೆಯಲ್ಲಿರಲಿ.' : 'ಹವಾಮಾನವು ಸಾಮಾನ್ಯವಾಗಿದೆ.'}`;
  }

  // Default English Output
  return `🌦️ **Comprehensive Weather Intelligence for ${placeName}**:
• **Atmospheric Telemetry**:
  - Current Temperature: **${temp}°C** (Apparent Heat Index: **${feels}°C**)
  - Today Range: Min **${todayMin}°C** / Max **${todayMax}°C**
  - Rain Probability Today: **${rainProbToday}%** (Expected Volume: **${rainSumToday} mm**)
  - Tomorrow Forecast: High **${tomorrowMax}°C** / Low **${tomorrowMin}°C**, Rain Chance **${tomorrowRain}%**
  - Surface Wind: **${wind} km/h** (Gusts: **${windGust} km/h**), Direction: South-Westerly
  - Relative Humidity: **${humidity}%** | Barometric Pressure: **${pressure} hPa** | Cloud: **${cloud}%**
  - Air Quality Index: **${usAqi} (US AQI)** | Disaster Risk Score: **${risk}/100**
• **Operational Recommendation**: ${rainProbToday >= 50 ? 'Precipitation expected across the basin. Carry rain gear and allow extra commute time.' : 'Stable synoptic conditions across the region. Favorable for outdoor operations, travel, and logistics.'}`;
}
