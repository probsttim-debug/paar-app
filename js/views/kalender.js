// Bildschirm „Kalender": Wochenraster, „beide frei"-Karte, feste Termine,
// Monatsansicht mit Tages-Zeitleiste, Demnächst und Plus-Knopf.
// Einträge antippen öffnet die Details (löschen bzw. einzelnen Tag auslassen).

import * as db from '../data.js';
import {
  esc, toISO, parseISO, today, todayISO, addDays, startOfWeek, weekdayIndex, daysInMonth, diffDays,
  WEEKDAYS_SHORT, WEEKDAYS_LONG, MONTHS, fmtLong, fmtShort, fmtRange, inDays, eventCovers, isShared,
  repeatLabel, isoWeek,
} from '../util.js';
import { icon, avatar, openSheet, toast } from '../ui.js';
import { eventRow, openEventForm, TYPE_LABEL, TYPE_ICON } from './common.js';

export function renderKalender(root) {
  const me = db.getCurrentUser().uid;
  let couple = null;
  let events = [];
  const t = today();
  let cursor = new Date(t.getFullYear(), t.getMonth(), 1);
  let selected = todayISO();

  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${fmtLong(todayISO())}</p>
        <h1 class="page-title">Kalender</h1>
      </div>
      <button type="button" class="pill-btn" data-action="today">Heute</button>
    </header>

    <section class="card" aria-labelledby="h-week">
      <div class="card-head">
        <h2 id="h-week" class="card-title">Diese Woche</h2>
        <span class="muted small" data-el="week-sub"></span>
      </div>
      <div class="week" data-el="week"></div>
      <ul class="legend" aria-label="Legende" data-el="legend"></ul>
    </section>

    <div data-el="free"></div>

    <section class="card" aria-labelledby="h-fixed">
      <div class="card-head">
        <h2 id="h-fixed" class="card-title">Feste Termine</h2>
        <button type="button" class="pill-btn pill-btn--soft" data-action="add-fixed">${icon('plus', 16)} Hinzufügen</button>
      </div>
      <ul class="list fixed-list" data-el="fixed"></ul>
    </section>

    <section class="card" aria-labelledby="h-month" data-el="month-card">
      <div class="month__head">
        <button type="button" class="icon-btn" data-action="prev" aria-label="Voriger Monat">${icon('left')}</button>
        <h2 id="h-month" class="card-title" data-el="month-title" aria-live="polite"></h2>
        <button type="button" class="icon-btn" data-action="next" aria-label="Nächster Monat">${icon('right')}</button>
      </div>
      <div class="month" data-el="month"></div>
      <div class="agenda-wrap" data-el="agenda" aria-live="polite"></div>
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
  const nameOf = (uid) => (uid === me ? 'Du' : partnerName());
  const personCls = (ev) => (isShared(ev) ? 'shared' : ev.owner === me ? 'me' : 'partner');
  const byTime = (a, b) => (a.time || '').localeCompare(b.time || '');

  function dayInfo(iso) {
    const on = events.filter((e) => eventCovers(e, iso));
    const shared = on.filter(isShared).sort(byTime);
    const busyMe = on.filter((e) => e.type === 'busy' && e.owner === me).sort(byTime);
    const busyPartner = on.filter((e) => e.type === 'busy' && e.owner !== me).sort(byTime);
    return { all: on, shared, busyMe, busyPartner, bothFree: !on.length };
  }

  // ---------- Diese Woche ----------

  function renderWeek() {
    const ws = startOfWeek(t);
    const we = addDays(ws, 6);
    const now = todayISO();
    const short = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
    $('week-sub').textContent = `KW ${isoWeek(t)} · ${short(ws)}–${short(we)}`;

    const cells = [
      `<div class="week__corner" aria-hidden="true"></div>`,
      `<div class="week__label" style="grid-row:2">${avatar(couple.names[me] || 'Du', 'me', 'sm')}<span class="sr-only">Du</span></div>`,
      `<div class="week__label" style="grid-row:3">${avatar(partnerName(), 'partner', 'sm')}<span class="sr-only">${esc(partnerName())}</span></div>`,
    ];
    const freeDays = [];

    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const iso = toISO(d);
      const col = i + 2;
      const info = dayInfo(iso);
      const past = iso < now;
      cells.push(`
        <div class="week__head ${iso === now ? 'is-today' : ''}" style="grid-column:${col}">
          <span>${WEEKDAYS_SHORT[i]}</span><strong>${d.getDate()}</strong>
        </div>`);

      if (info.shared.length) {
        const first = info.shared[0];
        const label = `${WEEKDAYS_LONG[i]}: ${info.shared.map((e) => e.title).join(', ')}, gemeinsam`;
        cells.push(`
          <button type="button" class="week__cell week__cell--shared ${past ? 'is-past' : ''}" style="grid-column:${col};grid-row:2 / span 2" data-day="${iso}" aria-label="${esc(label)}">
            ${icon(TYPE_ICON[first.type], 18)}
            ${first.time ? `<span class="cell-time">${esc(first.time)}</span>` : ''}
          </button>`);
        continue;
      }
      if (info.bothFree && !past) freeDays.push(WEEKDAYS_LONG[i]);
      const cell = (busy, row, who, cls) => {
        const state = busy.length ? `verplant: ${busy.map((e) => e.title + (e.time ? ` um ${e.time}` : '')).join(', ')}` : 'frei';
        const classes = ['week__cell', busy.length ? `week__cell--${cls}` : 'week__cell--free', info.bothFree ? 'week__cell--bothfree' : '', past ? 'is-past' : ''].join(' ');
        let content = '';
        if (busy.length > 1) content = `<span class="cell-time">${busy.length}×</span>`;
        else if (busy.length) content = busy[0].time ? `<span class="cell-time">${esc(busy[0].time)}</span>` : icon(busy[0].repeat ? 'repeat' : 'clock', 16);
        return `<button type="button" class="${classes}" style="grid-column:${col};grid-row:${row}" data-day="${iso}" aria-label="${esc(`${WEEKDAYS_LONG[i]}, ${who} ${state}`)}">${content}</button>`;
      };
      cells.push(cell(info.busyMe, 2, 'du', 'me'));
      cells.push(cell(info.busyPartner, 3, partnerName(), 'partner'));
    }
    $('week').innerHTML = cells.join('');

    $('legend').innerHTML = `
      <li><span class="swatch swatch--me"></span>Du</li>
      <li><span class="swatch swatch--partner"></span>${esc(partnerName())}</li>
      <li><span class="swatch swatch--shared"></span>Zusammen</li>
      <li><span class="swatch swatch--bothfree"></span>Beide frei</li>`;

    const list = freeDays.length > 1 ? `${freeDays.slice(0, -1).join(', ')} & ${freeDays.at(-1)}` : freeDays[0];
    $('free').innerHTML = freeDays.length
      ? `<section class="free-card" aria-label="Gemeinsame freie Zeit">
           <span class="free-card__icon" aria-hidden="true">${icon('heart', 22)}</span>
           <div class="free-card__text">
             <p class="free-card__title">Ihr habt beide Zeit</p>
             <p class="free-card__days">${list}</p>
           </div>
           <a class="btn btn--green" href="#/listen/ideen">Date-Ideen</a>
         </section>`
      : `<p class="busy-week">${icon('calendar', 18)} Diese Woche ist schon gut gefüllt.</p>`;
  }

  // ---------- Feste Termine ----------

  function renderFixed() {
    const now = todayISO();
    const fixed = events
      .filter((e) => e.repeat && (!e.repeat.until || e.repeat.until >= now))
      .sort((a, b) => Number(a.owner !== me) - Number(b.owner !== me) || byTime(a, b));
    $('fixed').innerHTML = fixed.length
      ? fixed.map((e) => {
        const cls = e.owner === me ? 'me' : 'partner';
        const meta = [repeatLabel(e.repeat), e.time, e.repeat.until ? `bis ${fmtShort(e.repeat.until)}` : ''].filter(Boolean).join(' · ');
        return `
          <li class="fixed-item">
            <button type="button" class="row-hit" data-event="${e.id}" aria-label="${esc(`${e.title}, ${nameOf(e.owner)}, ${meta}: Details`)}"></button>
            ${avatar(e.owner === me ? couple.names[me] || 'Du' : partnerName(), cls, 'sm')}
            <span class="fixed-item__text"><strong>${esc(e.title)}</strong><small>${esc(meta)}</small></span>
            <span class="fixed-item__icon" aria-hidden="true">${icon('repeat', 18)}</span>
          </li>`;
      }).join('')
      : `<li class="empty">Noch keine festen Termine. Zum Beispiel: Training jeden Dienstag und Donnerstag.</li>`;
  }

  // ---------- Monat ----------

  function renderMonth(direction = 0) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    $('month-title').textContent = `${MONTHS[m]} ${y}`;
    const now = todayISO();
    const lead = weekdayIndex(cursor);
    const parts = WEEKDAYS_SHORT.map((w, i) => `<div class="month__wd ${i > 4 ? 'is-weekend' : ''}" aria-hidden="true">${w}</div>`);
    for (let i = 0; i < lead; i++) parts.push('<div aria-hidden="true"></div>');

    for (let day = 1; day <= daysInMonth(y, m); day++) {
      const iso = toISO(new Date(y, m, day));
      const info = dayInfo(iso);
      const cls = ['month__day'];
      if (info.shared.length) cls.push('has-shared');
      if (iso === now) cls.push('is-today');
      if (iso === selected) cls.push('is-selected');
      if (iso < now) cls.push('is-past');
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
    const grid = $('month');
    grid.innerHTML = parts.join('');
    grid.classList.remove('slide-next', 'slide-prev');
    if (direction) {
      void grid.offsetWidth; // Animation neu starten
      grid.classList.add(direction > 0 ? 'slide-next' : 'slide-prev');
    }
    renderAgenda();
  }

  function renderAgenda() {
    const info = dayInfo(selected);
    const n = diffDays(t, parseISO(selected));
    const rel = n >= 0 && n <= 1 ? inDays(n) : '';
    let html = `
      <div class="agenda__head">
        <h3 class="agenda__title">${fmtLong(selected)}</h3>
        ${rel ? `<span class="tag">${rel}</span>` : ''}
      </div>`;
    if (info.bothFree) {
      html += `
        <div class="agenda-free">
          <p class="free-note">${icon('heart', 18)} Ihr seid beide frei</p>
          <div class="agenda-free__actions">
            <a class="pill-btn pill-btn--soft" href="#/listen/ideen">Date-Ideen</a>
            <button type="button" class="pill-btn" data-action="add-day">${icon('plus', 16)} Eintragen</button>
          </div>
        </div>`;
    } else {
      const items = [...info.shared, ...info.busyMe, ...info.busyPartner].sort(byTime);
      html += `<ul class="agenda">${items.map((e) => {
        const cls = personCls(e);
        const who = cls === 'shared' ? TYPE_LABEL[e.type] : cls === 'me' ? 'Du' : partnerName();
        const meta = [who, e.place, e.repeat ? repeatLabel(e.repeat) : ''].filter(Boolean).map(esc).join(' · ');
        return `
          <li class="agenda-item agenda-item--${cls}">
            <button type="button" class="row-hit" data-event="${e.id}" data-day="${selected}" aria-label="${esc(`${e.title}, ${who}${e.time ? `, ${e.time}` : ''}: Details`)}"></button>
            <span class="agenda-item__time">${e.time ? esc(e.time) : 'ganztags'}</span>
            <span class="agenda-item__bar" aria-hidden="true"></span>
            <span class="agenda-item__body"><strong>${esc(e.title)}</strong><small>${meta}</small></span>
            ${e.repeat ? `<span class="agenda-item__icon" aria-hidden="true">${icon('repeat', 16)}</span>` : ''}
          </li>`;
      }).join('')}</ul>`;
    }
    $('agenda').innerHTML = html;
  }

  function renderSoon() {
    const now = todayISO();
    const soon = events.filter((e) => isShared(e) && (e.end || e.start) >= now).slice(0, 6);
    $('soon').innerHTML = soon.length
      ? soon.map((e) => eventRow(e, true)).join('')
      : '<li class="empty">Noch nichts geplant.</li>';
  }

  function renderAll() {
    if (!couple) return;
    renderWeek();
    renderFixed();
    renderMonth();
    renderSoon();
  }

  // ---------- Details ----------

  function openDetails(id, iso) {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const cls = personCls(ev);
    const canEdit = ev.type !== 'busy' || ev.owner === me;
    const kind = cls === 'shared' ? TYPE_LABEL[ev.type] : cls === 'me' ? 'Du bist verplant' : `${partnerName()} ist verplant`;
    const occurs = ev.repeat && iso && eventCovers(ev, iso);

    const rows = [];
    if (ev.repeat) {
      rows.push(['Wann', repeatLabel(ev.repeat)]);
      rows.push(['Seit', fmtShort(ev.start)]);
      if (ev.repeat.until) rows.push(['Endet', fmtShort(ev.repeat.until)]);
    } else {
      rows.push(['Datum', fmtRange(ev.start, ev.end)]);
    }
    if (ev.time) rows.push(['Uhrzeit', ev.time]);
    if (ev.place) rows.push(['Ort', ev.place]);
    if (ev.note) rows.push(['Notiz', ev.note]);
    if (ev.skip?.length) rows.push(['Ausgelassen', ev.skip.filter((s) => s >= todayISO()).map(fmtShort).join(', ') || '–']);

    openSheet({
      title: ev.title,
      body: `
        <div class="detail">
          <p class="detail__kind detail__kind--${cls}">${icon(ev.repeat ? 'repeat' : TYPE_ICON[ev.type], 18)} ${esc(kind)}</p>
          <dl class="facts">${rows.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <div class="sheet-actions">
            ${!canEdit ? `<p class="muted small">Diesen Eintrag kann nur ${esc(partnerName())} ändern.</p>` : ''}
            ${canEdit && occurs ? `<button type="button" class="btn btn--soft btn--block" data-skip>Nur am ${fmtShort(iso)} auslassen</button>` : ''}
            ${canEdit ? `<button type="button" class="btn btn--ghost btn--block btn--danger" data-delete>${icon('trash', 18)} ${ev.repeat ? 'Ganze Serie löschen' : 'Eintrag löschen'}</button>` : ''}
          </div>
        </div>`,
      onMount(dlg, close) {
        dlg.querySelector('[data-skip]')?.addEventListener('click', async () => {
          await db.skipOccurrence(ev.id, iso);
          close();
          toast(`Am ${fmtShort(iso)} ausgelassen`);
        });
        const del = dlg.querySelector('[data-delete]');
        del?.addEventListener('click', async () => {
          // Zweimal tippen zum Löschen, damit nichts aus Versehen verschwindet
          if (!del.dataset.confirm) {
            del.dataset.confirm = '1';
            del.textContent = 'Wirklich löschen? Nochmal tippen';
            return;
          }
          await db.deleteEvent(ev.id);
          close();
          toast('Gelöscht');
        });
      },
    });
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

  function selectDay(iso, scroll) {
    selected = iso;
    const d = parseISO(iso);
    cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    renderMonth();
    if (scroll) $('agenda').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function shiftMonth(step) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, 1);
    renderMonth(step);
  }

  function addEntry(preset) {
    openEventForm({
      heading: preset.repeat ? 'Fester Termin' : 'Neuer Eintrag',
      preset,
      onSave: async (data) => {
        await db.addEvent(data);
        toast(data.repeat ? 'Fester Termin gespeichert' : 'Eingetragen');
      },
    });
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { action, day, event: eventId } = btn.dataset;
    if (eventId) openDetails(eventId, day);
    else if (action === 'prev') shiftMonth(-1);
    else if (action === 'next') shiftMonth(1);
    else if (action === 'today') {
      selectDay(todayISO(), false);
      $('month-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action === 'add-fixed') addEntry({ type: 'busy', repeat: 'weekly' });
    else if (action === 'add-day') addEntry({ start: selected });
    else if (day) selectDay(day, btn.classList.contains('week__cell'));
  });

  // Monat per Wischen wechseln
  let touch = null;
  $('month').addEventListener('touchstart', (e) => {
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  $('month').addEventListener('touchend', (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) shiftMonth(dx < 0 ? 1 : -1);
  });

  fab.addEventListener('click', () => addEntry({ start: selected >= todayISO() ? selected : todayISO() }));

  return () => {
    unsubs.forEach((u) => u());
    fab.remove();
  };
}
