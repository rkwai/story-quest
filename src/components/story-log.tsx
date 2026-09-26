import type { PublicTurn } from '@/engine/types';

function Opening({ text }: { text: string }) {
  return <article className="opening">{text.split('\n\n').map((paragraph, index) =>
    <p key={index} className={index === 0 ? 'dropcap' : undefined}>{paragraph}</p>
  )}</article>;
}

function StoryTurn({ turn, busy, onRetry }: { turn: PublicTurn; busy: boolean; onRetry?: (id: string) => void }) {
  return <section className="turn" aria-label={`Interaction ${turn.revision}`}>
    <div className="player-action"><span className="eyebrow">YOU</span><p>{turn.input}</p></div>
    <div className="changes"><span className="changes-label">{turn.interpretation}</span>{turn.changes.length > 0 &&
      <ul>{turn.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
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
    <section className="latest-interaction" aria-labelledby="latest-interaction-heading">
      <div className="story-section-heading"><h2 id="latest-interaction-heading">{latest ? 'Latest interaction' : 'The beginning'}</h2>{latest && <span>Turn {latest.revision}</span>}</div>
      <p className="location-label">{location.toUpperCase()}</p>
      {latest ? <StoryTurn turn={latest} busy={busy} onRetry={onRetry}/> : <Opening text={opening}/>}
    </section>
    {latest && <section className="story-history" aria-labelledby="story-history-heading">
      <div className="story-section-heading"><h2 id="story-history-heading">Past story</h2><span>{past.length ? `${past.length} earlier ${past.length === 1 ? 'interaction' : 'interactions'}` : 'Opening scene'}</span></div>
      <p className="history-help">Newest first. Scroll to revisit earlier moments.</p>
      <div className="history-scroll" role="region" aria-label="Past interactions, newest first" tabIndex={0}>
        {past.map(turn => <StoryTurn key={turn.id} turn={turn} busy={busy} onRetry={onRetry}/>)}
        <div className="history-opening"><p className="eyebrow">THE BEGINNING</p><Opening text={opening}/></div>
      </div>
    </section>}
  </div>;
}
