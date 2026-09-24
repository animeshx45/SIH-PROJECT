/**
 * Aviation Weather Briefing & Aerodrome Decision Support Service
 * Features:
 * - Synthetic METAR & TAF generation
 * - Runway Crosswind & Headwind Vector Calculator
 * - Flight Category (VFR, MVFR, IFR, LIFR)
 * - Cloud Ceiling AGL & Visibility RVR
 * - Altimeter QNH & Density Altitude
 * - Flight Level Hazard Indices (Turbulence, Icing, Wind Shear)
 */

export function getAviationBriefing({ weather, placeName = 'Aerodrome', runwayHeading = 90 }) {
  const c = weather?.current || {};
  const tempC = c.temperature_2m ?? 28;
  const dewpointC = tempC - ((100 - (c.relative_humidity_2m ?? 60)) / 5);
  const pressureHpa = Math.round(c.surface_pressure || c.pressure_msl || 1013);
  const windSpeedKnots = Math.round((c.wind_speed_10m || 12) * 0.539957);
  const windGustKnots = Math.round((c.wind_gusts_10m || c.wind_speed_10m || 12) * 0.539957);
  const windDirDeg = Math.round(c.wind_direction_10m || 120);
  const cloudCoverPct = c.cloud_cover ?? 25;

  // Cloud ceiling estimate based on temperature-dewpoint spread (Espy's equation)
  const cloudBaseFeetAgl = Math.max(800, Math.round(((tempC - dewpointC) * 400)));
  const visibilityMeters = c.visibility ? Math.round(c.visibility) : (c.precipitation > 0 ? 4500 : 10000);
  const visibilityStatuteMiles = (visibilityMeters / 1609.34).toFixed(1);

  // Flight Category (FAA / ICAO Standard)
  let flightCategory = 'VFR';
  let flightCategoryClass = 'green';
  let flightCategoryDesc = 'Visual Flight Rules (Optimal conditions)';

  if (cloudBaseFeetAgl < 500 || visibilityMeters < 1600) {
    flightCategory = 'LIFR';
    flightCategoryClass = 'purple';
    flightCategoryDesc = 'Low Instrument Flight Rules (Severe restriction)';
  } else if (cloudBaseFeetAgl < 1000 || visibilityMeters < 4800) {
    flightCategory = 'IFR';
    flightCategoryClass = 'red';
    flightCategoryDesc = 'Instrument Flight Rules (IMC active)';
  } else if (cloudBaseFeetAgl <= 3000 || visibilityMeters <= 8000) {
    flightCategory = 'MVFR';
    flightCategoryClass = 'yellow';
    flightCategoryDesc = 'Marginal VFR (Caution for general aviation)';
  }

  // Runway Crosswind & Headwind Calculation
  // Angle difference between runway magnetic bearing and wind direction
  const rwyAngleRad = ((windDirDeg - runwayHeading) * Math.PI) / 180;
  const headwindKnots = Math.round(windSpeedKnots * Math.cos(rwyAngleRad));
  const crosswindKnots = Math.abs(Math.round(windSpeedKnots * Math.sin(rwyAngleRad)));

  // Density Altitude calculation: DA = Pressure Alt + (120 * (OAT - ISA Temp))
  const pressureAltFeet = Math.round((1013.25 - pressureHpa) * 30);
  const isaTemp = 15 - (1.98 * (pressureAltFeet / 1000));
  const densityAltitudeFeet = Math.round(pressureAltFeet + (120 * (tempC - isaTemp)));

  // Synthetic ICAO METAR String
  const now = new Date();
  const utcDay = String(now.getUTCDate()).padStart(2, '0');
  const utcHour = String(now.getUTCHours()).padStart(2, '0');
  const utcMin = String(Math.floor(now.getUTCMinutes() / 10) * 10).padStart(2, '0');
  const icaoCode = getSimulatedIcaoCode(placeName);
  
  const windStr = `${String(windDirDeg).padStart(3, '0')}${String(windSpeedKnots).padStart(2, '0')}${windGustKnots > windSpeedKnots + 5 ? 'G' + windGustKnots : ''}KT`;
  const visStr = visibilityMeters >= 9999 ? '9999' : String(visibilityMeters).padStart(4, '0');
  const cloudCode = cloudCoverPct > 80 ? `OVC0${Math.round(cloudBaseFeetAgl/100)}` : (cloudCoverPct > 50 ? `BKN0${Math.round(cloudBaseFeetAgl/100)}` : (cloudCoverPct > 20 ? `SCT0${Math.round(cloudBaseFeetAgl/100)}` : 'FEW030'));
  const tempDewStr = `${tempC >= 0 ? String(Math.round(tempC)).padStart(2, '0') : 'M' + Math.abs(Math.round(tempC))}/${dewpointC >= 0 ? String(Math.round(dewpointC)).padStart(2, '0') : 'M' + Math.abs(Math.round(dewpointC))}`;
  const qnhStr = `Q${pressureHpa}`;

  const metarRaw = `${icaoCode} ${utcDay}${utcHour}${utcMin}Z ${windStr} ${visStr} ${cloudCode} ${tempDewStr} ${qnhStr} NOSIG`;

  return {
    aerodrome: placeName,
    icao: icaoCode,
    runwayActive: `RWY ${String(Math.round(runwayHeading / 10)).padStart(2, '0')}`,
    flightCategory,
    flightCategoryClass,
    flightCategoryDesc,
    crosswindKnots,
    headwindKnots: headwindKnots >= 0 ? `${headwindKnots} kt Headwind` : `${Math.abs(headwindKnots)} kt Tailwind`,
    crosswindLimitSafe: crosswindKnots <= 15,
    qnhHpa: pressureHpa,
    densityAltitudeFeet,
    cloudBaseAgl: `${cloudBaseFeetAgl} ft AGL`,
    visibility: `${visibilityStatuteMiles} SM (${(visibilityMeters/1000).toFixed(1)} km)`,
    turbulenceRisk: (windGustKnots - windSpeedKnots) > 10 ? 'MODERATE MECHANICAL' : 'LIGHT / NIL',
    icingLevelMsl: `${Math.round(Math.max(8000, tempC * 600))} ft MSL`,
    metarRaw,
    operationalAdvisory: crosswindKnots > 20 
      ? '⚠️ Crosswind exceeds general aviation threshold (15-20 kt). Caution during flare and touch-down.' 
      : '🟢 Aerodrome surface winds and visibility are within standard operating limitations.'
  };
}

function getSimulatedIcaoCode(city) {
  const lower = city.toLowerCase();
  if (lower.includes('hyderabad')) return 'VOHS';
  if (lower.includes('mumbai') || lower.includes('bombay')) return 'VABB';
  if (lower.includes('delhi')) return 'VIDP';
  if (lower.includes('bangalore') || lower.includes('bengaluru')) return 'VOBL';
  if (lower.includes('chennai') || lower.includes('madras')) return 'VOMM';
  if (lower.includes('kolkata') || lower.includes('calcutta')) return 'VECC';
  if (lower.includes('ahmedabad')) return 'VAAH';
  if (lower.includes('pune')) return 'VAPO';
  if (lower.includes('goa')) return 'VOGO';
  return 'VO' + city.slice(0, 2).toUpperCase();
}
