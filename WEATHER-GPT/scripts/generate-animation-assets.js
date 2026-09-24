import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

const TOTAL_FRAMES = 48;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function generateSvgFrame(index, total, isPortrait = false) {
  const w = isPortrait ? 720 : 1280;
  const h = isPortrait ? 1280 : 720;
  const cx = w / 2;
  const cy = isPortrait ? h * 0.44 : h * 0.5; // elevated on mobile to leave bottom space for text
  const progress = index / (total - 1);

  // 4 Acts:
  // Act 1 (0..0.28): Satellite Orbit & Stratosphere Scan
  // Act 2 (0.28..0.55): Descent into Cyclone & Doppler Radar Storm Core
  // Act 3 (0.55..0.78): Macro Sensor Matrix & Moisture Droplets
  // Act 4 (0.78..1.0): Product Hologram Reveal & AI Atmospheric Core

  let act1 = clamp(progress / 0.28, 0, 1);
  let act2 = clamp((progress - 0.28) / 0.27, 0, 1);
  let act3 = clamp((progress - 0.55) / 0.23, 0, 1);
  let act4 = clamp((progress - 0.78) / 0.22, 0, 1);

  // Continuous background gradient shifting from deep orbital space to atmospheric storm blues to AI cyan glow
  const bgHue1 = lerp(220, 205, progress);
  const bgHue2 = lerp(240, 190, progress);
  const bgSat = lerp(45, 75, progress);
  const bgLum1 = lerp(5, 12, progress);
  const bgLum2 = lerp(2, 6, progress);

  let defs = `
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stop-color="hsl(${bgHue1}, ${bgSat}%, ${bgLum1}%)" />
        <stop offset="60%" stop-color="hsl(${bgHue2}, ${bgSat}%, ${bgLum2}%)" />
        <stop offset="100%" stop-color="#040914" />
      </linearGradient>
      <radialGradient id="satelliteGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#58c7ff" stop-opacity="0.8" />
        <stop offset="60%" stop-color="#58c7ff" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#58c7ff" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="stormGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#48e09a" stop-opacity="${0.6 * (1 - act4)}" />
        <stop offset="45%" stop-color="#58c7ff" stop-opacity="${0.4 * (1 - act4)}" />
        <stop offset="85%" stop-color="#ff5e6c" stop-opacity="${0.2 * (1 - act4)}" />
        <stop offset="100%" stop-color="#040914" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
        <stop offset="25%" stop-color="#58c7ff" stop-opacity="0.85" />
        <stop offset="65%" stop-color="#145374" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#040914" stop-opacity="0" />
      </radialGradient>
      <filter id="bloom" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  `;

  let elements = [];

  // Background rect filling all edges completely
  elements.push(`<rect width="${w}" height="${h}" fill="url(#bgGrad)" />`);

  // Starfield grid that drifts downward with thumb scroll
  const starYOffset = (progress * 180) % h;
  elements.push(`
    <g opacity="${0.45 * (1 - act2 * 0.7)}">
      ${Array.from({ length: 24 }).map((_, i) => {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 93.3 + starYOffset) % h);
        const sr = (i % 3 === 0) ? 1.8 : 1.1;
        const op = 0.3 + 0.6 * Math.sin(i + progress * 8);
        return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr}" fill="#c5e3f6" opacity="${op.toFixed(2)}" />`;
      }).join('')}
    </g>
  `);

  // ──────────────────────────────────────────────
  // ACT 1: Earth Atmospheric Horizon & Orbiting Satellite
  // ──────────────────────────────────────────────
  if (act1 < 1.0 || act2 < 0.5) {
    const act1Fade = (1 - act2 * 2);
    if (act1Fade > 0) {
      const earthRadius = isPortrait ? w * 1.6 : w * 1.1;
      const earthCenterY = isPortrait ? h + earthRadius * 0.68 - act1 * 120 : h + earthRadius * 0.75 - act1 * 80;
      
      // Atmospheric limb glow
      elements.push(`
        <g opacity="${act1Fade.toFixed(2)}">
          <ellipse cx="${cx}" cy="${earthCenterY}" rx="${earthRadius}" ry="${earthRadius * 0.85}" fill="#0a2240" />
          <ellipse cx="${cx}" cy="${earthCenterY}" rx="${earthRadius * 0.99}" ry="${earthRadius * 0.84}" fill="none" stroke="#58c7ff" stroke-width="6" opacity="0.6" filter="url(#bloom)" />
          <ellipse cx="${cx}" cy="${earthCenterY}" rx="${earthRadius * 0.97}" ry="${earthRadius * 0.82}" fill="none" stroke="#48e09a" stroke-width="3" opacity="0.4" />
        </g>
      `);

      // Satellite geometry
      const satScale = lerp(1, 2.4, act1);
      const satX = lerp(cx - (isPortrait ? 80 : 200), cx, act1);
      const satY = lerp(cy - (isPortrait ? 100 : 80), cy, act1);
      const satAngle = lerp(-15, 12, act1);

      elements.push(`
        <g opacity="${act1Fade.toFixed(2)}" transform="translate(${satX}, ${satY}) scale(${satScale}) rotate(${satAngle})">
          <!-- Satellite Body -->
          <circle cx="0" cy="0" r="32" fill="url(#satelliteGlow)" />
          <rect x="-14" y="-12" width="28" height="24" rx="4" fill="#1b3a5b" stroke="#58c7ff" stroke-width="1.5" />
          <!-- Solar Panels Left & Right -->
          <rect x="-56" y="-8" width="38" height="16" rx="2" fill="#0d233a" stroke="#48e09a" stroke-width="1" />
          <line x1="-37" y1="-8" x2="-37" y2="8" stroke="#48e09a" stroke-width="0.7" />
          <line x1="-18" y1="-8" x2="-18" y2="8" stroke="#48e09a" stroke-width="0.7" />
          <rect x="18" y="-8" width="38" height="16" rx="2" fill="#0d233a" stroke="#48e09a" stroke-width="1" />
          <line x1="37" y1="-8" x2="37" y2="8" stroke="#48e09a" stroke-width="0.7" />
          <!-- Radar Dish & Telemetry Beam -->
          <path d="M -8 12 Q 0 20 8 12" fill="none" stroke="#ffd166" stroke-width="2" />
          <polygon points="0,18 -32,${isPortrait ? 120 : 90} 32,${isPortrait ? 120 : 90}" fill="url(#satelliteGlow)" opacity="0.4" />
          <!-- SIH26068 Marker -->
          <circle cx="0" cy="0" r="3" fill="#ffd166" />
        </g>
      `);
    }
  }

  // ──────────────────────────────────────────────
  // ACT 2: Descent into Cyclone & Doppler Radar Bands
  // ──────────────────────────────────────────────
  if (act2 > 0 && act3 < 1.0) {
    const stormOpacity = act3 > 0.5 ? (1 - act3) * 2 : Math.min(act2 * 1.5, 1);
    const stormRotation = (progress * 360 * 1.8) % 360;
    const stormRadius = lerp(120, isPortrait ? 380 : 460, easeInOutCubic(act2));

    elements.push(`
      <g opacity="${stormOpacity.toFixed(2)}" transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${stormRadius}" fill="url(#stormGlow)" />
        <g transform="rotate(${stormRotation})">
          <!-- Spiral Radar Arms -->
          <path d="M 0 0 Q 60 40 120 120 Q 180 200 240 180" fill="none" stroke="#48e09a" stroke-width="6" stroke-linecap="round" opacity="0.75" />
          <path d="M 0 0 Q -60 -40 -120 -120 Q -180 -200 -240 -180" fill="none" stroke="#58c7ff" stroke-width="7" stroke-linecap="round" opacity="0.8" />
          <path d="M 0 0 Q 50 -70 140 -130 Q 220 -160 280 -100" fill="none" stroke="#ff5e6c" stroke-width="5" stroke-linecap="round" opacity="0.6" />
          <path d="M 0 0 Q -50 70 -140 130 Q -220 160 -280 100" fill="none" stroke="#ffd166" stroke-width="5" stroke-linecap="round" opacity="0.6" />
        </g>
        <!-- Concentric Radar Isobar Rings -->
        <circle cx="0" cy="0" r="${stormRadius * 0.35}" fill="none" stroke="#58c7ff" stroke-width="1.5" stroke-dasharray="8 6" opacity="0.6" />
        <circle cx="0" cy="0" r="${stormRadius * 0.65}" fill="none" stroke="#48e09a" stroke-width="1.5" stroke-dasharray="12 8" opacity="0.5" />
        <circle cx="0" cy="0" r="${stormRadius * 0.95}" fill="none" stroke="#58c7ff" stroke-width="1" stroke-dasharray="4 4" opacity="0.4" />
        <!-- Lightning flash arc -->
        ${(index % 4 === 0) ? `
          <path d="M -20 -80 L 10 -30 L -15 20 L 25 70" fill="none" stroke="#ffffff" stroke-width="3" filter="url(#bloom)" opacity="0.9" />
        ` : ''}
      </g>
    `);
  }

  // ──────────────────────────────────────────────
  // ACT 3: Macro Sensor Matrix & Aerosol Telemetry
  // ──────────────────────────────────────────────
  if (act3 > 0 && act4 < 1.0) {
    const macroOpacity = act4 > 0.4 ? (1 - act4) * 2 : Math.min(act3 * 1.5, 1);
    const zoom = lerp(0.8, 2.2, act3);

    elements.push(`
      <g opacity="${macroOpacity.toFixed(2)}" transform="translate(${cx}, ${cy}) scale(${zoom})">
        <!-- Telemetry Data Grid Nodes -->
        ${Array.from({ length: 8 }).map((_, i) => {
          const ang = (i * Math.PI / 4) + (progress * 2);
          const rad = 110 + 30 * Math.sin(progress * 5 + i);
          const px = Math.cos(ang) * rad;
          const py = Math.sin(ang) * rad;
          return `
            <line x1="0" y1="0" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#58c7ff" stroke-width="1" opacity="0.4" stroke-dasharray="4 4" />
            <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7" fill="#0d2744" stroke="#48e09a" stroke-width="2" />
            <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="#ffffff" />
          `;
        }).join('')}
        
        <!-- Moisture Aerosol Floating Spheres -->
        <circle cx="-60" cy="-45" r="28" fill="url(#coreGlow)" opacity="0.6" />
        <circle cx="70" cy="40" r="36" fill="url(#coreGlow)" opacity="0.5" />
        <circle cx="-40" cy="65" r="20" fill="url(#coreGlow)" opacity="0.7" />
        <circle cx="50" cy="-60" r="22" fill="url(#coreGlow)" opacity="0.65" />
        
        <!-- Telemetry Floating Badges -->
        <g transform="translate(-100, -110)" opacity="0.85">
          <rect width="90" height="24" rx="6" fill="rgba(8,20,38,0.85)" stroke="#58c7ff" stroke-width="1" />
          <text x="45" y="16" text-anchor="middle" fill="#58c7ff" font-size="10.5" font-family="sans-serif" font-weight="bold">💧 84% HUMID</text>
        </g>
        <g transform="translate(18, 95)" opacity="0.85">
          <rect width="90" height="24" rx="6" fill="rgba(8,20,38,0.85)" stroke="#48e09a" stroke-width="1" />
          <text x="45" y="16" text-anchor="middle" fill="#48e09a" font-size="10.5" font-family="sans-serif" font-weight="bold">💨 14 km/h S</text>
        </g>
      </g>
    `);
  }

  // ──────────────────────────────────────────────
  // ACT 4: Product Reveal — WeatherGPT Atmospheric Intelligence Core
  // ──────────────────────────────────────────────
  if (act4 > 0) {
    const revealOpacity = Math.min(act4 * 1.4, 1);
    const orbScale = lerp(0.6, 1.0, easeInOutCubic(act4));
    const ringRotate1 = (progress * 240) % 360;
    const ringRotate2 = -(progress * 300) % 360;

    elements.push(`
      <g opacity="${revealOpacity.toFixed(2)}" transform="translate(${cx}, ${cy}) scale(${orbScale})">
        <!-- Giant Radiant Orb Aura -->
        <circle cx="0" cy="0" r="160" fill="url(#coreGlow)" />
        
        <!-- Rotating Gyroscope Rings -->
        <ellipse cx="0" cy="0" rx="140" ry="46" fill="none" stroke="#58c7ff" stroke-width="3" transform="rotate(${ringRotate1})" opacity="0.85" filter="url(#bloom)" />
        <ellipse cx="0" cy="0" rx="130" ry="52" fill="none" stroke="#48e09a" stroke-width="2.5" transform="rotate(${ringRotate2})" opacity="0.8" />
        <ellipse cx="0" cy="0" rx="110" ry="110" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-dasharray="10 6" />
        
        <!-- Central Glassmorphic Hologram Orb -->
        <circle cx="0" cy="0" r="75" fill="#081c33" stroke="#58c7ff" stroke-width="3" />
        <circle cx="-20" cy="-25" r="24" fill="rgba(255,255,255,0.25)" opacity="0.7" />
        
        <!-- WeatherGPT Emblem & Live Pulse -->
        <text x="0" y="-12" text-anchor="middle" font-size="34" font-family="sans-serif">🌦️</text>
        <text x="0" y="24" text-anchor="middle" fill="#ffffff" font-size="15" font-family="sans-serif" font-weight="800" letter-spacing="0.08em">WeatherGPT</text>
        <text x="0" y="42" text-anchor="middle" fill="#48e09a" font-size="11" font-family="sans-serif" font-weight="700">SIH26068 • AI ENGINE</text>
        
        <!-- Orbiting Satellite Node around Product -->
        <g transform="rotate(${ringRotate1}) translate(140, 0)">
          <circle cx="0" cy="0" r="7" fill="#ffd166" filter="url(#bloom)" />
          <circle cx="0" cy="0" r="12" fill="none" stroke="#ffd166" stroke-width="1" opacity="0.6" />
        </g>
      </g>
    `);
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      ${defs}
      ${elements.join('\n')}
    </svg>
  `.trim();
}

console.log('Generating animation sequence frames...');

const portraitDir = path.join(rootDir, 'public/assets/animation/portrait');
const landscapeDir = path.join(rootDir, 'public/assets/animation/landscape');

for (let i = 0; i < TOTAL_FRAMES; i++) {
  const pad = String(i).padStart(3, '0');
  
  // Portrait frame (Mobile 9:16)
  const portraitSvg = generateSvgFrame(i, TOTAL_FRAMES, true);
  fs.writeFileSync(path.join(portraitDir, `frame_${pad}.svg`), portraitSvg, 'utf8');

  // Landscape frame (Desktop 16:9)
  const landscapeSvg = generateSvgFrame(i, TOTAL_FRAMES, false);
  fs.writeFileSync(path.join(landscapeDir, `frame_${pad}.svg`), landscapeSvg, 'utf8');
}

// Generate lightweight posters (first frame & final frame)
fs.writeFileSync(path.join(rootDir, 'public/assets/animation/poster-mobile.svg'), generateSvgFrame(0, TOTAL_FRAMES, true), 'utf8');
fs.writeFileSync(path.join(rootDir, 'public/assets/animation/poster-desktop.svg'), generateSvgFrame(0, TOTAL_FRAMES, false), 'utf8');

console.log(`Generated ${TOTAL_FRAMES} portrait frames and ${TOTAL_FRAMES} landscape frames + posters successfully!`);
