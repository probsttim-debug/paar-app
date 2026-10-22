// Bildschirm „Statistik": wird komplett im Browser aus Kalender, To-dos und Stimmungslog berechnet.

import * as db from '../data.js';
import {
  esc, today, todayISO, toISO, addDays, parseISO, startOfWeek, diffDays, fmtShort, inDays,
  WEEKDAYS_SHORT, WEEKDAYS_LONG, eventLength, isShared,
} from '../util.js';
import { icon } from '../ui.js';

export function renderStatistik(root) {
  const me = db.getCurrentUser().uid;
  let range = 'jahr';
  let couple = null;
  let events = [];
  let todos = [];
  let moodWeek = [];

  root.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Statistik</h1>
    </header>
    <div class="seg" role="group" aria-label="Zeitraum" data-el="range">
      <button type="button" data-range="jahr" aria-pressed="true">Dieses Jahr</button>
      <button type="button" data-range="gesamt" aria-pressed="false">Gesamt</button>
    </div>
    <div class="countdowns" data-el="countdowns"></div>
    <div class="tiles" data-el="tiles"></div>
    <section class="card" aria-labelledby="h-cmp">
      <h2 id="h-cmp" class="card-title">Erledigte To-dos im Vergleich</h2>
      <div data-el="compare"></div>
    </section>
    <section class="card" aria-labelledby="h-moodweek">
      <h2 id="h-moodweek" class="card-title">Stimmung der Woche</h2>
      <div data-el="moodweek"></div>
    </section>
    <section class="card" aria-labelledby="h-facts">
      <h2 id="h-facts" class="card-title">Rekorde</h2>
      <dl class="facts" data-el="facts"></dl>
    </section>`;

  const $ = (name) => root.querySelector(`[data-el="${name}"]`);
  const partner = () => couple?.members.find((u) => u !== me);
  const partnerName = () => couple?.names?.[partner()] || 'Partnerin';

  function inRange(iso) {
    return range === 'gesamt' || iso.slice(0, 4) === String(today().getFullYear());
  }

  function render() {
    if (!couple) return;
    const now = todayISO();
    const past = events.filter((e) => isShared(e) && e.start <= now && inRange(e.start));

    // Countdowns
    const nextOf = (type) => events.find((e) => e.type === type && (e.end || e.start) >= now);
    const countdown = (ev, label, iconName) => {
      if (!ev) return `<div class="countdown card"><p class="eyebrow">${label}</p><p class="countdown__big">–</p><p class="muted small">Noch nichts geplant</p></div>`;
      const n = diffDays(today(), parseISO(ev.start));
      return `
        <div class="countdown card countdown--${ev.type}">
          <p class="eyebrow">${icon(iconName, 16)} ${label}</p>
          <p class="countdown__big">${n < 0 ? 'läuft' : inDays(n)}</p>
          <p class="small"><strong>${esc(ev.title)}</strong><br><span class="muted">${fmtShort(ev.start)}</span></p>
        </div>`;
    };
    $('countdowns').innerHTML = countdown(nextOf('date'), 'Nächstes Date', 'heart') + countdown(nextOf('trip'), 'Nächster Urlaub', 'plane');

    // Kacheln
    const dates = past.filter((e) => e.type === 'date').length;
    let tripDays = 0;
    for (const trip of events.filter((e) => e.type === 'trip')) {
      for (let i = 0; i < eventLength(trip); i++) {
        const iso = toISO(addDays(parseISO(trip.start), i));
        if (iso <= now && inRange(iso)) tripDays++;
      }
    }
    const places = new Set(past.filter((e) => e.place).map((e) => e.place.trim().toLowerCase()));
    const doneTodos = todos.filter((t) => t.done && inRange(toISO(new Date(t.doneAt))));
    const tile = (n, label, iconName) => `
      <div class="tile card"><span class="tile__icon">${icon(iconName, 20)}</span><strong class="tile__num">${n}</strong><span class="tile__label">${label}</span></div>`;
    $('tiles').innerHTML =
      tile(dates, dates === 1 ? 'Date' : 'Dates', 'heart') +
      tile(tripDays, tripDays === 1 ? 'Urlaubstag' : 'Urlaubstage', 'plane') +
      tile(places.size, places.size === 1 ? 'besuchter Ort' : 'besuchte Orte', 'pin') +
      tile(doneTodos.length, 'erledigte To-dos', 'check');

    // Vergleich To-dos
    const mine = doneTodos.filter((t) => t.doneBy === me).length;
    const theirs = doneTodos.filter((t) => t.doneBy !== me).length;
    const max = Math.max(mine, theirs, 1);
    const bar = (label, n, cls) => `
      <div class="hbar">
        <span class="hbar__label">${esc(label)}</span>
        <span class="hbar__track"><span class="hbar__fill hbar__fill--${cls}" style="width:${(n / max) * 100}%"></span></span>
        <strong class="hbar__num">${n}</strong>
      </div>`;
    $('compare').innerHTML = bar('Du', mine, 'me') + bar(partnerName(), theirs, 'partner');

    renderMoodWeek();

    // Rekorde
    const counts = {};
    past.filter((e) => e.place).forEach((e) => {
      counts[e.place] = (counts[e.place] || 0) + 1;
    });
    const topPlace = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const trips = events.filter((e) => e.type === 'trip' && e.start <= now && inRange(e.start)).sort((a, b) => eventLength(b) - eventLength(a));
    const longest = trips[0];
    $('facts').innerHTML = `
      <div class="fact"><dt>${icon('pin', 18)} Häufigster Ort</dt><dd>${topPlace ? `${esc(topPlace[0])} <span class="muted">(${topPlace[1]}×)</span>` : '–'}</dd></div>
      <div class="fact"><dt>${icon('plane', 18)} Längster Urlaub</dt><dd>${longest ? `${esc(longest.place || longest.title)} <span class="muted">(${eventLength(longest)} Tage)</span>` : '–'}</dd></div>`;
  }

  function renderMoodWeek() {
    const ws = startOfWeek(today());
    const other = partner();
    const days = WEEKDAYS_SHORT.map((short, i) => {
      const iso = toISO(addDays(ws, i));
      const val = (uid) => moodWeek.find((m) => m.date === iso && m.uid === uid)?.value;
      return { short, long: WEEKDAYS_LONG[i], me: val(me), partner: val(other) };
    });

    const bar = (v, cls) => (v == null
      ? `<span class="vbar vbar--empty"></span>`
      : `<span class="vbar vbar--${cls}" style="height:${v}%"></span>`);
    const groups = days.map((d) => {
      const label = d.me == null && d.partner == null
        ? `${d.long}: noch keine Werte`
        : `${d.long}: Du ${d.me ?? '–'}, ${partnerName()} ${d.partner ?? '–'}`;
      return `
        <div class="chart__group" role="img" aria-label="${esc(label)}">
          <div class="chart__bars">${bar(d.me, 'me')}${bar(d.partner, 'partner')}</div>
          <span class="chart__day">${d.short}</span>
        </div>`;
    }).join('');

    // Bester Tag: Durchschnitt beider Werte
    const scored = days
      .map((d) => {
        const vals = [d.me, d.partner].filter((v) => v != null);
        return { ...d, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
      })
      .filter((d) => d.avg != null);
    let sentence = 'Diese Woche gibt es noch keine Stimmungswerte.';
    if (scored.length) {
      const best = Math.max(...scored.map((d) => d.avg));
      const bestDays = scored.filter((d) => d.avg === best).map((d) => d.long);
      const list = bestDays.length > 1 ? `${bestDays.slice(0, -1).join(', ')} und ${bestDays.at(-1)}` : bestDays[0];
      sentence = `Am besten ging's euch am <strong>${list}</strong> (Ø ${Math.round(best)}).`;
    }

    $('moodweek').innerHTML = `
      <div class="chart">
        <div class="chart__axis" aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
        <div class="chart__plot">
          <div class="chart__grid" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="chart__groups">${groups}</div>
        </div>
      </div>
      <ul class="legend" aria-hidden="true">
        <li><span class="swatch swatch--me"></span>Du</li>
        <li><span class="swatch swatch--partner"></span>${esc(partnerName())}</li>
      </ul>
      <p class="chart__sentence">${sentence}</p>`;
  }

  async function loadMoodWeek() {
    const ws = startOfWeek(today());
    moodWeek = await db.getMoodLog(toISO(ws), toISO(addDays(ws, 6)));
    render();
  }

  const unsubs = [
    db.watchCouple((c) => {
      couple = c;
      render();
    }),
    db.watchEvents((e) => {
      events = e;
      render();
    }),
    db.watchTodos((t) => {
      todos = t;
      render();
    }),
  ];
  loadMoodWeek();

  $('range').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-range]');
    if (!btn) return;
    range = btn.dataset.range;
    $('range').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    render();
  });

  return () => unsubs.forEach((u) => u());
}
