// Datenschicht: ALLE Lese- und Schreibzugriffe der App laufen über diese Datei.
//
// Schritt 1: Speicherung im localStorage mit Beispieldaten.
// Später wird diese Datei gegen eine Firestore-Version mit identischer Schnittstelle
// ausgetauscht. Deshalb ist die Schnittstelle bewusst Firestore-ähnlich:
//   - watch…(callback) liefert sofort und bei jeder Änderung den aktuellen Stand
//     und gibt eine Funktion zum Abmelden zurück (wie onSnapshot).
//   - Schreibfunktionen sind async (wie addDoc/updateDoc).
//   - Das Foto liegt getrennt und wird nur bei Bedarf geladen (wie meta/photo).
// Die Views importieren nur von hier und kennen localStorage nicht.

import { createSampleData, ME } from './sample-data.js';
import { todayISO } from './util.js';

const KEY = 'paar-app:v1';
const PHOTO_KEY = 'paar-app:v1:photo';

let state = load();
const listeners = new Map();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Kaputter oder fehlender Speicher: neu mit Beispieldaten anfangen
  }
  const fresh = createSampleData();
  persist(fresh);
  return fresh;
}

function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    console.warn('Speichern im localStorage fehlgeschlagen', err);
  }
}

function snapshot(name) {
  switch (name) {
    case 'events':
      return clone(state.events).sort((a, b) => (a.start + (a.time || '')).localeCompare(b.start + (b.time || '')));
    case 'todos':
      return clone(state.todos);
    case 'ideas':
      return clone(state.ideas);
    default:
      return clone(state[name]);
  }
}

function watch(name, cb) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  const set = listeners.get(name);
  set.add(cb);
  queueMicrotask(() => set.has(cb) && cb(snapshot(name)));
  return () => set.delete(cb);
}

function commit(...names) {
  persist(state);
  for (const name of names) {
    const set = listeners.get(name);
    if (set) for (const cb of [...set]) cb(snapshot(name));
  }
}

function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const nowISO = () => new Date().toISOString();

// ---------- Nutzer und Paar ----------

/** Der angemeldete Nutzer. Später aus Firebase Auth. */
export function getCurrentUser() {
  return { uid: ME };
}

export function watchCouple(cb) {
  return watch('couple', cb);
}

// ---------- Stimmung ----------

export function watchMoods(cb) {
  return watch('moods', cb);
}

/** Setzt die eigene Stimmung (0–100) und schreibt den Tageswert ins Stimmungslog. */
export async function setMood(value) {
  const uid = getCurrentUser().uid;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  state.moods[uid] = { ...state.moods[uid], value: v, updatedAt: nowISO() };
  const date = todayISO();
  state.moodLog[`${date}_${uid}`] = { date, uid, value: v };
  commit('moods');
}

/** Setzt das eigene Bedürfnis (max. 40 Zeichen); leerer Text entfernt es. */
export async function setNeed(text) {
  const uid = getCurrentUser().uid;
  const need = String(text || '').trim().slice(0, 40);
  state.moods[uid] = { ...state.moods[uid], need, updatedAt: nowISO() };
  commit('moods');
}

/** Einmalige Abfrage des Stimmungslogs im Zeitraum [fromISO, toISO]. */
export async function getMoodLog(fromISO, toISO) {
  return Object.values(state.moodLog)
    .filter((e) => e.date >= fromISO && e.date <= toISO)
    .map(clone);
}

// ---------- Kalender ----------

export function watchEvents(cb) {
  return watch('events', cb);
}

export async function addEvent(data) {
  const uid = getCurrentUser().uid;
  const ev = {
    id: newId('e'),
    type: data.type,
    title: String(data.title || '').trim(),
    start: data.start,
    end: data.end && data.end > data.start ? data.end : undefined,
    time: data.time || undefined,
    place: String(data.place || '').trim() || undefined,
    note: String(data.note || '').trim() || undefined,
    ideaId: data.ideaId || undefined,
    createdBy: uid,
    createdAt: nowISO(),
  };
  if (ev.type === 'busy') ev.owner = uid;
  state.events.push(ev);
  commit('events');
  return ev.id;
}

// ---------- To-dos ----------

export function watchTodos(cb) {
  return watch('todos', cb);
}

export async function addTodo(title, due) {
  const todo = {
    id: newId('t'),
    title: String(title).trim().slice(0, 120),
    createdBy: getCurrentUser().uid,
    createdAt: nowISO(),
    done: false,
  };
  if (due) todo.due = due;
  state.todos.push(todo);
  commit('todos');
  return todo.id;
}

export async function setTodoDone(id, done) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = done;
  if (done) {
    todo.doneBy = getCurrentUser().uid;
    todo.doneAt = nowISO();
  } else {
    delete todo.doneBy;
    delete todo.doneAt;
  }
  commit('todos');
}

// ---------- Date-Ideen ----------

export function watchIdeas(cb) {
  return watch('ideas', cb);
}

export async function addIdea(title, category) {
  const idea = {
    id: newId('i'),
    title: String(title).trim().slice(0, 80),
    category,
    createdBy: getCurrentUser().uid,
    createdAt: nowISO(),
    likes: [],
  };
  state.ideas.push(idea);
  commit('ideas');
  return idea.id;
}

export async function toggleIdeaLike(id) {
  const uid = getCurrentUser().uid;
  const idea = state.ideas.find((i) => i.id === id);
  if (!idea) return;
  idea.likes = idea.likes.includes(uid) ? idea.likes.filter((u) => u !== uid) : [...idea.likes, uid];
  commit('ideas');
}

/** Legt einen Kalendereintrag für die Idee an und verknüpft beide. */
export async function planIdea(ideaId, eventData) {
  const eventId = await addEvent({ ...eventData, ideaId });
  const idea = state.ideas.find((i) => i.id === ideaId);
  if (idea) idea.eventId = eventId;
  commit('ideas');
  return eventId;
}

// ---------- Hintergrundfoto (eigenes Dokument, wird nur bei Bedarf geladen) ----------

const photoListeners = new Set();

export async function getPhoto() {
  try {
    return localStorage.getItem(PHOTO_KEY);
  } catch {
    return null;
  }
}

/** Speichert ein bereits verkleinertes Foto als Data-URL. */
export async function setPhoto(dataUrl) {
  localStorage.setItem(PHOTO_KEY, dataUrl);
  photoListeners.forEach((cb) => cb(dataUrl));
}

export async function removePhoto() {
  localStorage.removeItem(PHOTO_KEY);
  photoListeners.forEach((cb) => cb(null));
}

/** Benachrichtigt nur bei Änderungen (kein erneutes Laden beim Öffnen). */
export function onPhotoChange(cb) {
  photoListeners.add(cb);
  return () => photoListeners.delete(cb);
}

// ---------- Entwicklung ----------

/** Setzt alle Daten auf die Beispieldaten zurück (nur für Schritt 1). */
export function resetSampleData() {
  state = createSampleData();
  persist(state);
  localStorage.removeItem(PHOTO_KEY);
  location.reload();
}
