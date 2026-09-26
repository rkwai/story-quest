import type { PublicTurn } from '@/engine/types';

function Opening({ text }: { text: string }) {
  return <article className="opening">{text.split('\n\n').map((paragraph, index) =>
    <p key={index} className={index === 0 ? 'dropcap' : undefined}>{paragraph}</p>
  )}</article>;
}

function StoryTurn({ turn, busy, onRetry }: { turn: PublicTurn; busy: boolean; onRetry?: (id: string) => void }) {
  // Hide retired suggestion receipts without changing accepted story history.
  const changes = turn.changes.filter(change => !change.startsWith('Lead available: '));
  return <section className="turn" aria-label={`Interaction ${turn.revision}`}>
    <div className="player-action"><span className="eyebrow">YOU</span><p>{turn.input}</p></div>
    <div className="changes"><span className="changes-label">{turn.interpretation}</span>{changes.length > 0 &&
      <ul>{changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
    }</div>
    {turn.narration ? <article className="narration">{turn.narration.split('\n\n').map((paragraph, index) =>
      <p key={index}>{paragraph}</p>
    )}</article> : <div className="fallback"><p>The outcome above is part of your story.</p>{onRetry &&
      <button className="text-button" disabled={busy} onClick={() => onRetry(turn.id)}>Continue the narration</button>
    }</div>}
  </section>;
}

export function StoryLog({ turns, opening, location, busy, onRetry }: {
  turns: PublicTurn[]; opening: string; location: string; busy: boolean; onRetry?: (id: string) => void;
}) {
  // Only the presentation is reversed. Saved history and engine replay stay chronological.
  const [latest, ...past] = [...turns].sort((a, b) => b.revision - a.revision);
  return <div className="story-body">
    <section className="latest-interaction" aria-label={latest ? 'Latest interaction' : 'Opening scene'}>
      <p className="location-label">{location.toUpperCase()}</p>
      {latest ? <StoryTurn turn={latest} busy={busy} onRetry={onRetry}/> : <Opening text={opening}/>}
    </section>
    {latest && <div className="story-history">
      <div className="history-scroll" role="region" aria-label="Past interactions, newest first" tabIndex={0}>
        {past.map(turn => <StoryTurn key={turn.id} turn={turn} busy={busy} onRetry={onRetry}/>)}
        <div className="history-opening"><Opening text={opening}/></div>
      </div>
    </div>}
  </div>;
}
