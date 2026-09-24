/**
 * WeatherGPT — Cinematic Scroll Animation & Responsive Asset Delivery Engine
 * SIH26068 Production Implementation
 * 
 * Features:
 * - Separate 9:16 Portrait (Mobile) and 16:9 Landscape (Desktop) sequences
 * - Mobile requests ONLY portrait frames; Desktop requests ONLY landscape frames
 * - Viewport breakpoint switching with AbortController & decoded memory cleanup
 * - Priority-based progressive loading centered around scroll position
 * - Touch thumb pacing tuned independently for mobile
 * - Full prefers-reduced-motion accessibility support
 * - Lightweight SVG poster instant first paint & graceful offline fallback
 */

const TOTAL_FRAMES = 48;

class CinematicStoryEngine {
  constructor() {
    this.section = document.getElementById('cinematicStory');
    this.stickyStage = document.getElementById('storyStickyStage');
    this.canvas = document.getElementById('cinematicCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.poster = document.getElementById('cinematicPoster');
    this.act1Overlay = document.getElementById('storyAct1');
    this.act4Overlay = document.getElementById('storyAct4');

    if (!this.canvas || !this.section) {
      console.warn('[CinematicStory] Required DOM elements not found.');
      return;
    }

    this.isMobile = this.checkIsMobile();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    this.frames = new Map(); // frameIndex -> HTMLImageElement
    this.loadingQueue = new Set();
    this.currentFrameIndex = 0;
    this.targetFrameIndex = 0;
    this.rafId = null;
    this.abortController = new AbortController();

    this.activeVariant = this.isMobile ? 'portrait' : 'landscape';
    this.assetBasePath = `/assets/animation/${this.activeVariant}`;
    
    // Performance & Network tracking metrics
    this.metrics = {
      variant: this.activeVariant,
      framesLoaded: 0,
      totalBytes: 0,
      loadDurationMs: 0,
      startTime: performance.now()
    };

    this.init();
  }

  checkIsMobile() {
    return window.matchMedia('(max-width: 768px), ((max-width: 960px) and (orientation: portrait))').matches;
  }

  init() {
    this.setupDimensions();
    this.bindEvents();

    if (this.reducedMotion) {
      this.handleReducedMotion();
      return;
    }

    // Load poster immediately
    this.loadPoster();

    // Priority load frame 0
    this.loadFrame(0, true).then(() => {
      this.renderFrame(0);
      // Progressively load surrounding frames
      this.queueProgressiveFrames(0);
    });

    // Initial scroll position sync
    this.onScroll();
  }

  setupDimensions() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
    this.displayW = w;
    this.displayH = h;
  }

  loadPoster() {
    if (!this.poster) return;
    const posterSrc = this.isMobile 
      ? '/assets/animation/poster-mobile.svg' 
      : '/assets/animation/poster-desktop.svg';
    this.poster.src = posterSrc;
  }

  handleReducedMotion() {
    if (this.section) {
      this.section.classList.add('reduced-motion');
    }
    if (this.poster) {
      this.poster.style.display = 'block';
    }
    if (this.canvas) {
      this.canvas.style.display = 'none';
    }
    console.log('[CinematicStory] prefers-reduced-motion active. Animation sequence suppressed.');
  }

  switchVariantIfNeeded() {
    const newIsMobile = this.checkIsMobile();
    if (newIsMobile === this.isMobile) return;

    console.log(`[CinematicStory] Viewport crossed breakpoint. Switching variant from ${this.activeVariant} to ${newIsMobile ? 'portrait' : 'landscape'}`);

    // Abort ongoing network requests
    this.abortController.abort();
    this.abortController = new AbortController();

    // Clean up decoded image memory from obsolete sequence
    this.frames.forEach((img) => {
      img.src = '';
    });
    this.frames.clear();
    this.loadingQueue.clear();

    this.isMobile = newIsMobile;
    this.activeVariant = this.isMobile ? 'portrait' : 'landscape';
    this.assetBasePath = `/assets/animation/${this.activeVariant}`;
    this.metrics.variant = this.activeVariant;

    this.setupDimensions();
    this.loadPoster();

    // Prioritize rendering current scroll frame in the new variant
    const currentProgress = this.calculateScrollProgress();
    const targetIdx = this.mapProgressToFrame(currentProgress);
    this.loadFrame(targetIdx, true).then(() => {
      this.renderFrame(targetIdx);
      this.queueProgressiveFrames(targetIdx);
    });
  }

  async loadFrame(index, highPriority = false) {
    if (index < 0 || index >= TOTAL_FRAMES) return null;
    if (this.frames.has(index)) return this.frames.get(index);
    if (this.loadingQueue.has(index) && !highPriority) return null;

    this.loadingQueue.add(index);
    const pad = String(index).padStart(3, '0');
    const url = `${this.assetBasePath}/frame_${pad}.svg`;

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        this.loadingQueue.delete(index);
        this.frames.set(index, img);
        this.metrics.framesLoaded++;
        if (this.poster && index === 0) {
          this.poster.style.opacity = '0';
        }
        resolve(img);
      };

      img.onerror = () => {
        this.loadingQueue.delete(index);
        console.warn(`[CinematicStory] Fallback: frame ${index} failed to load from ${url}`);
        resolve(null);
      };

      img.src = url;
    });
  }

  queueProgressiveFrames(centerIndex) {
    if (this.reducedMotion) return;

    // Concurrency limit: load frames outwards from center
    const queue = [];
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const next = centerIndex + offset;
      const prev = centerIndex - offset;
      if (next < TOTAL_FRAMES && !this.frames.has(next)) queue.push(next);
      if (prev >= 0 && !this.frames.has(prev)) queue.push(prev);
    }

    // Batch load with max 3 simultaneous requests
    const BATCH_SIZE = 3;
    const processBatch = async () => {
      if (queue.length === 0) return;
      const currentBatch = queue.splice(0, BATCH_SIZE);
      await Promise.all(currentBatch.map(idx => this.loadFrame(idx)));
      if (queue.length > 0) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(processBatch);
        } else {
          setTimeout(processBatch, 40);
        }
      }
    };

    processBatch();
  }

  calculateScrollProgress() {
    if (!this.section) return 0;
    const rect = this.section.getBoundingClientRect();
    const scrollableDist = rect.height - window.innerHeight;
    if (scrollableDist <= 0) return 0;

    const topOffset = -rect.top;
    const progress = Math.max(0, Math.min(1, topOffset / scrollableDist));
    return progress;
  }

  mapProgressToFrame(progress) {
    // Independent Mobile Pacing:
    // Compress inactive holds on mobile for swift thumb flicking
    // Brief opening hold (0..0.12) -> frame 0
    // Dynamic descent & storm core (0.12..0.52) -> frames 1..24
    // Macro sensor zoom (0.52..0.80) -> frames 25..36
    // Product reveal & hold (0.80..1.0) -> frames 37..47
    
    let frame;
    if (this.isMobile) {
      if (progress < 0.10) {
        frame = 0;
      } else if (progress > 0.88) {
        frame = TOTAL_FRAMES - 1;
      } else {
        const activeNorm = (progress - 0.10) / (0.88 - 0.10);
        frame = Math.round(activeNorm * (TOTAL_FRAMES - 1));
      }
    } else {
      if (progress < 0.08) {
        frame = 0;
      } else if (progress > 0.92) {
        frame = TOTAL_FRAMES - 1;
      } else {
        const activeNorm = (progress - 0.08) / (0.92 - 0.08);
        frame = Math.round(activeNorm * (TOTAL_FRAMES - 1));
      }
    }

    return Math.max(0, Math.min(TOTAL_FRAMES - 1, frame));
  }

  renderFrame(frameIndex) {
    if (!this.ctx) return;

    let img = this.frames.get(frameIndex);
    if (!img) {
      // Find nearest loaded frame as graceful fallback
      let nearest = null;
      let minDiff = Infinity;
      for (const [idx, loadedImg] of this.frames.entries()) {
        const diff = Math.abs(idx - frameIndex);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = loadedImg;
        }
      }
      img = nearest;
    }

    if (img && img.complete && img.naturalWidth > 0) {
      this.ctx.clearRect(0, 0, this.displayW, this.displayH);

      // Cover scaling without empty borders or stretching
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = this.displayW / this.displayH;

      let renderW, renderH, offsetX, offsetY;

      if (canvasRatio > imgRatio) {
        renderW = this.displayW;
        renderH = this.displayW / imgRatio;
        offsetX = 0;
        offsetY = (this.displayH - renderH) / 2;
      } else {
        renderH = this.displayH;
        renderW = this.displayH * imgRatio;
        offsetX = (this.displayW - renderW) / 2;
        offsetY = 0;
      }

      this.ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    }
  }

  updateOverlays(progress) {
    // Act 1 text (Opening screen) fades out as scroll starts
    if (this.act1Overlay) {
      const act1Opacity = Math.max(0, 1 - progress * 4.5);
      this.act1Overlay.style.opacity = act1Opacity.toFixed(2);
      this.act1Overlay.style.pointerEvents = act1Opacity > 0.1 ? 'auto' : 'none';
    }

    // Act 4 text (Product reveal) fades in at the end
    if (this.act4Overlay) {
      const act4Opacity = Math.max(0, (progress - 0.72) / 0.22);
      this.act4Overlay.style.opacity = Math.min(1, act4Opacity).toFixed(2);
      this.act4Overlay.style.pointerEvents = act4Opacity > 0.2 ? 'auto' : 'none';
    }
  }

  onScroll() {
    if (this.reducedMotion) return;

    const progress = this.calculateScrollProgress();
    this.targetFrameIndex = this.mapProgressToFrame(progress);
    this.updateOverlays(progress);

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        if (this.currentFrameIndex !== this.targetFrameIndex) {
          this.currentFrameIndex = this.targetFrameIndex;
          this.renderFrame(this.currentFrameIndex);

          // If frame wasn't loaded yet, request with high priority
          if (!this.frames.has(this.currentFrameIndex)) {
            this.loadFrame(this.currentFrameIndex, true).then(() => {
              this.renderFrame(this.currentFrameIndex);
            });
          }
        }
        this.rafId = null;
      });
    }
  }

  bindEvents() {
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.setupDimensions();
        this.switchVariantIfNeeded();
        this.renderFrame(this.currentFrameIndex);
      }, 150);
    });

    // Handle skip story button
    const skipBtns = document.querySelectorAll('.skip-story-btn, #heroSkipBtn');
    skipBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const mainContent = document.getElementById('mainContentArea');
        if (mainContent) {
          mainContent.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }
}

// Global initialization & helper
window.scrollToDashboard = function() {
  const mainContent = document.getElementById('mainContentArea');
  if (mainContent) {
    mainContent.scrollIntoView({ behavior: 'smooth' });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.cinematicStory = new CinematicStoryEngine();
});
