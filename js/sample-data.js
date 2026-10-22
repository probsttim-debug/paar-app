// Beispieldaten für Kalender, Listen und Stimmung (noch lokal, bis Firestore angebunden ist).
// Das Paar selbst (Namen, Startdatum) kommt seit Schritt 2 aus Firestore.
// Alle Daten liegen relativ zum heutigen Tag, damit die App immer „lebendig" aussieht.
// Aufbau entspricht dem Datenmodell aus der CLAUDE.md.

import { today, addDays, toISO, startOfWeek } from './util.js';

// ME und PARTNER sind die echten UIDs des Paars, damit „Du“ und Partnerin stimmen.
export function createSampleData(ME, PARTNER) {
  const t = today();
  const ws = startOfWeek(t);
  const d = (n) => toISO(addDays(t, n));
  const w = (n) => toISO(addDays(ws, n));
  const ago = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600000).toISOString();

  const events = [
    // Diese Woche
    { id: 'e1', type: 'busy', owner: ME, title: 'Spätschicht', start: w(0), time: '14:00' },
    { id: 'e2', type: 'busy', owner: PARTNER, title: 'Yoga', start: w(1), time: '18:30' },
    { id: 'e3', type: 'busy', owner: ME, title: 'Fußballtraining', start: w(2), time: '19:00' },
    { id: 'e4', type: 'busy', owner: PARTNER, title: 'Spieleabend', start: w(2), time: '19:30' },
    { id: 'e5', type: 'busy', owner: PARTNER, title: 'Arbeit bis spät', start: w(3) },
    { id: 'e6', type: 'date', title: 'Kino', start: w(4), time: '20:00', place: 'Kino am Markt', note: 'Tickets sind schon gekauft' },
    // Demnächst
    { id: 'e7', type: 'date', title: 'Italienisch kochen', start: d(9), time: '19:00', place: 'Zuhause', ideaId: 'i1' },
    { id: 'e8', type: 'busy', owner: ME, title: 'Zahnarzt', start: d(8), time: '08:30' },
    { id: 'e9', type: 'busy', owner: PARTNER, title: 'Teamessen', start: d(11), time: '19:00' },
    { id: 'e10', type: 'busy', owner: ME, title: 'Dienstreise', start: d(12), end: d(13) },
    { id: 'e11', type: 'other', title: 'Geburtstag von Oma', start: d(15), time: '15:00', place: 'Leipzig' },
    { id: 'e12', type: 'trip', title: 'Herbsturlaub an der Ostsee', start: d(41), end: d(45), place: 'Warnemünde' },
    // Vergangenheit
    { id: 'e13', type: 'date', title: 'Pizza essen', start: d(-6), time: '19:30', place: 'Da Mario' },
    { id: 'e14', type: 'date', title: 'Kletterhalle ausprobieren', start: d(-20), time: '17:00', place: 'Boulderwelt', ideaId: 'i8' },
    { id: 'e15', type: 'date', title: 'Konzert', start: d(-35), time: '20:00', place: 'Stadtpark' },
    { id: 'e16', type: 'date', title: 'Jahrestagsessen', start: d(-60), time: '19:00', place: 'Da Mario' },
    { id: 'e17', type: 'trip', title: 'Sommerurlaub', start: d(-100), end: d(-93), place: 'Gardasee' },
    { id: 'e18', type: 'date', title: 'Brunch', start: d(-140), time: '11:00', place: 'Café Lotte' },
    { id: 'e19', type: 'date', title: 'Pizza essen', start: d(-200), time: '19:00', place: 'Da Mario' },
    { id: 'e20', type: 'trip', title: 'Städtetrip', start: d(-400), end: d(-397), place: 'Wien' },
    { id: 'e21', type: 'date', title: 'Picknick', start: d(-500), place: 'Stadtpark' },
  ];

  const todos = [
    { id: 't1', title: 'Geburtstagsgeschenk für Oma', createdBy: ME, due: d(5), done: false },
    { id: 't2', title: 'Fahrradschloss kaufen', createdBy: PARTNER, done: false },
    { id: 't3', title: 'Unterkunft an der Ostsee buchen', createdBy: ME, due: d(10), done: false },
    { id: 't4', title: 'Termin für Winterreifen', createdBy: PARTNER, done: false },
    { id: 't5', title: 'Wohnung putzen', createdBy: PARTNER, done: true, doneBy: ME, doneAt: ago(1, 3) },
    { id: 't6', title: 'Blumen gießen', createdBy: PARTNER, done: true, doneBy: PARTNER, doneAt: ago(3) },
    { id: 't7', title: 'Steuererklärung abgeben', createdBy: ME, done: true, doneBy: ME, doneAt: ago(12) },
    { id: 't8', title: 'Paket zurückschicken', createdBy: ME, done: true, doneBy: PARTNER, doneAt: ago(30) },
    { id: 't9', title: 'Kühlschrank auffüllen', createdBy: PARTNER, done: true, doneBy: ME, doneAt: ago(120) },
    { id: 't10', title: 'Lampe im Flur reparieren', createdBy: PARTNER, done: true, doneBy: PARTNER, doneAt: ago(150) },
    { id: 't11', title: 'Umzugskartons wegbringen', createdBy: ME, done: true, doneBy: ME, doneAt: ago(420) },
  ].map((todo, i) => ({ createdAt: ago(200 - i), ...todo }));

  const ideas = [
    { id: 'i1', title: 'Italienisch kochen', category: 'Essen', createdBy: PARTNER, likes: [ME, PARTNER], eventId: 'e7' },
    { id: 'i2', title: 'Sushi-Kurs', category: 'Essen', createdBy: ME, likes: [ME, PARTNER] },
    { id: 'i3', title: 'Wanderung in der Sächsischen Schweiz', category: 'Ausflug', createdBy: PARTNER, likes: [PARTNER] },
    { id: 'i4', title: 'Escape Room', category: 'Aktivität', createdBy: ME, likes: [ME, PARTNER] },
    { id: 'i5', title: 'Thermalbad', category: 'Ausflug', createdBy: ME, likes: [ME] },
    { id: 'i6', title: 'Töpferkurs', category: 'Aktivität', createdBy: PARTNER, likes: [] },
    { id: 'i7', title: 'Weinprobe', category: 'Essen', createdBy: ME, likes: [PARTNER] },
    { id: 'i8', title: 'Kletterhalle ausprobieren', category: 'Aktivität', createdBy: ME, likes: [ME, PARTNER], eventId: 'e14', doneAt: ago(20) },
    { id: 'i9', title: 'Picknick im Park', category: 'Ausflug', createdBy: PARTNER, likes: [ME, PARTNER], doneAt: ago(50) },
  ].map((idea, i) => ({ createdAt: ago(90 - i), ...idea }));

  const moods = {
    [ME]: { value: 72, need: '', updatedAt: ago(0, 2) },
    [PARTNER]: { value: 58, need: 'Brauch eine Umarmung', updatedAt: new Date(Date.now() - 25 * 60000).toISOString() },
  };

  // Stimmungslog der letzten drei Wochen (ein Eintrag pro Person und Tag)
  const moodLog = {};
  const curveMe = [64, 70, 55, 48, 62, 81, 88, 74, 66, 59, 71, 77, 85, 90, 68, 61, 52, 66, 79, 84, 72];
  const curvePartner = [58, 62, 70, 66, 45, 76, 92, 80, 54, 49, 63, 70, 88, 86, 60, 57, 63, 41, 72, 90, 58];
  for (let i = 0; i < curveMe.length; i++) {
    const date = d(i - (curveMe.length - 1));
    moodLog[`${date}_${ME}`] = { date, uid: ME, value: curveMe[i] };
    moodLog[`${date}_${PARTNER}`] = { date, uid: PARTNER, value: curvePartner[i] };
  }

  return { owners: [ME, PARTNER], events, todos, ideas, moods, moodLog };
}
