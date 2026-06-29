import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { fileToDataUrl } from '../../lib/utils';

interface AudioInputProps {
  value: string | undefined;
  name: string | undefined;
  onChange: (url: string, name: string) => void;
}

export function AudioInput({ value, name, onChange }: AudioInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handle(file: File | undefined) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      if (supabase) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-90) || 'timer-audio';
        const path = `timer-audio/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('quiz-assets')
          .upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('quiz-assets').getPublicUrl(path);
        onChange(data.publicUrl, file.name);
      } else {
        onChange(await fileToDataUrl(file), file.name);
      }
    } catch (err) {
      console.error('Timer audio upload failed:', err);
      setError('Upload fehlgeschlagen. Bitte kleinere MP3/WAV/OGG-Datei testen.');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';

    }
  }

  return (
    <div className="audio-input">
      <button type="button" disabled={uploading} onClick={() => ref.current?.click()}>
        <Upload /> {uploading ? 'Timer-Melodie lädt…' : 'Timer-Melodie wählen'}
      </button>
      <input ref={ref} type="file" accept="audio/*" hidden onChange={(e) => handle(e.target.files?.[0])} />
      {error && <div className="audio-error">{error}</div>}
      {value && (
        <div className="audio-file-row">
          <span>{name || 'Eigene Timer-Melodie aktiv'}</span>
          <button type="button" onClick={() => onChange('', '')}>
            Entfernen
          </button>
        </div>
      )}
    </div>
  );
}
