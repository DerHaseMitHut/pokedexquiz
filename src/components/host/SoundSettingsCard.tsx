import { useState, useEffect } from 'react';
import { soundSettings } from '../../lib/utils';
import { volumePercent, playCustomAudio } from '../../lib/audio';
import { AudioInput } from '../shared/AudioInput';
import type { Room } from '../../types/room';
import type { SoundSettings, SoundEventSettings } from '../../types/sound';

interface SoundSettingsCardProps {
  room: Room;
  onChange: (partial: Partial<SoundSettings>) => void;
  onTest: () => void;
  compact?: boolean;
}

export function SoundSettingsCard({ room, onChange, onTest, compact }: SoundSettingsCardProps) {
  const settings = soundSettings(room.settings);
  const setEvent = (key: keyof SoundEventSettings, value: boolean) =>
    onChange({ events: { ...settings.events, [key]: value } });
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  useEffect(() => () => {
    if (previewAudio) previewAudio.pause();
  }, [previewAudio]);

  function testTimerAudio() {
    if (!settings.timerAudio) return;
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setPreviewAudio(null);
      return;
    }
    const audio = playCustomAudio(settings.timerAudio, settings.timerVolume ?? 35, true);
    if (audio) {
      setPreviewAudio(audio);
      audio.addEventListener('ended', () => setPreviewAudio(null), { once: true });
    }
  }

  return (
    <details className={`sound-settings-card ${compact ? 'sidebar-sound' : 'control-card'}`} open={!compact}>
      <summary>Sound-Einstellungen</summary>
      <label className="toggle-row">
        <input type="checkbox" checked={settings.sounds !== false} onChange={(e) => onChange({ sounds: e.target.checked })} />{' '}
        Sounds aktiv
      </label>
      <label className="range-row volume-row">
        <span>
          Show-Sounds <b>{volumePercent(settings.volume, 55)}%</b>
        </span>
        <input
          type="range"
          min="0"
          max="200"
          step="2"
          value={volumePercent(settings.volume, 55)}
          onChange={(e) => onChange({ volume: Number(e.target.value) })}
        />
      </label>
      <label className="range-row volume-row">
        <span>
          Timer-Musik <b>{volumePercent(settings.timerVolume, 35)}%</b>
        </span>
        <input
          type="range"
          min="0"
          max="200"
          step="2"
          value={volumePercent(settings.timerVolume, 35)}
          onChange={(e) => onChange({ timerVolume: Number(e.target.value) })}
        />
      </label>
      <div className="sound-toggle-grid">
        <label>
          <input
            type="checkbox"
            checked={settings.events.timerTick}
            onChange={(e) => setEvent('timerTick', e.target.checked)}
          />{' '}
          Timer-Musik
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.events.answerShow}
            onChange={(e) => setEvent('answerShow', e.target.checked)}
          />{' '}
          Antworten einblenden
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.events.answerReveal}
            onChange={(e) => setEvent('answerReveal', e.target.checked)}
          />{' '}
          Antworten auflösen
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.events.voteCast}
            onChange={(e) => setEvent('voteCast', e.target.checked)}
          />{' '}
          Kandidat wählt Antwort
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.events.scoreAward}
            onChange={(e) => setEvent('scoreAward', e.target.checked)}
          />{' '}
          Punktevergabe
        </label>
      </div>
      <AudioInput
        value={settings.timerAudio}
        name={settings.timerAudioName}
        onChange={(timerAudio, timerAudioName) => {
          if (previewAudio) {
            previewAudio.pause();
            setPreviewAudio(null);
          }
          onChange({ timerAudio, timerAudioName });
        }}
      />
      <div className="sound-buttons">
        <button onClick={onTest}>Show-Sound testen</button>
        {settings.timerAudio && (
          <button onClick={testTimerAudio}>{previewAudio ? 'Timer-Test stoppen' : 'Timer-Melodie testen'}</button>
        )}
      </div>
    </details>
  );
}
