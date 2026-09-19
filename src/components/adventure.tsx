'use client';
import { useEffect, useRef, useState } from 'react';
import { demoTurn, newSample, OPENING, suggestions, type SampleChoice } from '@/engine/demo';
import { playerView } from '@/engine/view';
import { type PlayerView, type PublicTurn } from '@/engine/types';

type Tab = 'Story' | 'Character' | 'Journal' | 'World';
type CampaignSummary = { id:string; title:string; character_name?:string; revision:number; created_at:string; updated_at:string; archived_at:string|null };
type CampaignData = { id:string; archived:boolean; view:PlayerView; turns:PublicTurn[] };
const SELECTED_KEY = 'storyquest.campaign.shared.v1';
const DEFAULT_NAME = 'Rowan';
const DEFAULT_PREMISE = 'A quiet fantasy world where old promises carry weight. I arrive at the ruined town of Ashford looking for answers.';
const resetKey = (id:string) => `storyquest.reset.${id}`;
const pendingKey = (id:string) => `storyquest.pending.${id}`;
const missingCampaign = (code:string) => ['NOT_FOUND','CAMPAIGN_NOT_FOUND','CAMPAIGN_DELETED'].includes(code);
// These failures come from validating a model proposal before a world commit.
// Do not tell the player that their natural-language action was invalid.
const proposalRejectionCodes = new Set([
  'INVALID_PROPOSAL','INVALID_CLARIFICATION','ACTION_HAS_CLARIFICATION',
  'UNKNOWN_ENTITY','DUPLICATE_ID','INVALID_OBSERVER','INVALID_CONDITION',
  'ESTABLISHED_FACT','FUTURE_FACT','UNKNOWN_FACT','INVALID_NEW_QUEST',
  'UNKNOWN_QUEST','QUEST_ALREADY_RESOLVED','INVALID_DEADLINE',
  'UNKNOWN_PENDING_EVENT','EVENT_WITHOUT_OUTCOME','INVALID_EVENT_OUTCOME',
  'INVALID_LOCATION','INVALID_OWNER','ITEM_TWO_LOCATIONS','INVALID_SPEAKER',
  'UNRESOLVED_DEADLINE','INVALID_PLAYER',
]);
const messages: Record<string,string> = {
  MODEL_UNAVAILABLE: 'The storyteller is taking a moment. Your action has not been applied. Please try again.',
  MODEL_INCOMPLETE: 'The storyteller could not finish that turn. Your world is unchanged.',
  MODEL_INVALID_OUTPUT: 'The AI response could not be applied consistently. Your world is unchanged, and your text is kept. You can try sending it again.',
  STALE_REVISION: 'Another player advanced this adventure. The latest chapter is now loaded; review it before trying again.',
  TURN_BUSY: 'Another turn is still being resolved. Please wait a moment.',
  NARRATION_BUSY: 'The storyteller is finishing a passage. Please try again in a moment.',
  CAMPAIGN_ARCHIVED: 'This run was reset. Its history is saved; open Adventures to continue the new run.',
  CAMPAIGN_LIMIT: 'The playtest has reached its active adventure limit. Resume, reset, or delete an existing adventure.',
  RATE_LIMIT: 'Give your last action a moment to settle, then try again.',
  DAILY_LIMIT: 'The playtest has reached today’s adventure limit. All stories are safely saved.',
  NOT_CONFIGURED: 'AI adventures are currently unavailable. Please try again later.',
  CONTEXT_BUDGET_EXCEEDED: 'This scene has become too complex to resolve safely. Your world is unchanged.',
  NARRATION_LIMIT: 'The outcome is saved. The story text could not be completed for this turn.',
};
function storageGet(key:string) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key:string,value:string) { try { localStorage.setItem(key,value); } catch { /* The server is the saved source of truth. */ } }
function storageRemove(key:string) { try { localStorage.removeItem(key); } catch { /* Storage is optional. */ } }
async function api(path:string, body?:unknown) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', cache:'no-store',
    ...(body === undefined ? {} : { headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'REQUEST_FAILED');
  return payload;
}
function Icon({ name }: { name: Tab | 'send' | 'close' | 'spark' }) {
  const paths: Record<string, React.ReactNode> = {
    Story: <><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3z"/></>,
    Character: <><circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></>,
    Journal: <><path d="M6 3h13v18H6zM3 7h5M3 12h5M3 17h5M11 8h5M11 12h5"/></>,
    World: <><circle cx="12" cy="12" r="9"/><path d="m15 8-2 5-5 3 2-5z"/></>,
    send: <><path d="m5 12 7-7 7 7M12 5v15"/></>, close: <path d="m6 6 12 12M18 6 6 18"/>, spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function storyTime(minute: number) { const day = Math.floor(minute / 1440)+1, hour = Math.floor((minute%1440)/60); return `Day ${day} · ${hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night'}`; }

export function Adventure({ liveAvailable }: { liveAvailable: boolean }) {
  const [sample,setSample] = useState(newSample);
  const [view,setView] = useState<PlayerView>(() => playerView(newSample().world));
  const [turns,setTurns] = useState<PublicTurn[]>([]);
  const [tab,setTab] = useState<Tab>('Story');
  const [input,setInput] = useState('');
  const [busy,setBusy] = useState(false);
  const [phase,setPhase] = useState('');
  const [notice,setNotice] = useState('');
  const [ready,setReady] = useState(false);
  const [lobby,setLobby] = useState(true);
  const [campaign,setCampaign] = useState<string|null>(null);
  const [lastSelected,setLastSelected] = useState<string|null>(null);
  const [archived,setArchived] = useState(false);
  const [resetConfirm,setResetConfirm] = useState(false);
  const [deleteConfirm,setDeleteConfirm] = useState<string|null>(null);
  const [customize,setCustomize] = useState(false);
  const [name,setName] = useState(DEFAULT_NAME);
  const [premise,setPremise] = useState(DEFAULT_PREMISE);
  const [campaigns,setCampaigns] = useState<CampaignSummary[]>([]);
  const [listLoading,setListLoading] = useState(liveAvailable);
  const [listError,setListError] = useState('');
  const [lobbyMessage,setLobbyMessage] = useState('');
  const submitting = useRef(false);
  const listRequest = useRef(0);
  const pending = useRef<{id:string;input:string;campaign:string}|null>(null);
  const resetRequest = useRef<{id:string;campaign:string}|null>(null);
  const cancelReset = useRef<HTMLButtonElement|null>(null);
  const cancelDelete = useRef<HTMLButtonElement|null>(null);
  const end = useRef<HTMLDivElement|null>(null);
  const mode = campaign ? 'live' : 'sample';

  useEffect(() => {
    setLastSelected(storageGet(SELECTED_KEY));
    setReady(true);
    if (liveAvailable) void refreshCampaigns();
    return () => { listRequest.current += 1; };
    // The initial availability flag comes from server configuration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAvailable]);
  useEffect(() => { if (!lobby && turns.length) end.current?.scrollIntoView({behavior:'smooth',block:'end'}); }, [turns.length,phase,lobby]);
  useEffect(() => { if (resetConfirm) cancelReset.current?.focus(); }, [resetConfirm]);
  useEffect(() => { if (deleteConfirm) cancelDelete.current?.focus(); }, [deleteConfirm]);

  async function refreshCampaigns() {
    const request = ++listRequest.current;
    setListLoading(true); setListError('');
    try {
      const data = await api('/api/campaigns');
      if (request === listRequest.current) setCampaigns(data.campaigns);
    } catch {
      if (request === listRequest.current) setListError('Could not load the adventures. Try refreshing the list.');
    } finally { if (request === listRequest.current) setListLoading(false); }
  }
  function selectCampaign(data:CampaignData) {
    setCampaign(data.id); setLastSelected(data.id); setArchived(data.archived);
    setView(data.view); setTurns(data.turns); setTab('Story'); setInput(''); setNotice('');
    setResetConfirm(false); setDeleteConfirm(null); setLobby(false);
    storageSet(SELECTED_KEY,data.id);
    try {
      const saved = JSON.parse(storageGet(pendingKey(data.id)) ?? 'null');
      pending.current = saved?.campaign === data.id && typeof saved.id === 'string' && typeof saved.input === 'string' ? saved : null;
      if (pending.current) setInput(pending.current.input);
    } catch { pending.current=null; }
  }
  async function loadCampaign(id:string) {
    const data = await api(`/api/campaigns?id=${encodeURIComponent(id)}`);
    selectCampaign({...data,id});
  }
  function clearCampaign(id:string) {
    storageRemove(pendingKey(id)); storageRemove(resetKey(id));
    if (storageGet(SELECTED_KEY) === id) storageRemove(SELECTED_KEY);
    if (lastSelected === id) setLastSelected(null);
    if (pending.current?.campaign === id) pending.current=null;
    if (resetRequest.current?.campaign === id) resetRequest.current=null;
    if (campaign === id) {
      setCampaign(null); setArchived(false); setTurns([]); setInput(''); setNotice(''); setLobby(true);
      setView(playerView(newSample().world));
    }
    setResetConfirm(false); setDeleteConfirm(null);
  }
  function showLobby() {
    if (submitting.current) return;
    setLobby(true); setLobbyMessage(''); setResetConfirm(false); setDeleteConfirm(null);
    if (liveAvailable) void refreshCampaigns();
  }
  async function openCampaign(id:string) {
    if (submitting.current) return;
    submitting.current=true; setBusy(true); setLobbyMessage('');
    try { await loadCampaign(id); }
    catch (error) {
      if (missingCampaign((error as Error).message)) {
        clearCampaign(id); setLobbyMessage('That adventure was deleted. Choose another or start a new one.');
        await refreshCampaigns();
      } else setLobbyMessage('Could not open that adventure. Please try again.');
    } finally { submitting.current=false; setBusy(false); }
  }
  async function createCampaign(characterName=DEFAULT_NAME, worldPremise=DEFAULT_PREMISE) {
    if (submitting.current || !liveAvailable) return;
    submitting.current=true; setBusy(true); setLobbyMessage('');
    try {
      const data = await api('/api/campaigns',{name:characterName,premise:worldPremise});
      pending.current=null;
      selectCampaign({...data,archived:false,turns:[]});
    } catch (error) { setLobbyMessage(messages[(error as Error).message] ?? 'Could not start the adventure. Please try again.'); }
    finally { submitting.current=false; setBusy(false); }
  }
  async function deleteCampaign(id:string) {
    if (submitting.current || deleteConfirm !== id) return;
    submitting.current=true; setBusy(true); setLobbyMessage('');
    try {
      await api('/api/campaigns/delete',{campaignId:id});
      clearCampaign(id); setCampaigns(old=>old.filter(item=>item.id!==id));
      setLobbyMessage('Adventure deleted.');
      await refreshCampaigns();
    } catch (error) { setLobbyMessage(messages[(error as Error).message] ?? 'Could not delete that adventure. Please try again.'); }
    finally { submitting.current=false; setBusy(false); }
  }
  async function resetCampaign() {
    if (!campaign || submitting.current) return;
    submitting.current=true; setBusy(true); setLobbyMessage('');
    const source=campaign;
    try {
      if (resetRequest.current?.campaign !== source) resetRequest.current={campaign:source,id:storageGet(resetKey(source))??crypto.randomUUID()};
      storageSet(resetKey(source),resetRequest.current.id);
      const data=await api('/api/campaigns/reset',{campaignId:source,resetId:resetRequest.current.id});
      pending.current=null; storageRemove(pendingKey(source)); storageRemove(resetKey(source)); resetRequest.current=null;
      selectCampaign(data);
      setNotice('A fresh run is ready. The previous story is preserved in Adventures.');
    } catch (error) {
      const code=(error as Error).message;
      if (missingCampaign(code)) { clearCampaign(source); setLobbyMessage('That adventure was deleted. Start a new one or choose another.'); await refreshCampaigns(); }
      else setLobbyMessage(messages[code] ?? 'Could not reset this adventure. Try again; the same request will be resumed.');
    } finally { submitting.current=false; setBusy(false); }
  }
  async function finishNarration(id:string,campaignId:string) {
    setPhase('Writing the next passage…');
    try {
      const data=await api('/api/narration',{campaignId,turnId:id});
      setTurns(old=>old.map(turn=>turn.id===id?{...turn,narration:data.narration}:turn));
    } catch (error) {
      if (missingCampaign((error as Error).message)) {
        clearCampaign(campaignId); setLobbyMessage('That adventure was deleted. Choose another or start a new one.'); await refreshCampaigns();
      } else setNotice('Your choices are saved. The storyteller could not finish the passage; you can retry it below.');
    } finally { setPhase(''); }
  }
  async function retryNarration(id:string,campaignId:string) {
    if (submitting.current) return;
    submitting.current=true; setBusy(true);
    try { await finishNarration(id,campaignId); }
    finally { submitting.current=false; setBusy(false); }
  }
  function playSample(choice:SampleChoice) {
    if (campaign || submitting.current) return;
    setNotice('');
    const result=demoTurn(sample.world,choice,crypto.randomUUID());
    if (result.clarification) { setNotice(result.clarification); return; }
    const next={world:result.world,turns:[...sample.turns,result.turn!]};
    setSample(next); setView(playerView(next.world)); setTurns(next.turns);
  }
  async function submit(event:React.FormEvent) {
    event.preventDefault();
    const action=input.trim(); if (!campaign || !action || submitting.current || archived) return;
    const id=campaign;
    submitting.current=true; setBusy(true); setNotice(''); setPhase('Considering your action…');
    try {
      if (!pending.current || pending.current.input!==action || pending.current.campaign!==id) pending.current={id:crypto.randomUUID(),input:action,campaign:id};
      storageSet(pendingKey(id),JSON.stringify(pending.current));
      const data=await api('/api/turns',{campaignId:id,turnId:pending.current.id,revision:view.revision,input:action});
      if (data.clarification) { setNotice(data.clarification); pending.current=null; storageRemove(pendingKey(id)); return; }
      setInput(''); pending.current=null; storageRemove(pendingKey(id));
      if (data.view) setView(data.view);
      if (data.replayed) await loadCampaign(id);
      else setTurns(old=>[...old.filter(turn=>turn.id!==data.turn.id),data.turn]);
      if (!data.turn.narration) await finishNarration(data.turn.id,id);
    } catch (error) {
      const code=(error as Error).message;
      if (missingCampaign(code)) {
        clearCampaign(id); setLobbyMessage('That adventure was deleted. Choose another or start a new one.'); await refreshCampaigns();
      } else if (['STALE_REVISION','CAMPAIGN_ARCHIVED'].includes(code)) {
        pending.current=null; storageRemove(pendingKey(id));
        try { await loadCampaign(id); setInput(action); setNotice(messages[code]); }
        catch (loadError) {
          if (missingCampaign((loadError as Error).message)) { clearCampaign(id); setLobbyMessage('That adventure was deleted. Choose another or start a new one.'); await refreshCampaigns(); }
          else setNotice('The adventure changed, but its latest chapter could not be loaded. Open Adventures to reload it before trying again.');
        }
      } else if (proposalRejectionCodes.has(code)) {
        setNotice(`The AI’s response could not be applied consistently. Your world is unchanged, and your text is kept. You can try sending it again. Reference: ${code}.`);
      } else setNotice(messages[code] ?? 'That action could not be completed. Your text is kept; try again.');
    } finally { setBusy(false); submitting.current=false; setPhase(''); }
  }
  function openSample() {
    const fresh=newSample(); setSample(fresh); setCampaign(null); setArchived(false); setView(playerView(fresh.world)); setTurns([]);
    setTab('Story'); setNotice(''); setInput(''); setLobby(false); setResetConfirm(false); pending.current=null;
  }

  return <div className="app-shell">
    <header className="masthead"><a href="/" className="brand" aria-label="StoryQuest home"><Icon name="World"/><span>STORYQUEST</span></a><button className="account-button" onClick={showLobby} disabled={busy}>Adventures <Icon name="Story"/></button></header>
    {lobby ? <main className="adventure-lobby">
      <div className="page-heading"><div><p className="eyebrow">OPEN PLAYTEST · NO LOGIN</p><h1>A story is waiting.</h1><p className="subheading">Start a new adventure, or pick up a story already in motion.</p></div></div>
      <p className="shared-note">This is a shared playtest. Anyone can continue, reset, or delete these adventures. Progress saves automatically.</p>
      <section className="lobby-start" aria-labelledby="new-adventure-heading">
        <div><p className="eyebrow">THE SILENCE OF ASHFORD</p><h2 id="new-adventure-heading">Step into a living story</h2><p>Play as Rowan, a traveler arriving at a ruined town. Speak freely to the AI dungeon master and see where the story takes you.</p></div>
        <button className="primary" disabled={busy||!ready||!liveAvailable} onClick={()=>void createCampaign()}>{busy&&phase===''?'Please wait…':'Start a new adventure'}</button>
        <button className="text-button customize-toggle" aria-expanded={customize} aria-controls="custom-adventure" disabled={busy} onClick={()=>setCustomize(value=>!value)}>{customize?'Use the default character and world':'Customize character and world'}</button>
        {customize && <form id="custom-adventure" className="custom-adventure" onSubmit={event=>{event.preventDefault();void createCampaign(name.trim(),premise.trim());}}>
          <label htmlFor="name">Character name</label><input id="name" value={name} onChange={event=>setName(event.target.value)} required maxLength={50} disabled={busy}/>
          <label htmlFor="premise">Shape the world</label><textarea id="premise" value={premise} onChange={event=>setPremise(event.target.value)} required maxLength={1600} rows={4} disabled={busy}/>
          <p className="muted">The opening stays in Ashford. Your premise guides how the world develops.</p>
          <button className="primary" disabled={busy||!ready||!liveAvailable||!name.trim()||!premise.trim()}>Start customized adventure</button>
        </form>}
        {!liveAvailable && <p className="notice" role="status">AI adventures are currently unavailable. You can explore the scripted preview below.</p>}
      </section>
      {lobbyMessage && <p className="notice" role="status">{lobbyMessage}</p>}
      <section className="lobby-saved" aria-labelledby="saved-adventures-heading" aria-busy={listLoading}>
        <div className="lobby-section-heading"><h2 id="saved-adventures-heading">Adventures in motion</h2><button className="text-button" disabled={busy||listLoading||!liveAvailable} onClick={()=>void refreshCampaigns()}>Refresh list</button></div>
        {listLoading && <p className="muted" role="status">Loading adventures…</p>}
        {listError && <p className="notice" role="status">{listError}</p>}
        {!listLoading&&!listError&&campaigns.length===0&&liveAvailable && <p className="empty-adventures">No adventures yet. Start the first chapter above.</p>}
        <div className="adventure-cards">{campaigns.map(item=><article className="adventure-card" key={item.id} aria-label={`${item.character_name??'Traveler'} · ${item.title}`}>
          <div className="adventure-card-top"><span className={`badge ${item.archived_at?'completed':''}`}>{item.archived_at?'Previous run':'In motion'}</span>{lastSelected===item.id&&<span className="last-played">Last opened here</span>}</div>
          <h3>{item.title}</h3><p className="adventure-meta">{item.character_name??'Traveler'} · {item.revision} {item.revision===1?'turn':'turns'} · {new Date(item.updated_at??item.created_at).toLocaleDateString()}</p>
          <div className="adventure-card-actions"><button className="primary" disabled={busy} onClick={()=>void openCampaign(item.id)}>{item.archived_at?'View history':'Continue adventure'}</button><button className="text-button delete-link" disabled={busy} onClick={()=>{setDeleteConfirm(item.id);setResetConfirm(false);setLobbyMessage('');}}>Delete</button></div>
          {deleteConfirm===item.id&&<div className="delete-confirm" role="group" aria-label="Confirm adventure deletion"><h4>Delete this adventure?</h4><p>It will disappear for everyone. This cannot be undone.</p><div className="reset-actions"><button ref={cancelDelete} className="text-button" disabled={busy} onClick={()=>setDeleteConfirm(null)}>Keep adventure</button><button className="danger-button" disabled={busy} onClick={()=>void deleteCampaign(item.id)}>Delete adventure</button></div></div>}
        </article>)}</div>
      </section>
      {campaign&&!archived&&<section className="reset-panel" aria-label="Reset current adventure">{resetConfirm?<><h3>Start this adventure again?</h3><p>{view.character.name} and this world return to the beginning. The current run stays in Adventures as read-only history.</p><div className="reset-actions"><button ref={cancelReset} className="text-button" disabled={busy} onClick={()=>setResetConfirm(false)}>Keep playing</button><button className="primary" disabled={busy} onClick={()=>void resetCampaign()}>Confirm reset</button></div></>:<><h3>Start this run over</h3><p>Reset the currently open adventure: {view.title}, with {view.character.name}.</p><button className="text-button" disabled={busy} onClick={()=>{setResetConfirm(true);setDeleteConfirm(null);setLobbyMessage('');}}>Reset current adventure</button></>}</section>}
      <div className="preview-entry"><p>Just looking around?</p><button className="text-button" disabled={busy||!ready} onClick={openSample}>Explore scripted preview · No AI</button></div>
    </main> : <>
    <div className="page-heading"><div><p className="eyebrow">{mode==='sample'?'SCRIPTED PREVIEW · NO AI':archived?'A PREVIOUS ADVENTURE':'AI ADVENTURE · SHARED PLAYTEST'}</p><h1>{view.title}</h1><p className="subheading">{mode==='sample'?'Three prewritten scenes to explore the interface.':'Speak in your own words. The world remembers.'}</p></div><span className="save-indicator"><span/>{mode==='sample'?'Preview only':archived?'History preserved':busy?'Saving your next chapter…':'Saved automatically'}</span></div>
    {mode==='sample'?<section className="mode-notice" aria-label="Play mode"><div><h2>This is a scripted preview</h2><p>Its three choices play prewritten scenes. Open Adventures to start a real AI story with no login.</p></div><button className="primary" disabled={busy} onClick={showLobby}>Open adventures</button></section>:<p className="shared-story-note">{archived?'Shared playtest · Read-only history · This previous run is preserved.':'Shared playtest · Saved automatically · Anyone can continue this adventure.'}</p>}
    <nav className="bottom-nav" aria-label="Adventure navigation">{(['Story','Character','Journal','World'] as Tab[]).map(item=><button key={item} aria-current={tab===item?'page':undefined} onClick={()=>setTab(item)}><Icon name={item}/><span>{item}</span>{item==='Journal'&&view.quests.some(quest=>quest.status==='active')&&<i/>}</button>)}</nav>
    <div className="workspace"><main className="main-panel">
      <div className="chapter-bar"><span><span className="chapter-dot"/>{tab==='Story'?'CHAPTER I · THE ARRIVAL':tab.toUpperCase()}</span><span>{storyTime(view.minute)}</span></div>
      {tab==='Story' ? <>
        <div className="story-body">
          <div className="location-label"><Icon name="World"/>{view.character.location.toUpperCase()}</div>
          <article className="opening"><p className="dropcap">{OPENING.split('\n\n')[0]}</p>{OPENING.split('\n\n').slice(1).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</article>
          <div className="divider"><span/> <Icon name="spark"/> <span/></div>
          {turns.map(turn=><section className="turn" key={turn.id}>
            <div className="player-action"><span className="eyebrow">YOU</span><p>{turn.input}</p></div>
            <div className="changes"><span className="changes-label">{turn.interpretation}</span>{turn.changes.length>0&&<ul>{turn.changes.map((change,index)=><li key={index}>{change}</li>)}</ul>}</div>
            {turn.narration?<article className="narration">{turn.narration.split('\n\n').map((paragraph,index)=><p key={index}>{paragraph}</p>)}</article>:<div className="fallback"><p>The outcome above is part of your story.</p>{campaign&&<button className="text-button" disabled={busy} onClick={()=>void retryNarration(turn.id,campaign)}>Continue the narration</button>}</div>}
          </section>)}
          {phase&&<p className="pending" role="status"><span className="pulse"/>{phase}</p>}
          {notice&&<p className="notice" role="status">{notice}</p>}
          <div ref={end}/>
        </div>
        <div className="composer">{archived?<><p className="composer-title">This run is complete</p><p className="muted">This story and its discoveries are preserved. Open Adventures to continue a current run.</p><button className="primary" onClick={showLobby}>Open adventures</button></>:mode==='sample'?<><p className="composer-title">Choose a scripted scene</p><p className="muted">Select a preset to explore the preview. Custom dialogue belongs in an AI adventure.</p><div className="suggestions sample-choices">{suggestions.map(choice=><button disabled={busy||!ready} key={choice} onClick={()=>playSample(choice)}>{choice}<span>↗</span></button>)}</div></>:<><p className="composer-title">What do you do?</p>{turns.length===0&&<div className="suggestions">{suggestions.map(choice=><button disabled={busy} key={choice} onClick={()=>setInput(choice)}>{choice}<span>↗</span></button>)}</div>}
          <form onSubmit={submit}><label className="sr-only" htmlFor="action">Your action</label><textarea id="action" value={input} onChange={event=>setInput(event.target.value)} maxLength={2000} rows={3} placeholder="Speak, investigate, take a chance…" disabled={busy}/><button className="send" aria-label="Send action" disabled={busy||!input.trim()||!ready}><Icon name="send"/></button></form>
          <div className="composer-note"><span>AI adventure · Your own words, your next move.</span><span>{input.length}/2000</span></div></>}
        </div>
      </> : <div className="detail-body">
        {tab==='Character' && <><p className="eyebrow">YOUR CHARACTER</p><h2>{view.character.name}</h2><p className="detail-intro">A life shaped by the choices you make.</p><div className="stat-grid"><div><small>CONDITION</small><strong>{view.character.condition}</strong></div><div><small>LOCATION</small><strong>{view.character.location}</strong></div></div><h3>What you carry</h3>{view.character.possessions.map(x=><div className="list-row" key={x}><Icon name="Journal"/>{x}</div>)}<h3>Your story so far</h3>{view.facts.filter(f=>f.subjects.includes(view.playerId)).map(f=><p key={f.id}>{f.text}</p>)}<p className="muted">Your abilities, relationships, and discoveries grow through the story.</p></>}
        {tab==='Journal' && <><p className="eyebrow">THREADS TO FOLLOW</p><h2>Your journal</h2><p className="detail-intro">Questions worth asking. Things worth remembering.</p>{view.quests.map(q=><div className="quest-card" key={q.id}><span className={`badge ${q.status}`}>{q.status}</span><h3>{q.title}</h3><p>{q.description}</p></div>)}<h3>Discoveries</h3>{view.facts.map(f=><div className="fact" key={f.id}><span className="tiny-dot"/><p>{f.text}</p></div>)}<h3>What people say</h3>{view.claims.length ? view.claims.map(c=><blockquote key={c.id}><p>“{c.text}”</p><cite>{c.speaker} · Unverified account</cite></blockquote>) : <p className="muted">Conversations will find a place here.</p>}</>}
        {tab==='World' && <><p className="eyebrow">BEYOND THE PAGE</p><h2>The world you know</h2><p className="detail-intro">Only what you have encountered. There is always more.</p><h3>People & places</h3>{view.entities.filter(e=>['npc','location','faction'].includes(e.kind)).map(e=><div className="world-row" key={e.id}><div className="world-icon"><Icon name={e.kind==='npc'?'Character':'World'}/></div><div><strong>{e.name}</strong><small>{e.kind==='npc'?'Person':e.kind==='location'?'Place':'Faction'}</small></div></div>)}<h3>The rules of this world</h3>{view.rules.map(r=><div className="rule" key={r.id}><Icon name="spark"/><p>{r.text}</p></div>)}<p className="muted">Time passes when you act. Your world waits while you are away.</p></>}
      </div>}
    </main>
    <aside className="sidebar"><div className="sidebar-character"><div className="portrait-letter">{view.character.name.slice(0,1)}</div><p className="eyebrow">THE TRAVELER</p><h2>{view.character.name}</h2><p><span className="tiny-dot"/>{view.character.condition}</p><button className="text-button" onClick={()=>setTab('Character')}>View character <span>↗</span></button></div><div className="sidebar-quest"><p className="eyebrow">ON YOUR MIND</p><h3>{view.quests.find(q=>q.status==='active')?.title ?? 'The next chapter'}</h3><p>{view.quests.find(q=>q.status==='active')?.description ?? 'Keep exploring.'}</p><button className="text-button" onClick={()=>setTab('Journal')}>Open journal <span>↗</span></button></div><p className="aside-note">A world that remembers.<br/>A story that belongs to you.</p></aside></div>
    </>}
  </div>;
}
