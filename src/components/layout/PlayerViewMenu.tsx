import { useState } from 'react';
import { Settings } from 'lucide-react';

interface PlayerViewMenuProps {
  viewMode: string;
  onToggleViewMode: () => void;
  playerObsUrl: string;
}

export function PlayerViewMenu({ viewMode, onToggleViewMode, playerObsUrl }: PlayerViewMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyObsLink() {
    if (!playerObsUrl) return;
    try {
      await navigator.clipboard.writeText(playerObsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <div className="player-view-menu">
      <button className="player-view-toggle" type="button" onClick={() => setOpen((v) => !v)} title="Teilnehmer-Einstellungen">
        <Settings size={20} />
      </button>
      {open && (
        <div className="player-view-popover">
          <button type="button" onClick={onToggleViewMode}>
            Ansicht: {viewMode === 'fullhd' ? 'FullHD' : '4K'}
          </button>
          <button type="button" disabled={!playerObsUrl} onClick={copyObsLink}>
            {copied ? 'OBS-Link kopiert!' : 'OBS-Link kopieren'}
          </button>
          <small>Für deine eigene OBS-Aufnahme inkl. Texteingabe.</small>
        </div>
      )}
    </div>
  );
}
