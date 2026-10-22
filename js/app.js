// Einstieg: einfacher Hash-Router (#/start, #/kalender, #/listen, #/listen/ideen, #/statistik)
// und Registrierung des Service Workers.

import { renderStart } from './views/start.js';
import { renderKalender } from './views/kalender.js';
import { renderListen } from './views/listen.js';
import { renderStatistik } from './views/statistik.js';

const ROUTES = {
  start: { render: renderStart, title: 'Start' },
  kalender: { render: renderKalender, title: 'Kalender' },
  listen: { render: renderListen, title: 'To-dos' },
  statistik: { render: renderStatistik, title: 'Statistik' },
};

const view = document.getElementById('view');
const tabs = document.querySelectorAll('.tabbar .tab');
let cleanup = null;
let currentRoute = null;

function route() {
  const [name, sub] = location.hash.replace(/^#\/?/, '').split('/');
  const key = ROUTES[name] ? name : 'start';
  const routeId = `${key}/${sub || ''}`;
  if (routeId === currentRoute) return;
  currentRoute = routeId;

  cleanup?.();
  view.innerHTML = '';
  view.scrollTop = 0;
  cleanup = ROUTES[key].render(view, { sub }) || null;

  tabs.forEach((tab) => {
    if (tab.dataset.route === key) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  document.title = `${ROUTES[key].title} · Paar-App`;
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
  });
}
