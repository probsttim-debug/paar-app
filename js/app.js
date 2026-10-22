// Einstieg: Anmelde-Schranke (Login → Koppeln → App), einfacher Hash-Router
// (#/start, #/kalender, #/listen, #/listen/ideen, #/statistik) und Service Worker.

import * as db from './data.js';
import { esc } from './util.js';
import { toast } from './ui.js';
import { renderStart } from './views/start.js';
import { renderKalender } from './views/kalender.js';
import { renderListen } from './views/listen.js';
import { renderStatistik } from './views/statistik.js';
import { renderAuth } from './views/auth.js';
import { renderKoppeln } from './views/koppeln.js';

const ROUTES = {
  start: { render: renderStart, title: 'Start' },
  kalender: { render: renderKalender, title: 'Kalender' },
  listen: { render: renderListen, title: 'To-dos' },
  statistik: { render: renderStatistik, title: 'Statistik' },
};

const appEl = document.getElementById('app');
const view = document.getElementById('view');
const tabs = document.querySelectorAll('.tabbar .tab');
let cleanup = null;
let currentRoute = null;
let gateKey = null;

function mount(render, params) {
  cleanup?.();
  document.querySelectorAll('dialog.sheet').forEach((d) => d.close());
  view.innerHTML = '';
  view.scrollTop = 0;
  cleanup = render(view, params) || null;
}

function route() {
  if (gateKey !== 'ready') return;
  const [name, sub] = location.hash.replace(/^#\/?/, '').split('/');
  const key = ROUTES[name] ? name : 'start';
  const routeId = `${key}/${sub || ''}`;
  if (routeId === currentRoute) return;
  currentRoute = routeId;

  mount(ROUTES[key].render, { sub });
  tabs.forEach((tab) => {
    if (tab.dataset.route === key) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  document.title = `${ROUTES[key].title} · Paar-App`;
}

function showGate(session) {
  appEl.classList.add('is-gated');
  currentRoute = null;
  if (session.status === 'signedOut') {
    mount(renderAuth);
    document.title = 'Anmelden · Paar-App';
  } else if (session.status === 'noCouple') {
    mount(renderKoppeln);
    document.title = 'Koppeln · Paar-App';
  } else if (session.status === 'error') {
    mount((root) => {
      const code = session.error?.code || session.error?.name || 'unbekannt';
      const hint = code === 'permission-denied'
        ? 'Firebase verweigert den Zugriff. Wahrscheinlich passen die Firestore-Regeln noch nicht.'
        : 'Bist du online?';
      root.innerHTML = `
        <div class="gate gate--center">
          <h1 class="page-title">Hoppla</h1>
          <p class="muted">Eure Daten konnten nicht geladen werden. ${hint}</p>
          <p class="error-code">Fehlercode: <strong>${esc(code)}</strong></p>
          <button type="button" class="btn btn--primary" data-el="retry">Noch mal versuchen</button>
          <button type="button" class="btn btn--ghost" data-el="logout">Abmelden</button>
        </div>`;
      root.querySelector('[data-el="retry"]').addEventListener('click', () => location.reload());
      root.querySelector('[data-el="logout"]').addEventListener('click', () => db.signOut());
    });
  } else {
    mount((root) => {
      root.innerHTML = `<div class="gate gate--center"><span class="spinner" role="status" aria-label="Wird geladen"></span></div>`;
    });
  }
}

let lastStatus = null;

db.onSessionChange((session) => {
  // Die App läuft auch schon, solange die andere Person noch nicht beigetreten ist („waiting")
  const inApp = session.status === 'ready' || session.status === 'waiting';
  if (lastStatus === 'waiting' && session.status === 'ready') {
    const partner = session.couple.members.find((u) => u !== session.user.uid);
    toast(`${session.couple.names[partner] || 'Die andere Person'} ist jetzt dabei!`);
  }
  lastStatus = session.status;

  // Gleicher Zustand (z. B. nur ein Name geändert) → nichts neu aufbauen
  const key = inApp ? 'ready' : session.status;
  if (key === gateKey) return;
  gateKey = key;

  if (inApp) {
    appEl.classList.remove('is-gated');
    route();
  } else {
    showGate(session);
  }
});

window.addEventListener('hashchange', route);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
  });
}
