import { useState, useEffect } from 'react';
import { Crown, Users } from 'lucide-react';
import { ImageInput } from '../shared/ImageInput';
import type { Player, Host } from '../../types/room';

interface PersonEditorProps {
  label: string;
  person: Player | Host;
  onChange: (data: Partial<Player & Host>) => void;
  isHost?: boolean;
}

export function PersonEditor({ label, person, onChange, isHost }: PersonEditorProps) {
  const [name, setName] = useState(person.name);
  const [points, setPoints] = useState(String(person.points ?? 0));
  const [vdoUrl, setVdoUrl] = useState(person.vdoUrl);

  // Sync incoming prop changes only when the user isn't editing (Realtime updates from other clients)
  const [focusedField, setFocusedField] = useState<string | null>(null);
  useEffect(() => { if (focusedField !== 'name') setName(person.name); }, [person.name]);
  useEffect(() => { if (focusedField !== 'points') setPoints(String(person.points ?? 0)); }, [person.points]);
  useEffect(() => { if (focusedField !== 'vdoUrl') setVdoUrl(person.vdoUrl); }, [person.vdoUrl]);

  return (
    <div className="person-editor">
      <div className="editor-head">
        <span>
          {isHost ? <Crown size={16} /> : <Users size={16} />}
          {label}
        </span>
        <span className={(person as { connected?: boolean }).connected ? 'online' : 'offline'}>
          {(person as { connected?: boolean }).connected ? 'online' : 'slot'}
        </span>
      </div>
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={() => setFocusedField('name')}
        onBlur={() => { setFocusedField(null); onChange({ name }); }}
      />
      {!isHost && (
        <input
          type="number"
          placeholder="Punkte"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          onFocus={() => setFocusedField('points')}
          onBlur={() => { setFocusedField(null); onChange({ points: Number(points) }); }}
        />
      )}
      <input
        placeholder="VDO.Ninja View-Link"
        value={vdoUrl}
        onChange={(e) => setVdoUrl(e.target.value)}
        onFocus={() => setFocusedField('vdoUrl')}
        onBlur={() => { setFocusedField(null); onChange({ vdoUrl }); }}
      />
      <ImageInput label="Marker/Icon" value={person.icon} onChange={(icon) => onChange({ icon })} compact />
    </div>
  );
}
