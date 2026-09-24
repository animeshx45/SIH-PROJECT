/**
 * WeatherGPT — Persistent Mobile Navigation & Accessible Drawer Controller
 * SIH26068 Production Implementation
 * 
 * Features:
 * - Stays fixed to the top throughout the entire website
 * - Brand symbol & wordmark on left, hamburger menu on right
 * - Mounted outside pinned sections with high z-index (z-index: 10000)
 * - Minimum 44x44px touch targets & safe-area insets
 * - Keyboard navigation, focus trapping, Escape-to-close
 * - Closes automatically upon link selection
 * - Smooth anchor navigation with offset
 */

class MobileNavigationController {
  constructor() {
    this.navBar = document.getElementById('persistentNavbar');
    this.hamburgerBtn = document.getElementById('persistentHamburger');
    this.drawer = document.getElementById('mobileDrawer');
    this.backdrop = document.getElementById('mobileDrawerBackdrop');
    this.closeBtn = document.getElementById('drawerCloseBtn');
    this.navLinks = document.querySelectorAll('.drawer-nav-item');
    this.lastActiveElement = null;

    if (!this.hamburgerBtn || !this.drawer) {
      console.warn('[MobileNav] Essential elements not found.');
      return;
    }

    this.init();
  }

  init() {
    this.hamburgerBtn.addEventListener('click', () => this.toggleDrawer());
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeDrawer());
    }
    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => this.closeDrawer());
    }

    // Link selection closes drawer and switches page
    this.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const page = link.getAttribute('data-page');
        this.closeDrawer();
        if (page) {
          // Trigger the desktop/app navigation system
          const sidebarBtn = document.querySelector(`.sidebar .nav button[data-page="${page}"]`) ||
                             document.querySelector(`.mobile-nav button[data-page="${page}"]`);
          if (sidebarBtn) {
            sidebarBtn.click();
          }

          // Also scroll smoothly past the cinematic story if on mobile
          const mainArea = document.getElementById('mainContentArea');
          if (mainArea) {
            mainArea.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    // Keyboard support: Escape key & focus trapping
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Update active nav state when page changes
    window.addEventListener('hashchange', () => this.syncActiveState());
  }

  toggleDrawer() {
    const isOpen = this.drawer.classList.contains('open');
    if (isOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer() {
    this.lastActiveElement = document.activeElement;
    this.drawer.classList.add('open');
    this.drawer.setAttribute('aria-hidden', 'false');
    this.hamburgerBtn.setAttribute('aria-expanded', 'true');
    if (this.backdrop) {
      this.backdrop.classList.add('open');
      this.backdrop.setAttribute('aria-hidden', 'false');
    }

    // Prevent body scroll while drawer is open
    document.body.style.overflow = 'hidden';

    // Focus management: move focus to close button
    setTimeout(() => {
      if (this.closeBtn) {
        this.closeBtn.focus();
      }
    }, 50);
  }

  closeDrawer() {
    this.drawer.classList.remove('open');
    this.drawer.setAttribute('aria-hidden', 'true');
    this.hamburgerBtn.setAttribute('aria-expanded', 'false');
    if (this.backdrop) {
      this.backdrop.classList.remove('open');
      this.backdrop.setAttribute('aria-hidden', 'true');
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Restore focus to trigger button
    if (this.lastActiveElement && typeof this.lastActiveElement.focus === 'function') {
      this.lastActiveElement.focus();
    }
  }

  handleKeyDown(e) {
    if (!this.drawer.classList.contains('open')) return;

    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      this.closeDrawer();
      return;
    }

    // Trap focus inside drawer
    if (e.key === 'Tab') {
      const focusable = this.drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  syncActiveState() {
    const activePageBtn = document.querySelector('.sidebar .nav button.active') ||
                          document.querySelector('.mobile-nav button.active');
    if (!activePageBtn) return;
    const pageId = activePageBtn.getAttribute('data-page');

    this.navLinks.forEach(link => {
      if (link.getAttribute('data-page') === pageId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.mobileNavigation = new MobileNavigationController();
});
