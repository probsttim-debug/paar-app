// Bildschirm „Anmelden / Registrieren" (E-Mail und Passwort).

import * as db from '../data.js';
import { icon } from '../ui.js';

export function renderAuth(root) {
  let mode = 'login';

  root.innerHTML = `
    <div class="gate">
      <div class="gate__brand">
        <span class="gate__logo" aria-hidden="true">${icon('heart', 34)}</span>
        <h1 class="page-title">Paar-App</h1>
        <p class="muted">Euer gemeinsamer Kalender, eure Listen und wie es euch gerade geht.</p>
      </div>

      <div class="seg" role="group" aria-label="Anmelden oder registrieren">
        <button type="button" data-mode="login" aria-pressed="true">Anmelden</button>
        <button type="button" data-mode="register" aria-pressed="false">Konto erstellen</button>
      </div>

      <form class="form card" novalidate>
        <label class="field">
          <span class="label">E-Mail</span>
          <input class="input" type="email" name="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" required>
        </label>
        <div class="field">
          <label class="label" for="pw">Passwort</label>
          <div class="pw-wrap">
            <input class="input" type="password" id="pw" name="password" autocomplete="current-password" minlength="6" required>
            <button type="button" class="pw-toggle" data-el="pw-toggle" aria-label="Passwort anzeigen" aria-pressed="false">${icon('eye', 22)}</button>
          </div>
          <small class="muted small" data-el="pw-hint" hidden>Mindestens 6 Zeichen.</small>
        </div>
        <label class="field" data-el="confirm-field" hidden>
          <span class="label">Passwort wiederholen</span>
          <input class="input" type="password" name="confirm" autocomplete="new-password" minlength="6">
        </label>
        <p class="form-error" role="alert" hidden></p>
        <p class="form-info" role="status" hidden></p>
        <button class="btn btn--primary btn--block" type="submit" data-el="submit">Anmelden</button>
        <button class="btn-link" type="button" data-el="forgot">Passwort vergessen?</button>
      </form>
    </div>`;

  const $ = (name) => root.querySelector(`[data-el="${name}"]`);
  const form = root.querySelector('form');
  const error = root.querySelector('.form-error');
  const info = root.querySelector('.form-info');

  function show(el, text) {
    el.textContent = text;
    el.hidden = !text;
  }

  function setMode(next) {
    mode = next;
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('submit').textContent = mode === 'login' ? 'Anmelden' : 'Konto erstellen';
    form.elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('pw-hint').hidden = mode === 'login';
    $('confirm-field').hidden = mode === 'login';
    $('forgot').hidden = mode !== 'login';
    show(error, '');
    show(info, '');
  }

  async function busy(fn) {
    const btn = $('submit');
    btn.disabled = true;
    btn.textContent = 'Moment …';
    show(error, '');
    show(info, '');
    try {
      await fn();
    } catch (err) {
      show(error, err.message);
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.textContent = mode === 'login' ? 'Anmelden' : 'Konto erstellen';
      }
    }
  }

  root.querySelector('.seg').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.elements.email.value;
    const password = form.elements.password.value;
    if (!email.trim()) return show(error, 'Bitte gib deine E-Mail-Adresse ein.');
    if (mode === 'register' && password.length < 6) return show(error, 'Das Passwort braucht mindestens 6 Zeichen.');
    if (!password) return show(error, 'Bitte gib dein Passwort ein.');
    if (mode === 'register' && password !== form.elements.confirm.value) {
      return show(error, 'Die beiden Passwörter stimmen nicht überein.');
    }
    busy(() => (mode === 'login' ? db.signIn(email, password) : db.register(email, password)));
  });

  // Passwort ein- und ausblenden (gilt für beide Passwortfelder)
  $('pw-toggle').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const visible = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(visible));
    btn.setAttribute('aria-label', visible ? 'Passwort verbergen' : 'Passwort anzeigen');
    btn.innerHTML = icon(visible ? 'eyeOff' : 'eye', 22);
    form.elements.password.type = visible ? 'text' : 'password';
    form.elements.confirm.type = visible ? 'text' : 'password';
  });

  $('forgot').addEventListener('click', async () => {
    const email = form.elements.email.value;
    if (!email.trim()) {
      show(error, 'Gib zuerst oben deine E-Mail-Adresse ein.');
      form.elements.email.focus();
      return;
    }
    try {
      await db.resetPassword(email);
      show(error, '');
      show(info, 'Falls es ein Konto mit dieser Adresse gibt, kommt gleich eine E-Mail zum Zurücksetzen.');
    } catch (err) {
      show(error, err.message);
    }
  });
}
