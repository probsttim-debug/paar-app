// Bildschirm „Koppeln": Paar anlegen (Code bekommen) oder mit Code beitreten.
// Im Zustand „waiting" wird der eigene Code angezeigt, bis die Partnerin beigetreten ist.

import * as db from '../data.js';
import { esc, todayISO } from '../util.js';
import { icon, openSheet, toast } from '../ui.js';

export function renderKoppeln(root, { session }) {
  if (session.status === 'waiting') return renderWaiting(root, session);
  return renderChoose(root);
}

function renderChoose(root) {
  const user = db.getCurrentUser();

  root.innerHTML = `
    <div class="gate">
      <header>
        <p class="eyebrow">Fast geschafft</p>
        <h1 class="page-title">Jetzt koppeln</h1>
        <p class="muted gate__lead">Eine von euch legt das Paar an und bekommt einen Code. Die andere Person tritt mit diesem Code bei.</p>
      </header>

      <section class="card">
        <label class="field">
          <span class="card-title">Wie heißt du?</span>
          <input class="input" name="name" maxlength="30" autocomplete="given-name" value="${esc(user.name)}" placeholder="Dein Vorname">
        </label>
      </section>

      <form class="card form" data-el="create" novalidate>
        <h2 class="card-title">Neues Paar anlegen</h2>
        <label class="field">
          <span class="label">Seit wann seid ihr zusammen?</span>
          <input class="input" type="date" name="startDate" max="${todayISO()}" required>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn btn--primary btn--block" type="submit">${icon('heart', 20)} Paar anlegen</button>
      </form>

      <form class="card form" data-el="join" novalidate>
        <h2 class="card-title">Ich habe einen Code</h2>
        <label class="field">
          <span class="label">Einladungscode</span>
          <input class="input input--code" name="code" maxlength="9" placeholder="ABCD-EFGH" autocomplete="off" autocapitalize="characters" spellcheck="false">
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn btn--soft btn--block" type="submit">Beitreten</button>
      </form>

      <p class="gate__foot">Angemeldet als ${esc(user.email)} · <button type="button" class="btn-link" data-el="logout">Abmelden</button></p>
    </div>`;

  const nameInput = root.querySelector('input[name="name"]');

  function bind(formName, action) {
    const form = root.querySelector(`[data-el="${formName}"]`);
    const error = form.querySelector('.form-error');
    const btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.hidden = true;
      if (!nameInput.value.trim()) {
        nameInput.focus();
        error.textContent = 'Bitte gib oben zuerst deinen Namen ein.';
        error.hidden = false;
        return;
      }
      const label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Moment …';
      try {
        await action(form);
        // Die Ansicht wechselt automatisch, sobald Firestore das Paar meldet
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        if (btn.isConnected) {
          btn.disabled = false;
          btn.innerHTML = label;
        }
      }
    });
  }

  bind('create', (form) => db.createCouple({ name: nameInput.value, startDate: form.elements.startDate.value }));
  bind('join', (form) => db.joinCouple({ name: nameInput.value, code: form.elements.code.value }));

  // Code beim Tippen als ABCD-EFGH formatieren
  root.querySelector('input[name="code"]').addEventListener('input', (e) => {
    const raw = db.normalizeCode(e.target.value).slice(0, 8);
    e.target.value = raw.length > 4 ? db.formatCode(raw) : raw;
  });

  root.querySelector('[data-el="logout"]').addEventListener('click', () => db.signOut());
}

function renderWaiting(root, session) {
  const user = db.getCurrentUser();
  const code = db.formatCode(session.couple.inviteCode);
  const shareText = `Komm in unsere Paar-App! Melde dich an und gib diesen Code ein: ${code}\n${location.origin}${location.pathname}`;

  root.innerHTML = `
    <div class="gate">
      <header>
        <p class="eyebrow">Hallo ${esc(user.name)}</p>
        <h1 class="page-title">Euer Einladungscode</h1>
        <p class="muted gate__lead">Schick diesen Code an die andere Person. Sie legt ein eigenes Konto an und gibt ihn unter „Ich habe einen Code“ ein.</p>
      </header>

      <section class="card code-card">
        <p class="code-display" aria-label="Code: ${esc(code.split('').join(' '))}">${esc(code)}</p>
        <div class="code-card__actions">
          ${navigator.share ? `<button type="button" class="btn btn--primary" data-el="share">Code teilen</button>` : ''}
          <button type="button" class="btn ${navigator.share ? 'btn--ghost' : 'btn--primary'}" data-el="copy">Kopieren</button>
        </div>
        <p class="waiting" role="status"><span class="waiting__dot" aria-hidden="true"></span> Warte auf die andere Person … Es geht automatisch weiter.</p>
      </section>

      <p class="gate__foot">
        <button type="button" class="btn-link" data-el="cancel">Doch lieber selbst einen Code eingeben</button><br>
        Angemeldet als ${esc(user.email)} · <button type="button" class="btn-link" data-el="logout">Abmelden</button>
      </p>
    </div>`;

  const $ = (name) => root.querySelector(`[data-el="${name}"]`);

  $('share')?.addEventListener('click', () => {
    navigator.share({ title: 'Paar-App', text: shareText }).catch(() => {});
  });

  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Code kopiert');
    } catch {
      toast('Kopieren ging nicht. Bitte abschreiben.');
    }
  });

  $('cancel').addEventListener('click', () => {
    openSheet({
      title: 'Paar wieder löschen?',
      body: `
        <p class="muted" style="margin-bottom:16px">Dein Code wird ungültig. Danach kannst du selbst einen Code eingeben oder neu anlegen.</p>
        <div class="sheet-actions">
          <button type="button" class="btn btn--primary btn--block" data-confirm>Ja, löschen</button>
          <button type="button" class="btn btn--ghost btn--block" data-sheet-close>Abbrechen</button>
        </div>`,
      onMount(dlg, close) {
        dlg.querySelector('[data-confirm]').addEventListener('click', async () => {
          try {
            await db.cancelCouple();
          } catch (err) {
            console.error(err);
            toast('Löschen hat nicht geklappt.');
          }
          close();
        });
      },
    });
  });

  $('logout').addEventListener('click', () => db.signOut());
}
