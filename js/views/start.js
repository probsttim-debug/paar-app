// Bildschirm „Start": Begrüßung, Zusammen-Karte, Stimmungen, Bedürfnis, Als Nächstes.

import * as db from '../data.js';
import { esc, fmtDate, fmtNumber, greeting, moodWord, relTime, together, todayISO, isShared } from '../util.js';
import { icon, avatar, face, mouthPath, openSheet, toast } from '../ui.js';
import { eventRow, inviteBlock, bindInvite, genderPicker } from './common.js';
import { partnerWord } from '../theme.js';

const NEEDS = ['Brauch Ruhe', 'Brauch eine Umarmung', 'Lust was zu unternehmen'];

export function renderStart(root) {
  const me = db.getCurrentUser().uid;
  let couple = null;
  let moods = null;
  let events = [];
  let todos = [];
  let photo = null;
  let sliderReady = false;

  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${greeting()}</p>
        <h1 class="page-title">Ihr zwei</h1>
      </div>
      <button type="button" class="avatar-pair" data-el="avatars" data-action="account" aria-label="Konto und Abmelden"></button>
    </header>

    <section class="together" data-el="together" aria-label="Zusammen"></section>
    <input type="file" accept="image/*" data-el="file" hidden>

    <section aria-labelledby="h-moods">
      <h2 id="h-moods" class="section-title">Wie geht's euch?</h2>
      <div class="mood-pair" data-el="moods"></div>
    </section>

    <section class="card" aria-labelledby="h-mine">
      <h2 id="h-mine" class="card-title">Deine Stimmung</h2>
      <div class="mine">
        <span data-el="face">${face(50, 'me', 72)}</span>
        <div>
          <p class="mine__word" data-el="word">Okay</p>
          <p class="muted" data-el="value">50 von 100</p>
        </div>
      </div>
      <label class="sr-only" for="mood-range">Deine Stimmung von 0 bis 100</label>
      <input type="range" class="range" id="mood-range" min="0" max="100" step="1" value="50" data-el="range">
      <div class="range-scale" aria-hidden="true"><span>Mies</span><span>Super</span></div>
    </section>

    <section class="card" aria-labelledby="h-need">
      <h2 id="h-need" class="card-title">Was brauchst du gerade?</h2>
      <div class="chips" data-el="needs"></div>
      <form class="inline-form" data-el="need-form">
        <label class="sr-only" for="need-input">Eigener Text, höchstens 40 Zeichen</label>
        <input class="input" id="need-input" name="need" maxlength="40" placeholder="Oder eigener Text …" autocomplete="off">
        <button class="btn btn--primary" type="submit">Setzen</button>
      </form>
    </section>

    <section aria-labelledby="h-next">
      <div class="section-head">
        <h2 id="h-next" class="section-title">Als Nächstes</h2>
        <a class="link" href="#/kalender">Zum Kalender ${icon('right', 16)}</a>
      </div>
      <ul class="list card" data-el="next"></ul>
      <a class="tile-link" href="#/listen" data-el="todos"></a>
    </section>`;

  const $ = (name) => root.querySelector(`[data-el="${name}"]`);
  const range = $('range');

  // ---------- Rendern ----------

  function name(uid) {
    return couple?.names?.[uid] || (uid === me ? 'Du' : partnerWord(couple, me));
  }
  const partner = () => couple?.members.find((u) => u !== me);

  function renderHeader() {
    $('avatars').innerHTML = (partner() ? avatar(name(partner()), 'partner') : '') + avatar(name(me), 'me');
  }

  function renderTogether() {
    if (!couple) return;
    const t = together(couple.startDate);
    const el = $('together');
    el.classList.toggle('together--photo', Boolean(photo));
    el.style.backgroundImage = photo ? `url("${photo}")` : '';
    const box = (n, one, many) => `<div class="together__box"><strong>${n}</strong><span>${n === 1 ? one : many}</span></div>`;
    const anniv = t.isAnniversaryToday
      ? `Heute ist euer ${t.years}. Jahrestag!`
      : `Noch ${t.daysToAnniv === 1 ? '1 Tag' : `${t.daysToAnniv} Tage`} bis zum ${t.nextAnnivNumber}. Jahrestag`;
    el.innerHTML = `
      <div class="together__top">
        <p class="together__since">Zusammen seit <strong>${fmtDate(couple.startDate)}</strong></p>
        <button type="button" class="together__cam" data-action="photo" aria-label="Hintergrundfoto ändern">${icon('camera', 22)}</button>
      </div>
      <p class="together__big"><span class="together__num">${fmtNumber(t.totalDays)}</span> <span class="together__unit">Tage</span></p>
      <div class="together__boxes">
        ${box(t.years, 'Jahr', 'Jahre')}${box(t.months, 'Monat', 'Monate')}${box(t.days, 'Tag', 'Tage')}
      </div>
      <p class="together__anniv">${icon('heart', 16)} ${anniv}</p>
      <div class="progress progress--light" role="progressbar" aria-label="Fortschritt bis zum nächsten Jahrestag" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(t.progress * 100)}">
        <span style="width:${(t.progress * 100).toFixed(1)}%"></span>
      </div>`;
  }

  function moodCard(uid, label) {
    const m = moods?.[uid];
    const cls = uid === me ? 'me' : 'partner';
    if (!m) {
      return `<article class="mood-card"><p class="mood-card__name">${esc(label)}</p><p class="muted small">Noch keine Stimmung</p></article>`;
    }
    return `
      <article class="mood-card mood-card--${cls}" aria-label="${esc(label)}: ${moodWord(m.value)}, ${m.value} von 100">
        <div class="mood-card__top">
          ${face(m.value, cls, 44)}
          <div>
            <p class="mood-card__name">${esc(label)}</p>
            <p class="mood-card__word">${moodWord(m.value)}</p>
          </div>
        </div>
        <div class="meter meter--${cls}" aria-hidden="true"><span style="width:${m.value}%"></span></div>
        <p class="mood-card__meta"><span>${m.value}</span><span>${relTime(m.updatedAt)}</span></p>
        ${m.need ? `<p class="need-chip need-chip--${cls}">${esc(m.need)}</p>` : ''}
      </article>`;
  }

  function renderMoods() {
    if (!couple || !moods) return;
    const solo = !partner();
    $('moods').classList.toggle('mood-pair--solo', solo);
    $('moods').innerHTML = solo ? inviteCard() + moodCard(me, 'Du') : moodCard(partner(), name(partner())) + moodCard(me, 'Du');
  }

  // Solange noch niemand mit dem Code beigetreten ist
  function inviteCard() {
    return `
      <article class="card code-card invite-card">
        <h3 class="card-title">Noch allein hier</h3>
        <p class="muted small">Schick diesen Code an die andere Person. Sie legt ein eigenes Konto an und gibt ihn unter „Ich habe einen Code“ ein.</p>
        ${inviteBlock(db.formatCode(couple.inviteCode))}
      </article>`;
  }

  function renderNeeds() {
    const current = moods?.[me]?.need || '';
    const all = current && !NEEDS.includes(current) ? [...NEEDS, current] : NEEDS;
    $('needs').innerHTML = all
      .map((n) => `<button type="button" class="chip" data-action="need" data-need="${esc(n)}" aria-pressed="${n === current}">${esc(n)}</button>`)
      .join('');
  }

  function updateSliderUI(v) {
    $('face').querySelector('.face__mouth').setAttribute('d', mouthPath(v));
    $('word').textContent = moodWord(v);
    $('value').textContent = `${v} von 100`;
    range.style.setProperty('--fill', `${v}%`);
    range.setAttribute('aria-valuetext', `${moodWord(v)}, ${v} von 100`);
  }

  function renderNext() {
    const now = todayISO();
    const upcoming = events.filter((e) => isShared(e) && (e.end || e.start) >= now).slice(0, 3);
    $('next').innerHTML = upcoming.length
      ? upcoming.map(eventRow).join('')
      : `<li class="empty">Noch nichts geplant. Wie wär's mit einem Date?</li>`;
    const open = todos.filter((t) => !t.done).length;
    $('todos').innerHTML = `
      <span class="tile-link__icon">${icon('list', 22)}</span>
      <span class="tile-link__text"><strong>${open}</strong> ${open === 1 ? 'offenes To-do' : 'offene To-dos'}</span>
      ${icon('right', 20)}`;
  }

  // ---------- Daten ----------

  const unsubs = [
    db.watchCouple((c) => {
      couple = c;
      renderHeader();
      renderTogether();
      renderMoods();
    }),
    db.watchMoods((m) => {
      moods = m;
      renderMoods();
      renderNeeds();
      if (!sliderReady && m[me]) {
        range.value = m[me].value;
        updateSliderUI(m[me].value);
        sliderReady = true;
      }
    }),
    db.watchEvents((e) => {
      events = e;
      renderNext();
    }),
    db.watchTodos((t) => {
      todos = t;
      renderNext();
    }),
    db.onPhotoChange((p) => {
      photo = p;
      renderTogether();
    }),
  ];
  // Foto einmalig laden (großes Dokument, kein Dauer-Listener)
  db.getPhoto().then((p) => {
    photo = p;
    renderTogether();
  });

  // ---------- Bedienung ----------

  range.addEventListener('input', () => updateSliderUI(Number(range.value)));
  range.addEventListener('change', () => db.setMood(Number(range.value)));

  $('need-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.elements.need;
    const text = input.value.trim();
    if (!text) return;
    db.setNeed(text);
    input.value = '';
    input.blur();
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'need') {
      const need = btn.dataset.need;
      db.setNeed(moods?.[me]?.need === need ? '' : need);
    }
    if (btn.dataset.action === 'photo') openPhotoSheet();
    if (btn.dataset.action === 'account') openAccountSheet();
  });

  function openAccountSheet() {
    const user = db.getCurrentUser();
    const solo = !partner();
    openSheet({
      title: 'Euer Konto',
      body: `
        <div class="field" style="margin-bottom:12px">
          <span class="label">Ich bin</span>
          ${genderPicker(couple.genders?.[me])}
        </div>
        <dl class="facts" style="margin-bottom:16px">
          <div class="fact"><dt>Du</dt><dd>${esc(name(me))}</dd></div>
          <div class="fact"><dt>Gekoppelt mit</dt><dd>${solo ? '<span class="muted">noch niemand</span>' : esc(name(partner()))}</dd></div>
          <div class="fact"><dt>E-Mail</dt><dd class="small">${esc(user.email)}</dd></div>
        </dl>
        ${solo ? `<div class="code-card" style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">${inviteBlock(db.formatCode(couple.inviteCode))}</div>` : ''}
        <div class="sheet-actions">
          ${solo ? '<button type="button" class="btn btn--ghost btn--block" data-cancel>Paar löschen und selbst einen Code eingeben</button>' : ''}
          <button type="button" class="btn btn--ghost btn--block" data-logout>Abmelden</button>
        </div>`,
      onMount(dlg, close) {
        bindInvite(dlg, () => db.formatCode(couple.inviteCode));
        dlg.querySelector('.gender-seg').addEventListener('click', async (e) => {
          const btn = e.target.closest('[data-gender]');
          if (!btn) return;
          dlg.querySelectorAll('[data-gender]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          try {
            await db.setGender(btn.dataset.gender);
            toast('Gespeichert');
          } catch (err) {
            toast(err.message);
          }
        });
        dlg.querySelector('[data-cancel]')?.addEventListener('click', async () => {
          close();
          try {
            await db.cancelCouple();
          } catch (err) {
            console.error(err);
            toast('Löschen hat nicht geklappt.');
          }
        });
        dlg.querySelector('[data-logout]').addEventListener('click', () => {
          close();
          db.signOut();
        });
      },
    });
  }

  bindInvite($('moods'), () => db.formatCode(couple.inviteCode));

  $('file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await shrinkImage(file);
      await db.setPhoto(dataUrl);
      toast('Foto gespeichert');
    } catch (err) {
      console.error(err);
      toast('Das Foto konnte nicht geladen werden.');
    }
  });

  function openPhotoSheet() {
    openSheet({
      title: 'Hintergrundfoto',
      body: `
        <div class="sheet-actions">
          <button type="button" class="btn btn--primary btn--block" data-choose>${icon('image', 20)} Foto wählen</button>
          ${photo ? `<button type="button" class="btn btn--ghost btn--block" data-remove>${icon('trash', 20)} Foto entfernen</button>` : ''}
        </div>`,
      onMount(dlg, close) {
        dlg.querySelector('[data-choose]').addEventListener('click', () => {
          close();
          $('file').click();
        });
        dlg.querySelector('[data-remove]')?.addEventListener('click', async () => {
          await db.removePhoto();
          close();
          toast('Foto entfernt');
        });
      },
    });
  }

  return () => unsubs.forEach((u) => u());
}

/**
 * Verkleinert ein Foto im Browser (max. 1080 px Kantenlänge, JPEG ~0,7)
 * und bleibt unter ca. 600 KB, damit es später in ein Firestore-Dokument passt.
 */
async function shrinkImage(file) {
  const MAX_BYTES = 600 * 1024;
  const img = await loadImage(file);
  let maxEdge = 1080;
  let quality = 0.7;
  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_BYTES) return dataUrl;
    if (quality > 0.5) quality -= 0.1;
    else maxEdge = Math.round(maxEdge * 0.8);
  }
  throw new Error('Foto zu groß');
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}
