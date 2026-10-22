// Hilfsfunktionen für Datum, Text und Formatierung.
// Datumswerte werden als 'YYYY-MM-DD' (lokale Zeit) gespeichert und verglichen.

export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISO(s) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISO(today());
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Anzahl Kalendertage von a bis b (b - a). */
export function diffDays(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** 0 = Montag … 6 = Sonntag */
export function weekdayIndex(d) {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d) {
  return addDays(startOfDay(d), -weekdayIndex(d));
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** „Donnerstag, 23. Oktober" */
export function fmtLong(iso) {
  const d = parseISO(iso);
  return `${WEEKDAYS_LONG[weekdayIndex(d)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** „14. Mai 2023" */
export function fmtDate(iso) {
  const d = parseISO(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** „Do, 23.10." */
export function fmtShort(iso) {
  const d = parseISO(iso);
  return `${WEEKDAYS_SHORT[weekdayIndex(d)]}, ${d.getDate()}.${d.getMonth() + 1}.`;
}

/** Zeitraum eines Termins, z. B. „Sa, 25.10." oder „Fr, 5.12. – Mo, 8.12." */
export function fmtRange(start, end) {
  if (!end || end === start) return fmtShort(start);
  return `${fmtShort(start)} – ${fmtShort(end)}`;
}

/** „vor 5 Min.", „vor 2 Std.", „gestern" … */
export function relTime(isoDateTime) {
  if (!isoDateTime) return '';
  const diff = Date.now() - new Date(isoDateTime).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const days = diffDays(new Date(isoDateTime), new Date());
  if (days <= 1) return 'gestern';
  return `vor ${days} Tagen`;
}

/** „heute", „morgen", „in 3 Tagen" */
export function inDays(n) {
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  return `in ${n} Tagen`;
}

export function fmtNumber(n) {
  return n.toLocaleString('de-DE');
}

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initials(name) {
  return (name || '?').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export function moodWord(v) {
  if (v < 20) return 'Mies';
  if (v < 40) return 'Naja';
  if (v < 60) return 'Okay';
  if (v < 80) return 'Gut';
  return 'Super';
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 11) return 'Guten Morgen';
  if (h >= 11 && h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/** Findet der Termin an diesem Tag (ISO) statt? Berücksichtigt wöchentliche Wiederholung. */
export function eventCovers(ev, iso) {
  if (ev.repeat) {
    if (iso < ev.start || (ev.repeat.until && iso > ev.repeat.until)) return false;
    if (ev.skip?.includes(iso)) return false;
    return ev.repeat.weekdays.includes(weekdayIndex(parseISO(iso)));
  }
  return ev.start <= iso && (ev.end || ev.start) >= iso;
}

/** „Jeden Di & Do", „Jeden Montag", „Werktags", „Jeden Tag" */
export function repeatLabel(repeat) {
  const days = [...repeat.weekdays].sort((a, b) => a - b);
  if (days.length === 7) return 'Jeden Tag';
  if (days.join() === '0,1,2,3,4') return 'Werktags';
  if (days.length === 1) return `Jeden ${WEEKDAYS_LONG[days[0]]}`;
  const names = days.map((d) => WEEKDAYS_SHORT[d]);
  return `Jeden ${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

/** Kalenderwoche nach ISO 8601 */
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

export function isShared(ev) {
  return ev.type !== 'busy';
}

/** Anzahl Tage eines Termins inklusive Start- und Endtag. */
export function eventLength(ev) {
  return diffDays(parseISO(ev.start), parseISO(ev.end || ev.start)) + 1;
}

/**
 * Alles für die Zusammen-Karte: Gesamttage, Jahre/Monate/Tage
 * und der Weg bis zum nächsten Jahrestag.
 */
export function together(startISO, now = today()) {
  const start = parseISO(startISO);
  const totalDays = diffDays(start, now);

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    days += daysInMonth(prevYear, prevMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const lastAnniv = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
  const nextAnniv = new Date(start.getFullYear() + years + 1, start.getMonth(), start.getDate());
  const daysToAnniv = diffDays(now, nextAnniv);
  const span = diffDays(lastAnniv, nextAnniv);
  const progress = Math.min(1, Math.max(0, diffDays(lastAnniv, now) / span));

  return {
    totalDays,
    years,
    months,
    days,
    isAnniversaryToday: years > 0 && months === 0 && days === 0,
    nextAnnivNumber: years + 1,
    nextAnnivISO: toISO(nextAnniv),
    daysToAnniv,
    progress,
  };
}
