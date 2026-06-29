import type { PlayerControls } from '../../types/room';

export function PlayerWritingPanel({ controls }: { controls: PlayerControls }) {
  const buttonLabel = controls.isEditing
    ? 'Korrektur erneut absenden'
    : controls.hasSubmitted
      ? 'Antwort abgegeben'
      : 'Text abgeben';
  return (
    <div className="player-writing-panel">
      <div className="player-writing-title">
        {controls.isEditing ? 'Korrektur' : controls.hasSubmitted ? 'Antwort abgegeben' : 'Antwort schreiben'}
      </div>
      <div className="answer-input-wrap">
        <textarea
          maxLength={200}
          placeholder="Dein Text zur Runde"
          value={controls.text}
          disabled={controls.hasSubmitted || controls.readOnly}
          readOnly={controls.readOnly}
          onChange={(e) => controls.setText(e.target.value.slice(0, 200))}
        />
        <div className="char-counter">{controls.charCount} / 200 Zeichen</div>
      </div>
      {!controls.readOnly && (
        <button className="primary" disabled={!controls.canSubmit} onClick={controls.requestSubmit}>
          {buttonLabel}
        </button>
      )}
      {controls.readOnly && (
        <div className="obs-readonly-note">
          {controls.hasSubmitted ? 'Antwort abgegeben' : 'Live-Vorschau deiner Eingabe'}
        </div>
      )}
      {controls.submitConfirmOpen && !controls.readOnly && (
        <div className="inline-confirm submit-confirm">
          <span>Antwort so abschicken?</span>
          <div className="inline-confirm-actions">
            <button type="button" className="confirm-yes" onClick={controls.submitText}>
              Ja
            </button>
            <button type="button" className="confirm-no" onClick={() => controls.setSubmitConfirmOpen(false)}>
              Nein
            </button>
          </div>
        </div>
      )}
      {controls.isEditing && (
        <p className="edit-notice">
          Der Host hat deine Antwort zur Korrektur freigegeben. Dein bisheriger Text ist schon eingetragen.
        </p>
      )}
    </div>
  );
}
