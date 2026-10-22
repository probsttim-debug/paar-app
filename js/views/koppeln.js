// Bildschirm „Koppeln": Paar anlegen (Code bekommen) oder mit Code beitreten.
// Nach dem Anlegen geht es sofort in die App; der Code steht dort auf dem Start-Bildschirm.

import * as db from '../data.js';
import { esc, todayISO } from '../util.js';
import { icon } from '../ui.js';
import { genderPicker } from './common.js';

export function renderKoppeln(root) {
  renderChoose(root);
  // Zurück = abmelden, z. B. nach einem Tippfehler bei E-Mail oder Passwort
  root.querySelector('[data-el="back"]').addEventListener('click', () => db.signOut());
}

function renderChoose(root) {
  const user = db.getCurrentUser();

  root.innerHTML = `
    <div class="gate">
      <button type="button" class="back-btn" data-el="back">${icon('left', 20)} Zurück zur Anmeldung</button>
      <header>
        <p class="eyebrow">Fast geschafft</p>
        <h1 class="page-title">Jetzt koppeln</h1>
        <p class="muted gate__lead">Eine von euch legt das Paar an und kann die App sofort nutzen. Die andere Person tritt später mit dem Code bei, den du dann auf dem Start-Bildschirm findest.</p>
      </header>

      <section class="card form">
        <label class="field">
          <span class="card-title">Wie heißt du?</span>
          <input class="input" name="name" maxlength="30" autocomplete="given-name" value="${esc(user.name)}" placeholder="Dein Vorname">
        </label>
        <div class="field">
          <span class="label">Ich bin</span>
          ${genderPicker(null)}
        </div>
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
  let gender = null;
  root.querySelector('.gender-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-gender]');
    if (!btn) return;
    gender = btn.dataset.gender;
    root.querySelectorAll('[data-gender]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });

  function bind(formName, action) {
    const form = root.querySelector(`[data-el="${formName}"]`);
    const error = form.querySelector('.form-error');
    const btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.hidden = true;
      if (!nameInput.value.trim() || !gender) {
        if (!nameInput.value.trim()) nameInput.focus();
        error.textContent = !nameInput.value.trim() ? 'Bitte gib oben zuerst deinen Namen ein.' : 'Bitte wähle oben, ob du Mann oder Frau bist.';
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

  bind('create', (form) => db.createCouple({ name: nameInput.value, gender, startDate: form.elements.startDate.value }));
  bind('join', (form) => db.joinCouple({ name: nameInput.value, gender, code: form.elements.code.value }));

  // Code beim Tippen als ABCD-EFGH formatieren
  root.querySelector('input[name="code"]').addEventListener('input', (e) => {
    const raw = db.normalizeCode(e.target.value).slice(0, 8);
    e.target.value = raw.length > 4 ? db.formatCode(raw) : raw;
  });

  root.querySelector('[data-el="logout"]').addEventListener('click', () => db.signOut());
}
