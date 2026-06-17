# Quizshow Tool

Erster Prototyp für eine 4-Spieler-Quizshow mit Host-, Spieler- und OBS-Ansicht.

## Starten

```bash
npm install
npm run dev
```

Danach öffnet Vite die Webseite normalerweise unter:

```text
http://localhost:5173
```

Der lokale Sync-Server läuft gleichzeitig unter:

```text
http://localhost:3001
```

Wichtig: Diese Version nutzt für lokale Tests einen kleinen Sync-Server. Dadurch funktionieren Host, Spieler und OBS auch in verschiedenen Browsern oder Inkognito-Tabs. In der ersten ZIP-Version war nur `localStorage` aktiv; das war der Grund, warum Inkognito-Tabs den Raum nicht gesehen haben.

## Links

- `/` Startseite
- `/host/RAUMCODE` Host-Ansicht
- `/player/RAUMCODE` Spieler-Ansicht
- `/obs/RAUMCODE` OBS-Ansicht

## Lokaler Testablauf

1. `npm run dev` starten.
2. Auf der Startseite einen Raum erstellen.
3. Im Host links den Spieler-Link kopieren und in 4 normalen/Inkognito-Tabs öffnen.
4. Spieler mit Namen joinen lassen.
5. OBS-Link kopieren oder öffnen.
6. Runde starten und testen.

## Hinweise

- Bilder und Icons sind im Prototyp noch Base64-Daten im Raumzustand. Für die echte Online-Version sollten sie in Supabase Storage gespeichert werden.
- Online ist als Ziel weiterhin Netlify + Supabase geplant.
- Für Netlify/Supabase wird der lokale Sync-Server später durch Supabase Realtime ersetzt.


## Online-Sync mit Supabase

Diese Version speichert Räume in Supabase (`quiz_rooms`) und synchronisiert Host, Spieler und OBS über Supabase Realtime.

Die Supabase-Werte liegen für den lokalen Test bereits in `.env.local`.

Start:

```bash
npm install
npm run dev
```

Für Netlify später dieselben Variablen setzen:

```text
VITE_SUPABASE_URL=https://xfsirzvqpypbxxymznct.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_SjLbqIxvkHwNKKWeCgZKYQ_yzhe-sAm
```

Der lokale Sync-Server ist noch als Fallback enthalten, wird aber nicht genutzt, solange Supabase-Variablen gesetzt sind.


## Netlify Build-Fix

Diese Version pinnt Vite auf eine stabile 5.x-Version und enthält **keine package-lock.json**.
Wenn du diese Version ins GitHub-Repo kopierst, bitte darauf achten, dass die alte `package-lock.json`
im Repo gelöscht wird. Netlify installiert dann die Dependencies frisch aus `package.json`.

Build command bleibt:
`npm run build`

Publish directory:
`dist`


## Fixed32 Timer-Melodie

Timer-Audiodateien werden online nicht mehr als riesiger Text im Raum-State gespeichert, sondern in den Supabase-Storage-Bucket `quiz-assets` hochgeladen. Im Raum wird nur noch die öffentliche URL gespeichert.


## Fixed33 Timer-Sound

- Timer-Melodie-Test kann jetzt gestoppt werden.
- Timer-Musik hat einen eigenen Lautstärkeregler getrennt von den Show-Sounds.


## Fixed34 Timer-Musik

Die Timer-Musik stoppt jetzt automatisch, sobald der Countdown 0:00 erreicht.


## Fixed35 Lautstärke-Regler

Die Lautstärkeregler gehen jetzt von 0–200% und werden intern mit einer feineren Kurve umgerechnet.
Dadurch gibt es zwischen stumm und laut viel mehr brauchbare Zwischenstufen.
