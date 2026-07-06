const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export class OverlayController {
  constructor(documentRef = document) {
    this.document = documentRef;
    this.active = null;
    this.previousFocus = null;
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  open(element, { close = null, initialFocus = null } = {}) {
    if (!element) throw new Error('Cannot open a missing overlay element.');
    if (this.active?.element !== element) this.close({ restoreFocus: false });
    this.previousFocus = this.document.activeElement;
    this.active = { element, close };
    element.hidden = false;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.setAttribute('aria-hidden', 'false');
    this.document.addEventListener('keydown', this.onKeyDown);
    requestAnimationFrame(() => {
      element.classList.add('open');
      const target = initialFocus?.() ?? element.querySelector(FOCUSABLE) ?? element;
      if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
      target.focus?.();
    });
  }

  close({ restoreFocus = true } = {}) {
    if (!this.active) return;
    const { element } = this.active;
    element.classList.remove('open');
    element.setAttribute('aria-hidden', 'true');
    element.hidden = true;
    this.document.removeEventListener('keydown', this.onKeyDown);
    this.active = null;
    if (restoreFocus && this.previousFocus?.isConnected) this.previousFocus.focus?.();
    this.previousFocus = null;
  }

  onKeyDown(event) {
    if (!this.active) return;
    if (event.key === 'Escape' && this.active.close) {
      event.preventDefault();
      this.active.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...this.active.element.querySelectorAll(FOCUSABLE)];
    if (!focusable.length) {
      event.preventDefault();
      this.active.element.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  dispose() {
    this.close({ restoreFocus: false });
  }
}
