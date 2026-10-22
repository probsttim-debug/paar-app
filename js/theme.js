// Personenfarben nach Geschlecht: Mann = Blau, Frau = Pink.
// Alle Bildschirme nutzen die CSS-Variablen --me / --partner (+ -light);
// hier werden sie passend zum Paar gesetzt. Gemeinsames bleibt Beere-Rot.

const PALETTE = {
  m: ['#2D5BA8', '#E6EDF8'], // Blau
  w: ['#D1308A', '#FBE4F1'], // Pink
  m2: ['#0F7A8A', '#DFF1F3'], // Petrol – zweiter Mann im Paar
  w2: ['#7B3FA8', '#F0E7F7'], // Violett – zweite Frau im Paar
  none: ['#B4520F', '#FBEBDD'], // Orange – andere Person ohne Angabe
};

/** Setzt --me/--partner für das Paar. me = eigene UID. */
export function applyPersonColors(couple, me) {
  const genders = couple?.genders || {};
  const partner = couple?.members?.find((u) => u !== me);
  const mineKey = genders[me] || 'm';
  let theirsKey = genders[partner] || 'none';
  // Gleiche Farbe für beide wäre im Kalender nicht zu unterscheiden
  if (theirsKey === mineKey) theirsKey = `${mineKey}2`;

  const root = document.documentElement.style;
  root.setProperty('--me', PALETTE[mineKey][0]);
  root.setProperty('--me-light', PALETTE[mineKey][1]);
  root.setProperty('--partner', PALETTE[theirsKey][0]);
  root.setProperty('--partner-light', PALETTE[theirsKey][1]);
}

/** „Partner", „Partnerin" oder – ohne Angabe – „Partner/in". */
export function partnerWord(couple, me) {
  const partner = couple?.members?.find((u) => u !== me);
  const g = couple?.genders?.[partner];
  return g === 'w' ? 'Partnerin' : g === 'm' ? 'Partner' : 'Partner/in';
}
