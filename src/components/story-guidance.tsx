import type { PlayerView, PublicLead, QuestScope } from '@/engine/types';

type PublicQuest = PlayerView['quests'][number];
const scopeLabels:Record<QuestScope,string> = {world:'World',arc:'Major',local:'Local',immediate:'Immediate'};

export function focusedQuest(view:PlayerView):PublicQuest|undefined {
  return view.story
    ? view.quests.find(quest=>quest.id===view.story?.focusQuestId && quest.status==='active')
    : view.quests.find(quest=>quest.status==='active');
}

export function StoryGuidance({view,readOnly,busy,onChoose}: {
  view:PlayerView;
  readOnly:boolean;
  busy:boolean;
  onChoose:(lead:PublicLead)=>void;
}) {
  const focus=focusedQuest(view);
  const leads=view.story?.leads.slice(0,3)??[];
  return <section className="story-guidance" aria-labelledby="story-guidance-heading">
    <p className="eyebrow" id="story-guidance-heading">{leads.length?'A LEAD TO FOLLOW':focus?'THE THREAD YOU’RE FOLLOWING':'WHAT DRAWS YOUR ATTENTION?'}</p>
    {focus&&<><h3>{focus.title}</h3><p className="guidance-objective">{focus.objective??focus.description}</p></>}
    {!focus&&!leads.length&&<p className="guidance-objective">Look around, speak to someone, or describe what matters to your character.</p>}
    {leads.length>0&&<ul className="story-leads">{leads.map(lead=><li key={`${lead.questId}:${lead.id}`}>{readOnly?<p>{lead.text}</p>:<button type="button" disabled={busy} onClick={()=>onChoose(lead)}><span>{lead.text}</span><span aria-hidden="true">↗</span></button>}</li>)}</ul>}
    {!readOnly&&<p className="guidance-freedom">Follow a lead or choose your own path.</p>}
  </section>;
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
      {quest.status==='active'&&!!quest.leads?.length&&<div className="quest-leads"><p className="quest-leads-label">Known leads</p><ul>{quest.leads.map(lead=><li key={lead.id}>{lead.text}</li>)}</ul></div>}
    </article>;
  })}</div>;
}
