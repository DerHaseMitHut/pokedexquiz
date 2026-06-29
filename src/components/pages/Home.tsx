import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { createRoom, saveRoom, loadRoom, randomCode, listKey } from '../../lib/roomStorage';

export function Home() {
  const [join, setJoin] = useState('');
  const recent = JSON.parse(localStorage.getItem(listKey()) || '[]') as string[];
  function startRoom() {
    let code = randomCode();
    while (loadRoom(code)) code = randomCode();
    const room = createRoom(code);
    saveRoom(room);
    window.location.href = `/host/${code}`;
  }
  return (
    <main className="home shell">
      <section className="hero-card">
        <div className="brand">
          <Sparkles /> Quizshow Tool
        </div>
        <h1>Bild. Texte. Bluff. Auflösung.</h1>
        <p>
          Eine 16:9-Showoberfläche für OBS mit Host-Steuerung, Spieleransicht, VDO.Ninja-Kameras, A–E-Antwortkarten
          und animierter Punktevergabe.
        </p>
        <div className="home-actions">
          <button className="primary big" onClick={startRoom}>
            <Plus /> Neuen Raum starten
          </button>
          <div className="join-box">
            <input placeholder="Raumcode" value={join} onChange={(e) => setJoin(e.target.value.toUpperCase())} />
            <button onClick={() => join && (window.location.href = `/player/${join}`)}>Beitreten</button>
          </div>
        </div>
        {recent.length > 0 && (
          <div className="recent">
            <span>Zuletzt:</span>
            {recent.map((c) => (
              <a key={c} href={`/host/${c}`}>
                {c}
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
