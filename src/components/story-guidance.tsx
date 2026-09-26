import type { PlayerView, QuestScope } from '@/engine/types';

type PublicQuest = PlayerView['quests'][number];
const scopeLabels:Record<QuestScope,string> = {world:'World',arc:'Major',local:'Local',immediate:'Immediate'};

export function focusedQuest(view:PlayerView):PublicQuest|undefined {
  return view.story
    ? view.quests.find(quest=>quest.id===view.story?.focusQuestId && quest.status==='active')
    : view.quests.find(quest=>quest.status==='active');
}

export function QuestJournal({quests}: {quests:PublicQuest[]}) {
  if (!quests.length) return <p className="muted">No quests yet. The people you meet and choices you make can open new threads.</p>;
  return <div className="quest-list">{quests.map(quest=>{
    const parent=quests.find(candidate=>candidate.id===quest.parentId);
    return <article className="quest-card" key={quest.id} aria-label={quest.title}>
      <div className="quest-labels"><span className={`badge ${quest.status}`}>{quest.status}</span>{quest.scope&&<span className="quest-scope">{scopeLabels[quest.scope]}</span>}</div>
      <h3>{quest.title}</h3>
      {parent&&<p className="quest-parent">Part of: {parent.title}</p>}
      <p>{quest.description}</p>
      {quest.objective&&<p className="quest-objective"><strong>Objective</strong>{quest.objective}</p>}
      {quest.stakes&&<p className="quest-stakes"><strong>Why it matters</strong>{quest.stakes}</p>}
    </article>;
  })}</div>;
}
