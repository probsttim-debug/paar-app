// Datenschicht: ALLE Lese- und Schreibzugriffe der App laufen über diese Datei.
//
// Stand Schritt 2:
//   - Anmeldung (Firebase Auth) und das Paar (users/{uid}, couples/{coupleId}, invites/{code}) laufen über Firebase.
//   - Kalender, Listen, Stimmung und Foto liegen noch im localStorage
//     und werden in den nächsten Schritten gegen Firestore getauscht.
// Die Schnittstelle ist Firestore-ähnlich:
//   - watch…(callback) liefert sofort und bei jeder Änderung den aktuellen Stand
//     und gibt eine Funktion zum Abmelden zurück (wie onSnapshot).
//   - Schreibfunktionen sind async.
// Die Views importieren nur von hier und kennen weder Firebase noch localStorage.

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  collection, doc, onSnapshot, getDoc, writeBatch, updateDoc,
  serverTimestamp, arrayUnion, deleteField,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { auth, firestore } from './firebase.js';
import { todayISO } from './util.js';

const KEY = 'paar-app:v1';
const PHOTO_KEY = 'paar-app:v1:photo';

const listeners = new Map();

function emit(name, value) {
  const set = listeners.get(name);
  if (set) for (const cb of [...set]) cb(value);
}

function subscribe(name, cb, current) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  const set = listeners.get(name);
  set.add(cb);
  queueMicrotask(() => set.has(cb) && current() !== undefined && cb(current()));
  return () => set.delete(cb);
}

// ======================================================================
// Anmeldung und Paar (Firebase)
// ======================================================================

/**
 * Sitzungszustand:
 *   loading   – wird geprüft
 *   signedOut – nicht angemeldet
 *   noCouple  – angemeldet, aber noch kein Paar
 *   waiting   – Paar angelegt, die andere Person hat den Code noch nicht eingegeben
 *   ready     – Paar komplett, App kann starten
 *   error     – Paar konnte nicht geladen werden
 */
let session = { status: 'loading', user: null, coupleId: null, couple: null, error: null };
let userUnsub = null;
let coupleUnsub = null;

function setSession(next) {
  session = { ...session, ...next };
  emit('session', { ...session });
  emit('couple', coupleSnapshot());
}

function coupleSnapshot() {
  if (!session.couple) return undefined;
  const c = session.couple;
  return {
    id: session.coupleId,
    members: [...c.members],
    names: { ...c.names },
    genders: { ...(c.genders || {}) },
    startDate: c.startDate,
    inviteCode: c.inviteCode,
  };
}

function onListenError(error) {
  if (!auth.currentUser) return; // Abmeldung beendet die Listener
  console.error(error);
  setSession({ status: 'error', error });
}

function stopCouple() {
  coupleUnsub?.();
  coupleUnsub = null;
}

// Zwei kleine Listener: users/{uid} sagt, zu welchem Paar ich gehöre,
// couples/{coupleId} liefert das Paar selbst.
onAuthStateChanged(auth, (user) => {
  userUnsub?.();
  userUnsub = null;
  stopCouple();
  if (!user) {
    setSession({ status: 'signedOut', user: null, coupleId: null, couple: null, error: null });
    return;
  }
  setSession({ status: 'loading', user, coupleId: null, couple: null, error: null });

  userUnsub = onSnapshot(
    doc(firestore, 'users', user.uid),
    (snap) => {
      const coupleId = snap.exists() ? snap.data().coupleId : null;
      if (!coupleId) {
        // Leerer Offline-Cache heißt nicht „kein Paar" – auf den Server warten
        if (snap.metadata.fromCache) return;
        stopCouple();
        setSession({ status: 'noCouple', coupleId: null, couple: null, error: null });
        return;
      }
      if (coupleId === session.coupleId && coupleUnsub) return;
      stopCouple();
      watchCoupleDoc(user, coupleId);
    },
    onListenError,
  );
});

function watchCoupleDoc(user, coupleId) {
  coupleUnsub = onSnapshot(
    doc(firestore, 'couples', coupleId),
    (snap) => {
      if (!snap.exists()) {
        if (snap.metadata.fromCache) return;
        setSession({ status: 'noCouple', coupleId: null, couple: null, error: null });
        return;
      }
      const couple = snap.data();
      const ready = couple.members.length >= 2;
      ensureLocalData(user.uid, couple.members.find((u) => u !== user.uid) || PENDING_PARTNER);
      setSession({ status: ready ? 'ready' : 'waiting', coupleId, couple, error: null });
    },
    onListenError,
  );
}

/** Benachrichtigt bei jeder Änderung von Anmeldung oder Paar. */
export function onSessionChange(cb) {
  return subscribe('session', cb, () => ({ ...session }));
}

/** Der angemeldete Nutzer. */
export function getCurrentUser() {
  const u = session.user;
  return u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null;
}

export function watchCouple(cb) {
  return subscribe('couple', cb, coupleSnapshot);
}

export async function register(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  } catch (err) {
    throw new Error(authMessage(err));
  }
}

export async function signIn(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (err) {
    throw new Error(authMessage(err));
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw new Error(authMessage(err));
  }
}

export async function signOut() {
  await fbSignOut(auth);
}

function authMessage(err) {
  const messages = {
    'auth/invalid-email': 'Diese E-Mail-Adresse sieht nicht richtig aus.',
    'auth/missing-email': 'Bitte gib deine E-Mail-Adresse ein.',
    'auth/missing-password': 'Bitte gib dein Passwort ein.',
    'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
    'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
    'auth/user-not-found': 'E-Mail oder Passwort stimmt nicht.',
    'auth/email-already-in-use': 'Mit dieser E-Mail gibt es schon ein Konto. Melde dich an.',
    'auth/weak-password': 'Das Passwort braucht mindestens 6 Zeichen.',
    'auth/too-many-requests': 'Zu viele Versuche. Warte kurz und probier es dann noch mal.',
    'auth/network-request-failed': 'Keine Verbindung. Bist du online?',
    'auth/operation-not-allowed': 'Die Anmeldung per E-Mail ist in Firebase noch nicht eingeschaltet.',
  };
  console.warn(err);
  return messages[err?.code] || 'Das hat nicht geklappt. Bitte versuch es noch mal.';
}

// ---------- Koppeln ----------

// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

/** „abcd-efgh" → „ABCDEFGH" */
export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** „ABCDEFGH" → „ABCD-EFGH" */
export function formatCode(code) {
  return code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';
}

function checkGender(gender) {
  if (gender !== 'm' && gender !== 'w') throw new Error('Bitte wähle, ob du Mann oder Frau bist.');
  return gender;
}

/** Eigenes Geschlecht ändern: 'm' (Mann, Blau) oder 'w' (Frau, Pink). */
export async function setGender(gender) {
  const uid = auth.currentUser.uid;
  checkGender(gender);
  try {
    await updateDoc(doc(firestore, 'couples', session.coupleId), { [`genders.${uid}`]: gender });
  } catch (err) {
    console.error(err);
    throw new Error(`Speichern hat nicht geklappt. (Fehlercode: ${err.code || 'unbekannt'})`);
  }
}

async function saveName(name) {
  const clean = String(name || '').trim().slice(0, 30);
  if (!clean) throw new Error('Bitte gib deinen Namen ein.');
  if (auth.currentUser.displayName !== clean) await updateProfile(auth.currentUser, { displayName: clean });
  return clean;
}

/** Person A: legt das Paar an und bekommt einen Einladungscode. */
export async function createCouple({ name, gender, startDate }) {
  const uid = auth.currentUser.uid;
  checkGender(gender);
  const myName = await saveName(name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '')) throw new Error('Bitte wähle das Datum, seit dem ihr zusammen seid.');
  if (startDate > todayISO()) throw new Error('Das Datum darf nicht in der Zukunft liegen.');

  const code = newInviteCode();
  const coupleRef = doc(collection(firestore, 'couples'));
  const batch = writeBatch(firestore);
  batch.set(coupleRef, {
    members: [uid],
    names: { [uid]: myName },
    genders: { [uid]: gender },
    startDate,
    createdAt: serverTimestamp(),
    inviteCode: code,
  });
  batch.set(doc(firestore, 'invites', code), { coupleId: coupleRef.id, createdBy: uid, createdAt: serverTimestamp() });
  batch.set(doc(firestore, 'users', uid), { coupleId: coupleRef.id });
  try {
    await batch.commit();
  } catch (err) {
    console.error(err);
    throw new Error(`Das Paar konnte nicht angelegt werden. Bist du online? (Fehlercode: ${err.code || 'unbekannt'})`);
  }
}

/** Person B: tritt mit dem Code bei. Danach ist das Paar voll. */
export async function joinCouple({ name, gender, code: rawCode }) {
  const uid = auth.currentUser.uid;
  checkGender(gender);
  const code = normalizeCode(rawCode);
  if (code.length !== 8) throw new Error('Der Code hat 8 Zeichen, zum Beispiel ABCD-EFGH.');
  const myName = await saveName(name);

  let invite;
  try {
    invite = await getDoc(doc(firestore, 'invites', code));
  } catch (err) {
    console.error(err);
    throw new Error(`Der Code konnte nicht geprüft werden. Bist du online? (Fehlercode: ${err.code || 'unbekannt'})`);
  }
  if (!invite.exists()) throw new Error('Diesen Code gibt es nicht (mehr). Prüf ihn bitte noch mal.');
  const { coupleId, createdBy } = invite.data();
  if (createdBy === uid) throw new Error('Das ist dein eigener Code. Den gibst du der anderen Person.');

  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'couples', coupleId), {
    members: arrayUnion(uid),
    [`names.${uid}`]: myName,
    [`genders.${uid}`]: gender,
    joinedWith: code,
    inviteCode: deleteField(),
  });
  batch.delete(doc(firestore, 'invites', code));
  batch.set(doc(firestore, 'users', uid), { coupleId });
  try {
    await batch.commit();
  } catch (err) {
    console.error(err);
    throw new Error(`Beitreten hat nicht geklappt. Vielleicht ist das Paar schon voll? (Fehlercode: ${err.code || 'unbekannt'})`);
  }
}

/** Person A: noch nicht gekoppeltes Paar wieder löschen (z. B. um selbst einem Code beizutreten). */
export async function cancelCouple() {
  const { coupleId, couple } = session;
  if (!coupleId || couple.members.length !== 1) return;
  const batch = writeBatch(firestore);
  if (couple.inviteCode) batch.delete(doc(firestore, 'invites', couple.inviteCode));
  batch.delete(doc(firestore, 'couples', coupleId));
  batch.delete(doc(firestore, 'users', session.user.uid));
  await batch.commit();
}

// ======================================================================
// Lokale Daten (Kalender, Listen, Stimmung) – bis Schritt 3–6 noch im localStorage
// ======================================================================

let state = null;

// Platzhalter-UID, solange die andere Person noch nicht beigetreten ist
const PENDING_PARTNER = 'partner-pending';

function emptyData(me, partner) {
  return { owners: [me, partner], noSamples: true, events: [], todos: [], ideas: [], moods: {}, moodLog: {} };
}

/**
 * Entfernt die Beispieldaten aus Schritt 1 (feste IDs wie e1, t3, i7) und behält alles,
 * was selbst eingetragen wurde (IDs mit Zeitstempel). Stimmung startet neu.
 */
function removeSamples(s) {
  const own = (item) => !/^[eti]\d+$/.test(item.id);
  s.events = s.events.filter(own);
  s.todos = s.todos.filter(own);
  s.ideas = s.ideas.filter(own);
  for (const ev of s.events) if (ev.ideaId && !s.ideas.some((i) => i.id === ev.ideaId)) delete ev.ideaId;
  for (const idea of s.ideas) if (idea.eventId && !s.events.some((e) => e.id === idea.eventId)) delete idea.eventId;
  s.moods = {};
  s.moodLog = {};
  s.noSamples = true;
  return s;
}

/** Lädt die lokalen Daten; passen sie nicht zum aktuellen Paar, leer neu anlegen. */
function ensureLocalData(me, partner) {
  if (state && state.owners?.[0] === me && state.owners?.[1] === partner) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    state = null;
  }
  if (state && !state.noSamples) {
    state = removeSamples(state);
    persist();
  }
  if (state?.owners?.[0] === me && state.owners[1] === PENDING_PARTNER && partner !== PENDING_PARTNER) {
    // Die andere Person ist beigetreten: bisherige Einträge behalten, Platzhalter ersetzen
    state = JSON.parse(JSON.stringify(state).replaceAll(PENDING_PARTNER, partner));
    persist();
    ['events', 'todos', 'ideas', 'moods'].forEach((name) => emit(name, snapshot(name)));
    return;
  }
  if (!state || state.owners?.[0] !== me || state.owners?.[1] !== partner) {
    state = emptyData(me, partner);
    persist();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Speichern im localStorage fehlgeschlagen', err);
  }
}

function snapshot(name) {
  if (!state) return undefined;
  const value = clone(state[name]);
  if (name === 'events') value.sort((a, b) => (a.start + (a.time || '')).localeCompare(b.start + (b.time || '')));
  return value;
}

function watch(name, cb) {
  return subscribe(name, cb, () => snapshot(name));
}

function commit(...names) {
  persist();
  for (const name of names) emit(name, snapshot(name));
}

function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const nowISO = () => new Date().toISOString();
const myUid = () => session.user.uid;

// ---------- Stimmung ----------

export function watchMoods(cb) {
  return watch('moods', cb);
}

/** Setzt die eigene Stimmung (0–100) und schreibt den Tageswert ins Stimmungslog. */
export async function setMood(value) {
  const uid = myUid();
  const v = Math.max(0, Math.min(100, Math.round(value)));
  state.moods[uid] = { ...state.moods[uid], value: v, updatedAt: nowISO() };
  const date = todayISO();
  state.moodLog[`${date}_${uid}`] = { date, uid, value: v };
  commit('moods');
}

/** Setzt das eigene Bedürfnis (max. 40 Zeichen); leerer Text entfernt es. */
export async function setNeed(text) {
  const uid = myUid();
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
  const uid = myUid();
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
  if (ev.type === 'busy') {
    ev.owner = uid;
    // Feste Termine: jede Woche an bestimmten Wochentagen (0 = Mo … 6 = So)
    if (data.repeat?.weekdays?.length) {
      ev.repeat = { weekdays: [...new Set(data.repeat.weekdays)].sort((a, b) => a - b) };
      if (data.repeat.until) ev.repeat.until = data.repeat.until;
      ev.skip = [];
      delete ev.end;
    }
  }
  state.events.push(ev);
  commit('events');
  return ev.id;
}

/** Eintrag löschen (bei festen Terminen die ganze Serie). Verknüpfte Date-Idee wird gelöst. */
export async function deleteEvent(id) {
  state.events = state.events.filter((e) => e.id !== id);
  let ideasChanged = false;
  for (const idea of state.ideas) {
    if (idea.eventId === id) {
      delete idea.eventId;
      ideasChanged = true;
    }
  }
  commit('events', ...(ideasChanged ? ['ideas'] : []));
}

/** Einen einzelnen Tag eines festen Termins auslassen (z. B. Training fällt aus). */
export async function skipOccurrence(id, iso) {
  const ev = state.events.find((e) => e.id === id);
  if (!ev?.repeat) return;
  ev.skip = [...new Set([...(ev.skip || []), iso])];
  commit('events');
}

// ---------- To-dos ----------

export function watchTodos(cb) {
  return watch('todos', cb);
}

export async function addTodo(title, due) {
  const todo = {
    id: newId('t'),
    title: String(title).trim().slice(0, 120),
    createdBy: myUid(),
    createdAt: nowISO(),
    done: false,
  };
  if (due) todo.due = due;
  state.todos.push(todo);
  commit('todos');
  return todo.id;
}

/** To-do endgültig löschen (z. B. erledigte aufräumen). */
export async function deleteTodo(id) {
  state.todos = state.todos.filter((t) => t.id !== id);
  commit('todos');
}

export async function setTodoDone(id, done) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = done;
  if (done) {
    todo.doneBy = myUid();
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
    createdBy: myUid(),
    createdAt: nowISO(),
    likes: [],
  };
  state.ideas.push(idea);
  commit('ideas');
  return idea.id;
}

export async function toggleIdeaLike(id) {
  const uid = myUid();
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
