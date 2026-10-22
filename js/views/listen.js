// Bildschirm „To-dos" (Unsere Listen): To-dos und Date-Ideen.

import * as db from '../data.js';
import { esc, fmtShort, relTime, todayISO, toISO } from '../util.js';
import { icon, avatar, toast } from '../ui.js';
import { partnerWord } from '../theme.js';
import { openEventForm } from './common.js';

const CATEGORIES = ['Essen', 'Ausflug', 'Aktivität'];

export function renderListen(root, { sub }) {
  const me = db.getCurrentUser().uid;
  let tab = sub === 'ideen' ? 'ideen' : 'todos';
  let todoFilter = 'open';
  let ideaFilter = 'Alle';
  let couple = null;
  let todos = [];
  let ideas = [];
  let events = [];

  root.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Unsere Listen</h1>
    </header>
    <div class="big-seg" role="group" aria-label="Liste wählen">
      <button type="button" data-tab="todos">${icon('list', 20)} To-dos</button>
      <button type="button" data-tab="ideen">${icon('heart', 20)} Date-Ideen</button>
    </div>
    <div class="panel" data-el="panel"></div>`;

  const $ = (name) => root.querySelector(`[data-el="${name}"]`);
  const nameOf = (uid) => (uid === me ? 'Du' : couple?.names?.[uid] || partnerWord(couple, me));
  const clsOf = (uid) => (uid === me ? 'me' : 'partner');

  // ---------- Panels ----------

  function renderPanel() {
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    if (tab === 'todos') {
      $('panel').innerHTML = `
        <form class="add-form" data-el="todo-form">
          <label class="sr-only" for="todo-input">Neue Aufgabe</label>
          <input class="input" id="todo-input" name="title" placeholder="Neue Aufgabe …" maxlength="120" autocomplete="off">
          <button class="icon-btn icon-btn--primary" type="submit" aria-label="Aufgabe hinzufügen">${icon('plus')}</button>
        </form>
        <div class="seg" role="group" aria-label="Filter" data-el="todo-seg"></div>
        <ul class="list card" data-el="todo-list"></ul>`;
      renderTodos();
    } else {
      $('panel').innerHTML = `
        <form class="add-form add-form--idea" data-el="idea-form">
          <label class="sr-only" for="idea-input">Neue Date-Idee</label>
          <input class="input" id="idea-input" name="title" placeholder="Neue Idee …" maxlength="80" autocomplete="off">
          <label class="sr-only" for="idea-cat">Kategorie</label>
          <select class="input select" id="idea-cat" name="category">
            ${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}
          </select>
          <button class="icon-btn icon-btn--primary" type="submit" aria-label="Idee hinzufügen">${icon('plus')}</button>
        </form>
        <div class="chips" role="group" aria-label="Nach Kategorie filtern" data-el="idea-filter"></div>
        <div class="ideas" data-el="ideas"></div>`;
      renderIdeas();
    }
  }

  // ---------- To-dos ----------

  function renderTodos() {
    if (tab !== 'todos' || !couple) return;
    const open = todos.filter((t) => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt.localeCompare(b.createdAt));
    const done = todos.filter((t) => t.done).sort((a, b) => b.doneAt.localeCompare(a.doneAt));

    $('todo-seg').innerHTML = `
      <button type="button" data-filter="open" aria-pressed="${todoFilter === 'open'}">Offen <span class="count">${open.length}</span></button>
      <button type="button" data-filter="done" aria-pressed="${todoFilter === 'done'}">Erledigt <span class="count">${done.length}</span></button>`;

    const list = todoFilter === 'open' ? open : done;
    const now = todayISO();
    $('todo-list').innerHTML = list.length
      ? list.map((t) => {
        let meta = '';
        if (t.done) meta = `Erledigt von ${esc(nameOf(t.doneBy))} · ${relTime(t.doneAt)}`;
        else if (t.due) meta = `<span class="${t.due < now ? 'overdue' : ''}">bis ${fmtShort(t.due)}</span>`;
        return `
          <li class="todo ${t.done ? 'is-done' : ''}">
            <button type="button" class="check" data-toggle="${t.id}" aria-pressed="${t.done}" aria-label="${esc(t.title)}: ${t.done ? 'wieder öffnen' : 'als erledigt markieren'}">${icon('check', 18)}</button>
            <div class="todo__text">
              <span class="todo__title">${esc(t.title)}</span>
              ${meta ? `<small>${meta}</small>` : ''}
            </div>
            ${avatar(nameOf(t.createdBy), clsOf(t.createdBy), 'sm')}
            <span class="sr-only">Angelegt von ${esc(nameOf(t.createdBy))}</span>
            ${t.done ? `<button type="button" class="icon-btn icon-btn--ghost" data-delete-todo="${t.id}" aria-label="${esc(t.title)} löschen">${icon('trash', 20)}</button>` : ''}
          </li>`;
      }).join('')
      : `<li class="empty">${todoFilter === 'open' ? 'Alles erledigt. Stark!' : 'Noch nichts erledigt.'}</li>`;
  }

  // ---------- Date-Ideen ----------

  function ideaState(idea) {
    const ev = idea.eventId && events.find((e) => e.id === idea.eventId);
    const done = Boolean(idea.doneAt) || Boolean(ev && (ev.end || ev.start) < todayISO());
    return { ev, done, both: couple.members.length === 2 && couple.members.every((u) => idea.likes.includes(u)) };
  }

  function renderIdeas() {
    if (tab !== 'ideen' || !couple) return;
    $('idea-filter').innerHTML = ['Alle', ...CATEGORIES]
      .map((c) => `<button type="button" class="chip" data-cat="${c}" aria-pressed="${c === ideaFilter}">${c}</button>`)
      .join('');

    const visible = ideas.filter((i) => ideaFilter === 'Alle' || i.category === ideaFilter).map((i) => ({ ...i, ...ideaState(i) }));
    const open = visible.filter((i) => !i.done).sort((a, b) => Number(b.both) - Number(a.both) || b.likes.length - a.likes.length || b.createdAt.localeCompare(a.createdAt));
    const done = visible.filter((i) => i.done);

    const card = (i) => {
      const iLike = i.likes.includes(me);
      const likers = i.likes.length === 2 ? 'Ihr beide' : i.likes.length === 1 ? nameOf(i.likes[0]) : 'Noch keine Likes';
      return `
        <article class="idea card ${i.both ? 'idea--both' : ''}">
          <div class="idea__top">
            <span class="cat cat--${i.category === 'Aktivität' ? 'akt' : i.category.toLowerCase()}">${esc(i.category)}</span>
            ${i.both ? `<span class="both-label">${icon('heart', 14)} Wollt ihr beide</span>` : ''}
          </div>
          <h3 class="idea__title">${esc(i.title)}</h3>
          <p class="muted small">${i.createdBy === me ? 'Dein Vorschlag' : `Vorschlag von ${esc(nameOf(i.createdBy))}`}</p>
          <div class="idea__actions">
            <button type="button" class="like" data-like="${i.id}" aria-pressed="${iLike}" aria-label="${iLike ? 'Gefällt mir nicht mehr' : 'Gefällt mir'}">
              ${icon('heart', 20)}<span>${likers}</span>
            </button>
            ${i.ev
              ? `<span class="planned">${icon('calendar', 16)} Eingeplant: ${fmtShort(i.ev.start)}</span>`
              : `<button type="button" class="btn btn--soft" data-plan="${i.id}">${icon('calendar', 18)} Einplanen</button>`}
          </div>
        </article>`;
    };

    $('ideas').innerHTML = `
      ${open.length ? open.map(card).join('') : `<p class="empty card">${ideaFilter === 'Alle' ? 'Noch keine Date-Ideen. Schreib oben eure erste Idee rein.' : 'Keine offenen Ideen in dieser Kategorie.'}</p>`}
      ${done.length ? `
        <h2 class="section-title">Schon gemacht</h2>
        <ul class="list card">
          ${done.map((i) => `
            <li class="done-idea">
              <span class="check check--static" aria-hidden="true">${icon('check', 16)}</span>
              <span><strong>${esc(i.title)}</strong><small>${esc(i.category)}${i.ev ? ` · ${fmtShort(i.ev.start)}` : i.doneAt ? ` · ${fmtShort(toISO(new Date(i.doneAt)))}` : ''}</small></span>
            </li>`).join('')}
        </ul>` : ''}`;
  }

  // ---------- Daten ----------

  const unsubs = [
    db.watchCouple((c) => {
      couple = c;
      renderTodos();
      renderIdeas();
    }),
    db.watchTodos((t) => {
      todos = t;
      renderTodos();
    }),
    db.watchIdeas((i) => {
      ideas = i;
      renderIdeas();
    }),
    db.watchEvents((e) => {
      events = e;
      renderIdeas();
    }),
  ];

  // ---------- Bedienung ----------

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { tab: newTab, filter, toggle, cat, like, plan, deleteTodo } = btn.dataset;
    if (newTab && newTab !== tab) {
      tab = newTab;
      history.replaceState(null, '', tab === 'ideen' ? '#/listen/ideen' : '#/listen');
      renderPanel();
    } else if (filter) {
      todoFilter = filter;
      renderTodos();
    } else if (deleteTodo) {
      db.deleteTodo(deleteTodo);
      toast('Gelöscht');
    } else if (toggle) {
      const todo = todos.find((t) => t.id === toggle);
      db.setTodoDone(toggle, !todo.done);
      if (!todo.done) toast('Erledigt');
    } else if (cat) {
      ideaFilter = cat;
      renderIdeas();
    } else if (like) {
      db.toggleIdeaLike(like);
    } else if (plan) {
      const idea = ideas.find((i) => i.id === plan);
      openEventForm({
        heading: 'Date einplanen',
        preset: { type: 'date', title: idea.title },
        onSave: async (data) => {
          await db.planIdea(plan, data);
          toast('Im Kalender eingetragen');
        },
      });
    }
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.elements.title.value.trim();
    if (!title) return form.elements.title.focus();
    if (form.dataset.el === 'todo-form') {
      db.addTodo(title);
      todoFilter = 'open';
    } else {
      db.addIdea(title, form.elements.category.value);
    }
    form.elements.title.value = '';
  });

  renderPanel();
  return () => unsubs.forEach((u) => u());
}
