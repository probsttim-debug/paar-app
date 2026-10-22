// Gemeinsame UI-Bausteine: Linien-Icons, Avatare, Gesicht, Bottom-Sheet.

import { esc, initials } from './util.js';

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.1-8 11-8 11Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  plane: '<path d="M10.5 13.5 3 11l1.5-1.5 8 .5 4-4.5a2 2 0 0 1 3 3l-4.5 4 .5 8L14 22l-2.5-7.5L8 18v2.5L6.5 22l-1-3.5L2 17.5 3.5 16H6l3.5-3.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.5-.6 4.9-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
};

export function icon(name, size = 24, extraClass = '') {
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

/** Farbklasse je Person: 'me' (Blau) oder 'partner' (Orange). */
export function personClass(uid, myUid) {
  return uid === myUid ? 'me' : 'partner';
}

export function avatar(name, cls, size = 'md') {
  return `<span class="avatar avatar--${cls} avatar--${size}" aria-hidden="true">${esc(initials(name))}</span>`;
}

/** Gesicht, dessen Mund stufenlos mit dem Wert 0–100 mitlächelt. */
export function face(value, cls, size = 48) {
  return `<svg class="face face--${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="44" class="face__bg"/>
    <circle cx="36" cy="42" r="5.5" class="face__eye"/>
    <circle cx="64" cy="42" r="5.5" class="face__eye"/>
    <path d="${mouthPath(value)}" class="face__mouth"/>
  </svg>`;
}

export function mouthPath(value) {
  const ctrl = 66 + ((value - 50) / 50) * 18;
  return `M31 66 Q50 ${ctrl.toFixed(1)} 69 66`;
}

/**
 * Öffnet ein Bottom-Sheet (natives <dialog>).
 * onMount(el, close) wird nach dem Einfügen aufgerufen.
 */
export function openSheet({ title, body, onMount, onClose }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.setAttribute('aria-labelledby', 'sheet-title');
  dlg.innerHTML = `
    <div class="sheet__inner">
      <div class="sheet__head">
        <h2 id="sheet-title" class="sheet__title">${esc(title)}</h2>
        <button type="button" class="icon-btn" data-sheet-close aria-label="Schließen">${icon('close')}</button>
      </div>
      <div class="sheet__body">${body}</div>
    </div>`;
  document.body.append(dlg);

  const close = () => dlg.close();
  dlg.addEventListener('close', () => {
    dlg.remove();
    onClose?.();
  });
  // Tippen auf den abgedunkelten Hintergrund schließt
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-sheet-close]')) close();
  });

  dlg.showModal();
  onMount?.(dlg, close);
  return close;
}

/** Kurze Rückmeldung am unteren Rand. */
export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('toast--show'));
  setTimeout(() => {
    el.classList.remove('toast--show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}
