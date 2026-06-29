import { Camera, Crown } from 'lucide-react';
import { normalizeVdoUrl } from '../../lib/utils';
import { PlayerMarker } from './PlayerMarker';
import type { PersonCard, ScoreEffect } from '../../types/room';

interface CamCardProps {
  person: PersonCard;
  active: boolean;
  scoreEffect?: ScoreEffect;
}

export function CamCard({ person, active, scoreEffect }: CamCardProps) {
  const isHost = 'isHost' in person && person.isHost;
  const url = normalizeVdoUrl(person.vdoUrl);
  const awardAmount = Number(scoreEffect?.amount || 0);
  const scoreKey = scoreEffect?.eventId || 'idle';
  return (
    <div
      className={`cam-card ${isHost ? 'host' : ''} ${active ? 'active' : ''} ${awardAmount ? 'score-hit' : ''}`}
      data-score-event={scoreKey}
    >
      <div className="cam-frame" key={`frame-${scoreKey}`}>
        {url ? (
          <iframe src={url} allow="camera;microphone;autoplay;fullscreen;display-capture" />
        ) : (
          <div className="cam-placeholder">
            <Camera />
            <span>{isHost ? 'HOST CAM' : 'CAM'}</span>
          </div>
        )}
      </div>
      <div className="nameplate">
        <span className="name-icon">
          {!isHost && <PlayerMarker player={person} small home />} {isHost && <Crown size={15} />}
        </span>
        <span className="name-text">{person.name || (isHost ? 'Host' : `Spieler ${'slot' in person ? person.slot : ''}`)}</span>
        {!isHost && (
          <b className="score-badge" key={`badge-${scoreKey}`}>
            {person.points} P
          </b>
        )}
        {awardAmount > 0 && (
          <em className="score-pop" key={`pop-${scoreKey}`}>
            +{awardAmount}
          </em>
        )}
      </div>
    </div>
  );
}
