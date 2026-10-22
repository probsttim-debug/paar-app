# Paar-App (Arbeitstitel)

Private Web-App für zwei Personen (mich und meine Freundin): gemeinsamer Kalender, To-dos, Date-Ideen, Stimmungsanzeige, Zusammen-Zähler und Statistiken. Die gesamte Oberfläche ist auf **Deutsch**.

## Technik (verbindlich)

- **PWA**, gehostet auf **GitHub Pages**, genutzt auf dem iPhone über Safari „Zum Home-Bildschirm“. Mobile first, Breite 390 px als Referenz.
- Kein Build-Schritt nötig: HTML, CSS und JavaScript (ES-Module). Firebase JS SDK (modular) per CDN.
- Backend: **Firebase im kostenlosen Spark-Plan. Niemals auf Blaze upgraden** und nichts einbauen, was Blaze voraussetzt:
  - **Kein Cloud Storage** (braucht seit Feb. 2026 immer Blaze).
  - **Keine Cloud Functions**, keine Push-Benachrichtigungen in Version 1.
- Firebase Authentication (E-Mail/Passwort) und Firestore.
- Sparsam mit Lesezugriffen (Spark: 50.000 Reads/Tag): Listener nur für den aktuell sichtbaren Bereich, Firestore-Offline-Cache nutzen, große Daten (Foto) in eigenem Dokument, das nicht bei jedem Öffnen mitgeladen wird.
- `manifest.json`, Service Worker und App-Icon für die Home-Bildschirm-Installation.

## Datenmodell (Vorschlag)

- `users/{uid}`: `coupleId` – zu welchem Paar die Person gehört (nur für sie selbst lesbar)
- `couples/{coupleId}`: `members` (2 UIDs), `names`, `genders` (je UID `m` = Mann/Blau oder `w` = Frau/Pink), `startDate` (Beginn der Beziehung), `createdAt`
- `couples/{coupleId}/meta/photo`: `dataUrl` (Hintergrundbild, siehe unten), `updatedAt`
- `couples/{coupleId}/events/{id}`: `type` (`date` | `trip` | `other` | `busy`), `title`, `start`, `end`, `time`, `place`, `note`, `owner` (nur bei `busy`: UID der verplanten Person), `ideaId` (optional), `repeat` (optional, nur bei `busy`: `{ weekdays: [0–6, 0 = Mo], until? }` – fester Termin jede Woche), `skip` (ausgelassene Tage einer Serie, `YYYY-MM-DD`)
- `couples/{coupleId}/todos/{id}`: `title`, `createdBy`, `due`, `done`, `doneBy`, `doneAt`
- `couples/{coupleId}/ideas/{id}`: `title`, `category` (`Essen` | `Ausflug` | `Aktivität`), `createdBy`, `likes` (UIDs), `doneAt`, `eventId`
- `couples/{coupleId}/moods/{uid}`: aktueller Stand – `value` (0–100), `need` (Text, max. 40 Zeichen), `updatedAt`
- `couples/{coupleId}/moodLog/{yyyy-mm-dd_uid}`: ein Eintrag pro Person und Tag (letzter Wert des Tages) für die Statistik
- **Koppeln**: Person A legt das Paar an und bekommt einen Einladungscode, Person B tritt mit dem Code bei. Danach ist das Paar voll (max. 2 Mitglieder).
  - Umsetzung: `couples/{coupleId}` bekommt zusätzlich `inviteCode` (solange nur 1 Mitglied) bzw. `joinedWith` (Code, mit dem B beigetreten ist). `invites/{code}`: `coupleId`, `createdBy`, `createdAt` – lesbar nur per direktem Abruf (kein Auflisten), wird beim Beitritt gelöscht. Code: 8 Zeichen ohne verwechselbare Zeichen, angezeigt als `ABCD-EFGH`.
  - Namen: jede Person trägt beim Koppeln ihren eigenen Namen ein (`names.{uid}`).
- **Security Rules**: Lesen und Schreiben nur für die beiden `members` des jeweiligen Paars. Pflichtfelder und Längen in den Rules prüfen.

## Fotos ohne Cloud Storage

- Hintergrundbild im Browser verkleinern (max. ca. 1080 px Kantenlänge, JPEG, Qualität ca. 0,7) und als Data-URL in `meta/photo` speichern.
- Dokument muss deutlich unter dem Firestore-Limit von 1 MiB bleiben (Base64 macht die Datei ca. ein Drittel größer): Zielgröße unter 600 KB, notfalls weiter verkleinern.

## Bildschirme

Untere Navigationsleiste mit vier Punkten: **Start, Kalender, To-dos, Statistik**.

### Start
- Begrüßung („Guten Abend“) und „Ihr zwei“, zwei Avatare (Initialen).
- **Zusammen-Karte**: „Zusammen seit [Datum]“, große Tageszahl, darunter drei Kästchen Jahre/Monate/Tage, Countdown und Fortschrittsbalken bis zum nächsten Jahrestag.
  - Hintergrund standardmäßig Beere-Rot. Kamera-Knopf oben rechts in der Karte: eigenes Foto als Hintergrund wählen oder entfernen. Mit Foto bleibt das Layout identisch; ein gleichmäßiger dunkler Schleier (ca. 30–60 % Deckkraft von oben nach unten) und leichter Textschatten halten die weiße Schrift lesbar, die Kästchen sind halbtransparent mit Weichzeichner.
  - Die Karte darf im scrollenden Bereich nicht schrumpfen (`flex-shrink: 0`).
- **„Wie geht's euch?“**: zwei Karten nebeneinander (Partnerin und Du) mit Gesicht, Stimmungswort, Wert 0–100 als kleiner Balken, Zeit seit dem Update, optional Bedürfnis-Chip.
- **Deine Stimmung**: Schieberegler 0–100. Das Gesicht lächelt stufenlos mit (Mundkurve interpoliert). Wörter: 0–19 Mies, 20–39 Naja, 40–59 Okay, 60–79 Gut, 80–100 Super.
- **„Was brauchst du gerade?“**: Chips „Brauch Ruhe“, „Brauch eine Umarmung“, „Lust was zu unternehmen“ (erneutes Tippen entfernt) plus Textfeld für eigenen Text (max. 40 Zeichen) mit Knopf „Setzen“.
- **Als Nächstes**: die nächsten gemeinsamen Termine, Link zum Kalender, Kachel „X offene To-dos“.

### Kalender
- **Diese Woche**: Raster mit Zeile „Du“ und Zeile [Name], Spalten Mo–So. Verplant = Farbe der Person, gemeinsamer Termin = Beere-Rot über beide Zeilen mit Herz, frei = grau, **beide frei** = grün umrandet. Darunter Hinweis „Ihr habt beide Zeit: …“ mit Link zu den Date-Ideen.
- **Monatsansicht**: Tage mit gemeinsamem Termin rosa hinterlegt, kleine Punkte (Blau/Orange) für „verplant“, heutiger Tag mit Rahmen. Tippen auf einen Tag zeigt, wer was vorhat; ist niemand verplant: „Ihr seid beide frei“ mit Link zu den Date-Ideen.
- Liste „Demnächst zusammen“.
- Schwebender Plus-Knopf zum Eintragen: Typ (Date, Urlaub, Sonstiges gemeinsam, „Ich bin verplant“), Datum/Zeitraum, Uhrzeit, Ort, Notiz.

### Listen (Tab „To-dos“)
- Überschrift „Unsere Listen“, zwei große Umschalter **To-dos** | **Date-Ideen**.
- **To-dos**: Eingabefeld + Plus-Knopf, Umschalter Offen/Erledigt mit Anzahl, Abhaken speichert, wer erledigt hat. Avatar zeigt, wer die Aufgabe angelegt hat.
- **Date-Ideen**: Eingabefeld, Filter Alle/Essen/Ausflug/Aktivität, Karten mit Kategorie, „Vorschlag von …“, Herz zum Liken. Ideen, die beide mögen, stehen oben mit Label „Wollt ihr beide“. Knopf „Einplanen“ legt einen Kalendereintrag an und verknüpft ihn. Bereich „Schon gemacht“.

### Statistik
- Umschalter „Dieses Jahr“ | „Gesamt“.
- Countdown: nächstes Date, nächster Urlaub.
- Kacheln: Dates, Urlaubstage, besuchte Orte, erledigte To-dos.
- Erledigte To-dos im Vergleich (zwei Balken).
- Stimmung der Woche: Balken pro Tag für beide, **Skala 0–100**, Satz zu den besten Tagen.
- Häufigster Ort, längster Urlaub.
- Alles wird im Browser aus Kalender, To-dos und Stimmungslog berechnet.

## Design

- Schrift: **Plus Jakarta Sans** (Google Fonts), Überschriften 800, Text 400–700.
- Farben:
  - Hintergrund `#F5F3F7`, Karten `#FFFFFF` mit Rand `#ECE8F0`
  - Text `#1D1A26`, gedämpft `#5E5A6B`
  - Akzent Beere `#B0285E`, hell `#FBE8EF`
  - Du: Blau `#2D5BA8`, hell `#E6EDF8`
  - Partnerin: Orange `#B4520F`, hell `#FBEBDD`
  - Beide frei / erledigt: Grün `#2F7D5B`, hell `#E3F2EA`
- Rundungen: Karten 20–24 px, Knöpfe 14–16 px, Chips voll rund.
- Tippflächen mindestens 44 px, Kontrast mindestens 4,5:1, echte `<button>`/`<label>`-Elemente.
- Icons als schlichte Linien-SVGs, keine Emojis.

## Nicht in Version 1

- Push-Benachrichtigungen, Erinnerungen/Fotoalbum, Zeitkapsel, Frage des Tages (Ideen für später).

## Arbeitsweise

- In kleinen Schritten bauen und nach jedem Schritt committen: 1) Grundgerüst + PWA + alle Bildschirme mit Beispieldaten, 2) Login + Koppeln, 3) Firestore-Anbindung Start, 4) Kalender, 5) Listen, 6) Statistik, 7) Security Rules.
- Firebase-Konfiguration kommt in eine eigene Datei; keine Zugangsdaten oder Passwörter ins Repository außer der öffentlichen Web-Konfiguration.
- Vor dem Abschluss jedes Schritts in schmaler Mobilansicht testen.
