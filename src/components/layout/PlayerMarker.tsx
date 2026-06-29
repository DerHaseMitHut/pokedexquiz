import type { PersonCard } from '../../types/room';

interface PlayerMarkerProps {
  player: PersonCard | undefined;
  large?: boolean;
  small?: boolean;
  home?: boolean;
  fly?: boolean;
  style?: React.CSSProperties;
}

export function PlayerMarker({ player, large, small, home, fly, style }: PlayerMarkerProps) {
  if (!player) return null;
  const classes = ['marker', large ? 'large' : '', small ? 'small' : '', home ? 'home-marker' : '', fly ? 'fly-marker' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} title={player.name} style={{ borderColor: player.color, ...(style || {}) }}>
      {player.icon ? <img src={player.icon} /> : <b>{(player.name || '?').slice(0, 1).toUpperCase()}</b>}
    </span>
  );
}
