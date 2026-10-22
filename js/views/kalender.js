// Bildschirm „Kalender": Wochenraster, Monatsansicht mit Tagesdetails, Demnächst, Plus-Knopf.

import * as db from '../data.js';
import {
  esc, toISO, parseISO, today, todayISO, addDays, startOfWeek, weekdayIndex, daysInMonth,
  WEEKDAYS_SHORT, MONTHS, fmtLong, eventCovers, isShared,
} from '../util.js';
import { icon, toast } from '../ui.js';
import { eventRow, openEventForm, TYPE_LABEL } from './common.js';

export function renderKalender(root) {
  const me = db.getCurrentUser().uid;
  let couple = null;
  let events = [];
  const t = today();
  let cursor = new Date(t.getFullYear(), t.getMonth(), 1);
  let selected = todayISO();

  root.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Kalender</h1>
    </header>

    <section class="card" aria-labelledby="h-week">
      <h2 id="h-week" class="card-title">Diese Woche</h2>
      <div class="week" data-el="week"></div>
      <ul class="legend" aria-label="Legende" data-el="legend"></ul>
      <div class="hint" data-el="hint"></div>
    </section>

    <section class="card" aria-labelledby="h-month">
      <div class="month__head">
        <button type="button" class="icon-btn" data-action="prev" aria-label="Voriger Monat">${icon('left')}</button>
        <h2 id="h-month" class="card-title" data-el="month-title" aria-live="polite"></h2>
        <button type="button" class="icon-btn" data-action="next" aria-label="Nächster Monat">${icon('right')}</button>
      </div>
      <div class="month" data-el="month"></div>
      <div class="day-detail" data-el="detail" aria-live="polite"></div>
    </section>

    <section aria-labelledby="h-soon">
      <h2 id="h-soon" class="section-title">Demnächst zusammen</h2>
      <ul class="list card" data-el="soon"></ul>
    </section>`;

  const $ = (name) => root.querySelector(`[data-el="${name}"]`);

  // Schwebender Plus-Knopf liegt über der Navigationsleiste
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'fab';
  fab.setAttribute('aria-label', 'Neuen Eintrag anlegen');
  fab.innerHTML = icon('plus', 28);
  document.getElementById('app').append(fab);

  const partner = () => couple?.members.find((u) => u !== me);
  const partnerName = () => couple?.names?.[partner()] || 'Partnerin';

  function dayInfo(iso) {
    const on = events.filter((e) => eventCovers(e, iso));
    const shared = on.filter(isShared);
    const busyMe = on.filter((e) => e.type === 'busy' && e.owner === me);
    const busyPartner = on.filter((e) => e.type === 'busy' && e.owner !== me);
    return { shared, busyMe, busyPartner, bothFree: !shared.length && !busyMe.length && !busyPartner.length };
  }

  // ---------- Diese Woche ----------

  function renderWeek() {
    const ws = startOfWeek(t);
    const now = todayISO();
    const cells = [`<div class="week__corner" aria-hidden="true"></div>`];
    const freeDays = [];

    cells.push(`<div class="week__label" style="grid-row:2">Du</div>`);
    cells.push(`<div class="week__label" style="grid-row:3">${esc(partnerName())}</div>`);

    for (let i = 0; i < 7; i++) {
      const iso = toISO(addDays(ws, i));
      const d = addDays(ws, i);
      const col = i + 2;
      const info = dayInfo(iso);
      const isToday = iso === now;
      cells.push(`
        <div class="week__head ${isToday ? 'is-today' : ''}" style="grid-column:${col}">
          <span>${WEEKDAYS_SHORT[i]}</span><strong>${d.getDate()}</strong>
        </div>`);

      if (info.shared.length) {
        const label = `${WEEKDAYS_SHORT[i]}: ${info.shared.map((e) => e.title).join(', ')}, gemeinsam`;
        cells.push(`<button type="button" class="week__cell week__cell--shared" style="grid-column:${col};grid-row:2 / span 2" data-day="${iso}" aria-label="${esc(label)}">${icon('heart', 18)}</button>`);
        continue;
      }
      if (info.bothFree && iso >= now) freeDays.push(WEEKDAYS_SHORT[i]);
      const cell = (busy, row, who, cls) => {
        const state = busy.length ? `verplant: ${busy.map((e) => e.title).join(', ')}` : 'frei';
        const classes = ['week__cell', busy.length ? `week__cell--${cls}` : 'week__cell--free', info.bothFree ? 'week__cell--bothfree' : ''].join(' ');
        return `<button type="button" class="${classes}" style="grid-column:${col};grid-row:${row}" data-day="${iso}" aria-label="${esc(`${WEEKDAYS_SHORT[i]}, ${who} ${state}`)}"></button>`;
      };
      cells.push(cell(info.busyMe, 2, 'du', 'me'));
      cells.push(cell(info.busyPartner, 3, partnerName(), 'partner'));
    }
    $('week').innerHTML = cells.join('');

    $('legend').innerHTML = `
      <li><span class="swatch swatch--me"></span>Du verplant</li>
      <li><span class="swatch swatch--partner"></span>${esc(partnerName())} verplant</li>
      <li><span class="swatch swatch--shared"></span>Zusammen</li>
      <li><span class="swatch swatch--bothfree"></span>Beide frei</li>`;

    $('hint').innerHTML = freeDays.length
      ? `<p><strong>Ihr habt beide Zeit:</strong> ${freeDays.join(', ')}</p>
         <a class="link" href="#/listen/ideen">Date-Ideen ansehen ${icon('right', 16)}</a>`
      : `<p>Diese Woche ist schon gut gefüllt.</p>`;
  }

  // ---------- Monat ----------

  function renderMonth() {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    $('month-title').textContent = `${MONTHS[m]} ${y}`;
    const now = todayISO();
    const lead = weekdayIndex(cursor);
    const parts = WEEKDAYS_SHORT.map((w) => `<div class="month__wd" aria-hidden="true">${w}</div>`);
    for (let i = 0; i < lead; i++) parts.push('<div aria-hidden="true"></div>');

    for (let day = 1; day <= daysInMonth(y, m); day++) {
      const iso = toISO(new Date(y, m, day));
      const info = dayInfo(iso);
      const cls = ['month__day'];
      if (info.shared.length) cls.push('has-shared');
      if (iso === now) cls.push('is-today');
      if (iso === selected) cls.push('is-selected');
      const labels = [`${day}. ${MONTHS[m]}`];
      if (iso === now) labels.push('heute');
      info.shared.forEach((e) => labels.push(`${TYPE_LABEL[e.type]}: ${e.title}`));
      if (info.busyMe.length) labels.push('du bist verplant');
      if (info.busyPartner.length) labels.push(`${partnerName()} ist verplant`);
      parts.push(`
        <button type="button" class="${cls.join(' ')}" data-day="${iso}" aria-pressed="${iso === selected}" aria-label="${esc(labels.join(', '))}">
          <span>${day}</span>
          <span class="month__dots" aria-hidden="true">${info.busyMe.length ? '<i class="dot dot--me"></i>' : ''}${info.busyPartner.length ? '<i class="dot dot--partner"></i>' : ''}</span>
        </button>`);
    }
    $('month').innerHTML = parts.join('');
    renderDetail();
  }

  function renderDetail() {
    const info = dayInfo(selected);
    const line = (e, who, cls) => `
      <li class="busy-line">
        <i class="dot dot--${cls}" aria-hidden="true"></i>
        <span><strong>${who}</strong> verplant: ${esc(e.title)}${e.time ? ` · ${esc(e.time)}` : ''}</span>
      </li>`;
    let html = `<h3 class="day-detail__title">${fmtLong(selected)}</h3>`;
    if (info.bothFree) {
      html += `<p class="free-note">${icon('heart', 18)} Ihr seid beide frei</p>
               <a class="link" href="#/listen/ideen">Date-Ideen ansehen ${icon('right', 16)}</a>`;
    } else {
      html += '<ul class="list">';
      html += info.shared.map(eventRow).join('');
      html += info.busyMe.map((e) => line(e, 'Du bist', 'me')).join('');
      html += info.busyPartner.map((e) => line(e, `${esc(partnerName())} ist`, 'partner')).join('');
      html += '</ul>';
    }
    $('detail').innerHTML = html;
  }

  function renderSoon() {
    const now = todayISO();
    const soon = events.filter((e) => isShared(e) && (e.end || e.start) >= now).slice(0, 6);
    $('soon').innerHTML = soon.length
      ? soon.map(eventRow).join('')
      : '<li class="empty">Noch nichts geplant.</li>';
  }

  function renderAll() {
    if (!couple) return;
    renderWeek();
    renderMonth();
    renderSoon();
  }

  // ---------- Daten & Bedienung ----------

  const unsubs = [
    db.watchCouple((c) => {
      couple = c;
      renderAll();
    }),
    db.watchEvents((e) => {
      events = e;
      renderAll();
    }),
  ];

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'prev' || btn.dataset.action === 'next') {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + (btn.dataset.action === 'next' ? 1 : -1), 1);
      renderMonth();
    } else if (btn.dataset.day) {
      const fromWeek = btn.classList.contains('week__cell');
      selected = btn.dataset.day;
      const d = parseISO(selected);
      cursor = new Date(d.getFullYear(), d.getMonth(), 1);
      renderMonth();
      if (fromWeek) $('detail').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  fab.addEventListener('click', () => {
    openEventForm({
      preset: { start: selected >= todayISO() ? selected : todayISO() },
      onSave: async (data) => {
        await db.addEvent(data);
        toast('Eingetragen');
      },
    });
  });

  return () => {
    unsubs.forEach((u) => u());
    fab.remove();
  };
}
