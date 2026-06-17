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
