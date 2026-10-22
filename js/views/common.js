// Bausteine, die mehrere Bildschirme nutzen: Terminzeile und Formular für neue Einträge.

import { esc, fmtRange, parseISO, weekdayIndex, WEEKDAYS_SHORT, todayISO, diffDays, today, inDays } from '../util.js';
import { icon, openSheet, toast } from '../ui.js';

/** Code anzeigen plus Teilen/Kopieren, z. B. „K7MP-Q3XR". */
export function inviteBlock(code) {
  return `
    <p class="code-display" aria-label="Code: ${esc(code.split('').join(' '))}">${esc(code)}</p>
    <div class="code-card__actions">
      ${navigator.share ? `<button type="button" class="btn btn--primary" data-invite="share">Code teilen</button>` : ''}
      <button type="button" class="btn ${navigator.share ? 'btn--ghost' : 'btn--primary'}" data-invite="copy">Kopieren</button>
    </div>`;
}

/** Klicks auf [data-invite] innerhalb von container behandeln. */
export function bindInvite(container, getCode) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-invite]');
    if (!btn) return;
    const code = getCode();
    if (btn.dataset.invite === 'share') {
      const text = `Komm in unsere Paar-App! Melde dich an und gib diesen Code ein: ${code}\n${location.origin}${location.pathname}`;
      navigator.share({ title: 'Paar-App', text }).catch(() => {});
    } else {
      try {
        await navigator.clipboard.writeText(code);
        toast('Code kopiert');
      } catch {
        toast('Kopieren ging nicht. Bitte abschreiben.');
      }
    }
  });
}

export const TYPE_LABEL = { date: 'Date', trip: 'Urlaub', other: 'Gemeinsam', busy: 'Verplant' };
export const TYPE_ICON = { date: 'heart', trip: 'plane', other: 'star', busy: 'clock' };

/** Eine Zeile für einen gemeinsamen Termin (Start und Kalender). Mit tappable=true öffnet sie die Details. */
export function eventRow(ev, tappable = false) {
  const d = parseISO(ev.start);
  const meta = [fmtRange(ev.start, ev.end), ev.time, ev.place].filter(Boolean).map(esc).join(' · ');
  const startsIn = diffDays(today(), d);
  const when = startsIn < 0 ? 'läuft' : inDays(startsIn);
  return `
    <li class="event-row event-row--${ev.type}">
      ${tappable ? `<button type="button" class="row-hit" data-event="${ev.id}" data-day="${ev.start}" aria-label="${esc(ev.title)}: Details"></button>` : ''}
      <span class="datebadge" aria-hidden="true"><small>${WEEKDAYS_SHORT[weekdayIndex(d)]}</small><strong>${d.getDate()}</strong></span>
      <span class="event-row__text">
        <strong>${esc(ev.title)}</strong>
        <small>${meta}</small>
      </span>
      <span class="tag tag--${ev.type}">${icon(TYPE_ICON[ev.type], 14)}${when}</span>
    </li>`;
}

/**
 * Bottom-Sheet zum Eintragen: Date, Urlaub, Sonstiges gemeinsam oder „Ich bin verplant".
 * „Ich bin verplant" kann einmalig sein oder jede Woche an bestimmten Wochentagen.
 * preset: Vorbelegung (z. B. aus einer Date-Idee, repeat: 'weekly'), onSave(data) speichert.
 */
export function openEventForm({ heading = 'Neuer Eintrag', preset = {}, onSave }) {
  const p = { type: 'date', start: todayISO(), ...preset };
  const types = [
    ['date', 'Date'],
    ['trip', 'Urlaub'],
    ['other', 'Sonstiges gemeinsam'],
    ['busy', 'Ich bin verplant'],
  ];

  const body = `
    <form class="form" novalidate>
      <fieldset class="field">
        <legend class="label">Art</legend>
        <div class="type-grid">
          ${types.map(([value, label]) => `
            <label class="type-opt type-opt--${value}">
              <input type="radio" name="type" value="${value}" ${p.type === value ? 'checked' : ''}>
              <span>${icon(TYPE_ICON[value], 20)}${label}</span>
            </label>`).join('')}
        </div>
      </fieldset>

      <fieldset class="field" data-el="repeat-field">
        <legend class="label">Wie oft?</legend>
        <div class="seg seg--compact" role="group">
          <button type="button" data-repeat="once">Einmalig</button>
          <button type="button" data-repeat="weekly">${icon('repeat', 18)} Jede Woche</button>
        </div>
        <div class="weekday-picker" data-el="weekdays" role="group" aria-label="Wochentage">
          ${WEEKDAYS_SHORT.map((d, i) => `
            <label class="weekday-opt"><input type="checkbox" name="weekday" value="${i}"><span>${d}</span></label>`).join('')}
        </div>
      </fieldset>

      <label class="field">
        <span class="label" data-title-label>Titel</span>
        <input class="input" name="title" maxlength="80" autocomplete="off" value="${esc(p.title || '')}">
      </label>
      <div class="field-row">
        <label class="field"><span class="label" data-start-label>Von</span><input class="input" type="date" name="start" value="${esc(p.start)}" required></label>
        <label class="field"><span class="label" data-end-label>Bis (optional)</span><input class="input" type="date" name="end" value="${esc(p.end || '')}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="label">Uhrzeit</span><input class="input" type="time" name="time" value="${esc(p.time || '')}"></label>
        <label class="field"><span class="label">Ort</span><input class="input" name="place" maxlength="60" autocomplete="off" value="${esc(p.place || '')}"></label>
      </div>
      <label class="field"><span class="label">Notiz</span><textarea class="input" name="note" rows="2" maxlength="200">${esc(p.note || '')}</textarea></label>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn--primary btn--block" type="submit">Speichern</button>
    </form>`;

  openSheet({
    title: heading,
    body,
    onMount(dlg, close) {
      const form = dlg.querySelector('form');
      const q = (sel) => form.querySelector(sel);
      const error = q('.form-error');
      let repeat = p.repeat === 'weekly' ? 'weekly' : 'once';

      const weekdayBoxes = () => [...form.querySelectorAll('input[name="weekday"]')];
      const startWeekday = () => (form.elements.start.value ? weekdayIndex(parseISO(form.elements.start.value)) : 0);

      const sync = () => {
        const busy = form.elements.type.value === 'busy';
        const weekly = busy && repeat === 'weekly';
        q('[data-el="repeat-field"]').hidden = !busy;
        q('[data-el="weekdays"]').hidden = !weekly;
        form.querySelectorAll('[data-repeat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.repeat === repeat)));
        q('[data-title-label]').textContent = busy ? `Was hast du vor?${weekly ? '' : ' (optional)'}` : 'Titel';
        form.elements.title.placeholder = busy ? (weekly ? 'z. B. Training, Chor' : 'z. B. Arbeit, Arzt') : 'z. B. Kino, Essen gehen';
        q('[data-start-label]').textContent = weekly ? 'Ab' : 'Von';
        q('[data-end-label]').textContent = weekly ? 'Endet am (optional)' : 'Bis (optional)';
        // Beim Umschalten auf „Jede Woche" den Wochentag des Datums vorwählen
        if (weekly && !weekdayBoxes().some((b) => b.checked)) weekdayBoxes()[startWeekday()].checked = true;
      };

      form.addEventListener('change', (e) => (e.target.name === 'type' || e.target.name === 'start') && sync());
      form.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-repeat]');
        if (!btn) return;
        repeat = btn.dataset.repeat;
        sync();
      });
      sync();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const data = Object.fromEntries(fd);
        const busy = data.type === 'busy';
        const weekly = busy && repeat === 'weekly';
        const fail = (msg) => {
          error.textContent = msg;
          error.hidden = false;
        };
        delete data.weekday;
        if (!busy && !data.title.trim()) return fail('Bitte gib einen Titel ein.');
        if (weekly && !data.title.trim()) return fail('Bitte schreib dazu, was du jede Woche vorhast.');
        if (!data.start) return fail('Bitte wähle ein Datum.');
        if (data.end && data.end < data.start) {
          return fail(weekly ? '„Endet am“ darf nicht vor „Ab“ liegen.' : '„Bis“ darf nicht vor „Von“ liegen.');
        }
        if (weekly) {
          const weekdays = fd.getAll('weekday').map(Number);
          if (!weekdays.length) return fail('Bitte wähle mindestens einen Wochentag.');
          data.repeat = { weekdays, until: data.end || undefined };
          delete data.end;
        }
        if (busy && !data.title.trim()) data.title = 'Verplant';
        await onSave(data);
        close();
      });
    },
  });
}
