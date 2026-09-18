'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { demoTurn, newSample, OPENING, suggestions } from '@/engine/demo';
import { playerView } from '@/engine/view';
import { worldSchema, publicTurnSchema, type PlayerView, type PublicTurn } from '@/engine/types';
import { publicSupabaseConfig } from '@/lib/supabase-public';

type Tab = 'Story' | 'Character' | 'Journal' | 'World';
const SAMPLE_KEY = 'storyquest.sample.v2';
const campaignKey = (user: string) => `storyquest.campaign.${user}`;
const resetKey = (id: string) => `storyquest.reset.${id}`;
const messages: Record<string,string> = {
  MODEL_UNAVAILABLE: 'The storyteller is taking a moment. Your action has not been applied. Please try again.',
  MODEL_INCOMPLETE: 'The storyteller could not finish that turn. Your world is unchanged.',
  MODEL_INVALID_OUTPUT: 'That turn could not be resolved consistently. Your world is unchanged. Try again or rephrase.',
  STALE_REVISION: 'Your adventure advanced in another window. Reloading its latest chapter; review it before trying again.',
  TURN_BUSY: 'Another turn is still being resolved. Please wait a moment.',
  CAMPAIGN_ARCHIVED: 'This run was reset in another window. Its history is saved; open Your adventures to continue the new run.',
  CAMPAIGN_LIMIT: 'You have five active adventures. Reset one to start it again.',
  RATE_LIMIT: 'Give your last action a moment to settle, then try again.', DAILY_LIMIT: 'You have reached today’s adventure limit. Your story is safely saved.',
  NOT_CONFIGURED: 'Live adventures are not available yet. You can explore the sample.',
  UNAUTHORIZED: 'Please sign in again to continue your adventure.',
  CONTEXT_BUDGET_EXCEEDED: 'This scene has become too complex to resolve safely. Your world is unchanged.',
  NARRATION_LIMIT: 'The outcome is saved. The story text could not be completed for this turn.',
};
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
  const [sample, setSample] = useState(newSample);
  const [view, setView] = useState<PlayerView>(() => playerView(newSample().world));
  const [turns, setTurns] = useState<PublicTurn[]>([]);
  const [tab,setTab] = useState<Tab>('Story');
  const [input,setInput] = useState('');
  const [busy,setBusy] = useState(false);
  const [phase,setPhase] = useState('');
  const [notice,setNotice] = useState('');
  const [ready,setReady] = useState(false);
  const [account,setAccount] = useState(false);
  const [session,setSession] = useState<Session|null>(null);
  const [campaign,setCampaign] = useState<string|null>(null);
  const [archived,setArchived] = useState(false);
  const [resetConfirm,setResetConfirm] = useState(false);
  const [email,setEmail] = useState('');
  const [name,setName] = useState('Rowan');
  const [premise,setPremise] = useState('A quiet fantasy world where old promises carry weight. I arrive at the ruined town of Ashford looking for answers.');
  const [campaigns,setCampaigns] = useState<{id:string;title:string;revision:number;created_at:string;archived_at:string|null}[]>([]);
  const [authMessage,setAuthMessage] = useState('');
  const client = useRef<SupabaseClient|null>(null);
  const submitting = useRef(false);
  const pending = useRef<{id:string;input:string;campaign:string}|null>(null);
  const resetRequest = useRef<{id:string;campaign:string}|null>(null);
  const cancelReset = useRef<HTMLButtonElement|null>(null);
  const end = useRef<HTMLDivElement|null>(null);
  const modal = useRef<HTMLElement|null>(null);
  const mode = campaign ? 'live' : 'sample';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAMPLE_KEY);
      if (saved) {
        const raw = JSON.parse(saved);
        const parsed = { world: worldSchema.parse(raw.world), turns: publicTurnSchema.array().max(10).parse(raw.turns) };
        const projected = playerView(parsed.world);
        setSample(parsed); setView(projected); setTurns(parsed.turns);
      }
    } catch { setNotice('Your saved sample could not be restored. A fresh sample is ready.'); }
    setReady(true);
    if (liveAvailable) {
      const { url, key } = publicSupabaseConfig();
      if (!url || !key) { setNotice('Live adventures are not available yet. You can explore the sample.'); return; }
      const supabase = createClient(url, key);
      client.current = supabase;
      supabase.auth.getSession().then(({data}) => setSession(data.session));
      const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
      return () => data.subscription.unsubscribe();
    }
  }, [liveAvailable]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(SAMPLE_KEY, JSON.stringify(sample)); } catch { setNotice('This browser cannot save the sample. Keep this page open to retain progress.'); }
  }, [sample,ready]);
  useEffect(() => {
    if (!session) return;
    const id = localStorage.getItem(campaignKey(session.user.id));
    if (id) loadCampaign(id).catch(() => setNotice('We could not restore your adventure. Open Your adventures to try again.'));
    // Fetch account data when a new identity signs in, not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);
  useEffect(() => { if (turns.length) end.current?.scrollIntoView({ behavior:'smooth',block:'end' }); }, [turns.length,phase]);
  useEffect(() => { if (resetConfirm) cancelReset.current?.focus(); }, [resetConfirm]);

  useEffect(() => {
    if (!account) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, a[href]') ?? []);
    focusable()[0]?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setAccount(false);
      if (e.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items[items.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [account, busy]);

  async function api(path:string, body?:unknown) {
    const { data } = await client.current!.auth.getSession();
    if (!data.session) throw new Error('UNAUTHORIZED');
    const r = await fetch(path, { method: body ? 'POST':'GET', headers:{ Authorization:`Bearer ${data.session.access_token}`, ...(body ? {'Content-Type':'application/json'}:{}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
    const payload = await r.json();
    if (!r.ok) throw new Error(payload.error ?? 'REQUEST_FAILED');
    return payload;
  }
  async function loadCampaign(id:string) {
    const data = await api(`/api/campaigns?id=${id}`);
    setCampaign(id); setArchived(data.archived); setView(data.view); setTurns(data.turns); setTab('Story');
    if (session) localStorage.setItem(campaignKey(session.user.id), id);
    try { pending.current = JSON.parse(localStorage.getItem(`storyquest.pending.${id}`) ?? 'null'); } catch { pending.current = null; }
  }
  async function showAccount() {
    setAccount(true); setAuthMessage(''); setResetConfirm(false);
    if (session) try { const data = await api('/api/campaigns'); setCampaigns(data.campaigns); } catch { setAuthMessage('Could not load your adventures. Try again.'); }
  }
  async function createCampaign(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setAuthMessage('');
    try {
      const data = await api('/api/campaigns', { name, premise });
      setCampaign(data.id); setArchived(false); setView(data.view); setTurns([]); setTab('Story'); setInput(''); setNotice(''); setAccount(false); pending.current=null;
      localStorage.setItem(campaignKey(session!.user.id),data.id);
    } catch (e) { setAuthMessage(messages[(e as Error).message] ?? 'Could not start the adventure. Please try again.'); }
    finally { setBusy(false); }
  }
  async function resetCampaign() {
    if (!campaign || !session || submitting.current) return;
    submitting.current=true; setBusy(true); setAuthMessage('');
    const source=campaign;
    try {
      // Keep the same request ID after a lost response, including a page reload.
      if (resetRequest.current?.campaign !== source) {
        let saved:string|null=null;
        try { saved=localStorage.getItem(resetKey(source)); } catch { /* The in-memory ID still protects retries. */ }
        resetRequest.current={campaign:source,id:saved??crypto.randomUUID()};
      }
      try { localStorage.setItem(resetKey(source),resetRequest.current.id); } catch { /* Storage is optional. */ }
      const data=await api('/api/campaigns/reset',{campaignId:source,resetId:resetRequest.current.id});
      setCampaign(data.id); setArchived(data.archived); setView(data.view); setTurns(data.turns); setTab('Story'); setInput('');
      setNotice('A fresh run is ready. Your previous adventure is saved in Your adventures.');
      pending.current=null; setResetConfirm(false); setAccount(false);
      try { localStorage.setItem(campaignKey(session.user.id),data.id); localStorage.removeItem(resetKey(source)); } catch { /* Server save is authoritative. */ }
      resetRequest.current=null;
    } catch (e) { setAuthMessage(messages[(e as Error).message] ?? 'Could not reset this adventure. Try again; the same request will be resumed.'); }
    finally { setBusy(false); submitting.current=false; }
  }
  async function finishNarration(id:string, campaignId:string) {
    setPhase('Writing the next passage…');
    try {
      const data = await api('/api/narration', {campaignId,turnId:id});
      setTurns(old => old.map(t => t.id === id ? {...t,narration:data.narration} : t));
    } catch { setNotice('Your choices are saved. The storyteller could not finish the passage; you can retry it below.'); }
    finally { setPhase(''); }
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault();
    const action = input.trim(); if (!action || submitting.current || archived) return;
    submitting.current=true; setBusy(true); setNotice(''); setPhase('Considering your action…');
    try {
      if (mode === 'sample') {
        const result = demoTurn(sample.world,action,crypto.randomUUID());
        if (result.clarification) { setNotice(result.clarification); return; }
        const next = {world:result.world,turns:[...sample.turns,result.turn!]};
        setSample(next); setView(playerView(next.world)); setTurns(next.turns); setInput('');
      } else {
        if (!pending.current || pending.current.input !== action || pending.current.campaign !== campaign) pending.current={id:crypto.randomUUID(),input:action,campaign:campaign!};
        localStorage.setItem(`storyquest.pending.${campaign}`,JSON.stringify(pending.current));
        const data = await api('/api/turns', {campaignId:campaign,turnId:pending.current.id,revision:view.revision,input:action});
        if (data.clarification) { setNotice(data.clarification); pending.current=null; localStorage.removeItem(`storyquest.pending.${campaign}`); return; }
        setInput('');
        if (data.view) setView(data.view);
        if (data.replayed) await loadCampaign(campaign!);
        else setTurns(old => [...old.filter(t=>t.id!==data.turn.id),data.turn]);
        pending.current=null; localStorage.removeItem(`storyquest.pending.${campaign}`);
        if (!data.turn.narration) await finishNarration(data.turn.id,campaign!);
      }
    } catch (e) {
      const code=(e as Error).message;
      setNotice(messages[code] ?? 'That action could not be completed. Your text is kept; try again.');
      if (['STALE_REVISION','CAMPAIGN_ARCHIVED'].includes(code) && campaign) await loadCampaign(campaign).catch(()=>undefined);
    } finally { setBusy(false); submitting.current=false; setPhase(''); }
  }
  function resetSample() {
    const fresh=newSample(); setSample(fresh); setCampaign(null); setArchived(false); setView(playerView(fresh.world)); setTurns([]); setTab('Story'); setNotice(''); setInput(''); setAccount(false); setResetConfirm(false); pending.current=null;
    if (session) localStorage.removeItem(campaignKey(session.user.id));
  }

  return <div className="app-shell">
    <header className="masthead"><a href="/" className="brand" aria-label="StoryQuest home"><Icon name="World"/><span>STORYQUEST</span></a><button className="account-button" onClick={showAccount} disabled={busy}>Your adventures <span className="avatar">{view.character.name.slice(0,1)}</span></button></header>
    <div className="page-heading"><div><p className="eyebrow">{mode==='sample'?'A SAMPLE ADVENTURE':archived?'A PREVIOUS ADVENTURE':'YOUR LIVING STORY'}</p><h1>{view.title}</h1><p className="subheading">Some stories are waiting to be found. This one is yours to unfold.</p></div><span className="save-indicator"><span/>{mode==='sample'?'Saved on this device':archived?'History preserved':'Your story is saved'}</span></div>
    <nav className="bottom-nav" aria-label="Adventure navigation">{(['Story','Character','Journal','World'] as Tab[]).map(t=><button key={t} aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}><Icon name={t}/><span>{t}</span>{t==='Journal'&&view.quests.some(q=>q.status==='active')&&<i/>}</button>)}</nav>
    <div className="workspace"><main className="main-panel">
      <div className="chapter-bar"><span><span className="chapter-dot"/>{tab==='Story'?'CHAPTER I · THE ARRIVAL':tab.toUpperCase()}</span><span>{storyTime(view.minute)}</span></div>
      {tab==='Story' ? <>
        <div className="story-body">
          <div className="location-label"><Icon name="World"/>{view.character.location.toUpperCase()}</div>
          <article className="opening"><p className="dropcap">{OPENING.split('\n\n')[0]}</p>{OPENING.split('\n\n').slice(1).map((p,i)=><p key={i}>{p}</p>)}</article>
          <div className="divider"><span/> <Icon name="spark"/> <span/></div>
          {turns.map(turn=><section className="turn" key={turn.id}>
            <div className="player-action"><span className="eyebrow">YOU</span><p>{turn.input}</p></div>
            <div className="changes"><span className="changes-label">{turn.interpretation}</span>{turn.changes.length>0 && <ul>{turn.changes.map((c,i)=><li key={i}>{c}</li>)}</ul>}</div>
            {turn.narration ? <article className="narration">{turn.narration.split('\n\n').map((p,i)=><p key={i}>{p}</p>)}</article> : <div className="fallback"><p>The outcome above is part of your story.</p>{campaign && <button className="text-button" disabled={busy} onClick={async()=>{setBusy(true);await finishNarration(turn.id,campaign);setBusy(false);}}>Continue the narration</button>}</div>}
          </section>)}
          {phase && <p className="pending" role="status"><span className="pulse"/>{phase}</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          <div ref={end}/>
        </div>
        <div className="composer">{archived ? <><p className="composer-title">This run is complete</p><p className="muted">Your story and discoveries are preserved. Open Your adventures to continue your latest run.</p><button className="primary" onClick={showAccount}>Your adventures</button></> : <><p className="composer-title">What do you do?</p>{turns.length===0 && <div className="suggestions">{suggestions.map(s=><button disabled={busy} key={s} onClick={()=>setInput(s)}>{s}<span>↗</span></button>)}</div>}
          <form onSubmit={submit}><label className="sr-only" htmlFor="action">Your action</label><textarea id="action" value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} rows={3} placeholder="Speak, investigate, take a chance…" disabled={busy}/><button className="send" aria-label="Send action" disabled={busy||!input.trim()||!ready}><Icon name="send"/></button></form>
          <div className="composer-note"><span>{mode==='sample'?'Scripted sample · 3 moments to explore':'Your words shape what happens next.'}</span><span>{input.length}/2000</span></div></>}
        </div>
      </> : <div className="detail-body">
        {tab==='Character' && <><p className="eyebrow">YOUR CHARACTER</p><h2>{view.character.name}</h2><p className="detail-intro">A life shaped by the choices you make.</p><div className="stat-grid"><div><small>CONDITION</small><strong>{view.character.condition}</strong></div><div><small>LOCATION</small><strong>{view.character.location}</strong></div></div><h3>What you carry</h3>{view.character.possessions.map(x=><div className="list-row" key={x}><Icon name="Journal"/>{x}</div>)}<h3>Your story so far</h3>{view.facts.filter(f=>f.subjects.includes(view.playerId)).map(f=><p key={f.id}>{f.text}</p>)}<p className="muted">Your abilities, relationships, and discoveries grow through the story.</p></>}
        {tab==='Journal' && <><p className="eyebrow">THREADS TO FOLLOW</p><h2>Your journal</h2><p className="detail-intro">Questions worth asking. Things worth remembering.</p>{view.quests.map(q=><div className="quest-card" key={q.id}><span className={`badge ${q.status}`}>{q.status}</span><h3>{q.title}</h3><p>{q.description}</p></div>)}<h3>Discoveries</h3>{view.facts.map(f=><div className="fact" key={f.id}><span className="tiny-dot"/><p>{f.text}</p></div>)}<h3>What people say</h3>{view.claims.length ? view.claims.map(c=><blockquote key={c.id}><p>“{c.text}”</p><cite>{c.speaker} · Unverified account</cite></blockquote>) : <p className="muted">Conversations will find a place here.</p>}</>}
        {tab==='World' && <><p className="eyebrow">BEYOND THE PAGE</p><h2>The world you know</h2><p className="detail-intro">Only what you have encountered. There is always more.</p><h3>People & places</h3>{view.entities.filter(e=>['npc','location','faction'].includes(e.kind)).map(e=><div className="world-row" key={e.id}><div className="world-icon"><Icon name={e.kind==='npc'?'Character':'World'}/></div><div><strong>{e.name}</strong><small>{e.kind==='npc'?'Person':e.kind==='location'?'Place':'Faction'}</small></div></div>)}<h3>The rules of this world</h3>{view.rules.map(r=><div className="rule" key={r.id}><Icon name="spark"/><p>{r.text}</p></div>)}<p className="muted">Time passes when you act. Your world waits while you are away.</p></>}
      </div>}
    </main>
    <aside className="sidebar"><div className="sidebar-character"><div className="portrait-letter">{view.character.name.slice(0,1)}</div><p className="eyebrow">THE TRAVELER</p><h2>{view.character.name}</h2><p><span className="tiny-dot"/>{view.character.condition}</p><button className="text-button" onClick={()=>setTab('Character')}>View character <span>↗</span></button></div><div className="sidebar-quest"><p className="eyebrow">ON YOUR MIND</p><h3>{view.quests.find(q=>q.status==='active')?.title ?? 'The next chapter'}</h3><p>{view.quests.find(q=>q.status==='active')?.description ?? 'Keep exploring.'}</p><button className="text-button" onClick={()=>setTab('Journal')}>Open journal <span>↗</span></button></div><p className="aside-note">A world that remembers.<br/>A story that belongs to you.</p></aside></div>

    {account && <div className="modal-scrim" onClick={()=>!busy&&setAccount(false)}><section ref={modal} className="account-modal" role="dialog" aria-modal="true" aria-label="Your adventures" onClick={e=>e.stopPropagation()}><button className="close" aria-label="Close" disabled={busy} onClick={()=>setAccount(false)}><Icon name="close"/></button><p className="eyebrow">STORIES TO RETURN TO</p><h2>Your adventures</h2>
      {!liveAvailable ? <p>Live adventures are not available yet. Explore the sample to get a feel for your story.</p> : !session ? <form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const {error}=await client.current!.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});setAuthMessage(error?'Could not send a sign-in link. Please try again.':'Check your email for a sign-in link.');}finally{setBusy(false);}}}><p>Sign in to keep your adventures and continue from any device.</p><label htmlFor="email">Email</label><input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><button className="primary" disabled={busy}>Send sign-in link</button></form> : <>
      <div className="campaign-list">{campaigns.map(c=><button disabled={busy} key={c.id} onClick={async()=>{setBusy(true);try{await loadCampaign(c.id);setAccount(false);}catch{setAuthMessage('Could not open this adventure.');}finally{setBusy(false);}}}>{c.title}<span>{c.archived_at?'Previous run · View history':'Continue'} · {c.revision} {c.revision===1?'turn':'turns'} · {new Date(c.created_at).toLocaleDateString()} ↗</span></button>)}</div>
      {campaign && !archived && <section className="reset-panel" aria-label="Reset current adventure">{resetConfirm ? <><h3>Start this adventure again?</h3><p>Your character and world return to the beginning. Your account stays signed in, and this run’s story remains available in Your adventures.</p><div className="reset-actions"><button ref={cancelReset} className="text-button" disabled={busy} onClick={()=>setResetConfirm(false)}>Keep playing</button><button className="primary" disabled={busy} onClick={resetCampaign}>{busy?'Resetting…':'Confirm reset'}</button></div></> : <><h3>A fresh start</h3><p>Return to the beginning with the same character and world.</p><button className="text-button" disabled={busy} onClick={()=>{setAuthMessage('');setResetConfirm(true);}}>Reset current adventure</button></>}</section>}
      <form onSubmit={createCampaign}><h3>Begin at Ashford</h3><label htmlFor="name">Character name</label><input id="name" value={name} onChange={e=>setName(e.target.value)} required maxLength={50}/><label htmlFor="premise">Shape the world</label><textarea id="premise" value={premise} onChange={e=>setPremise(e.target.value)} required maxLength={1600} rows={4}/><button className="primary" disabled={busy}>Begin adventure</button></form><button className="text-button" disabled={busy} onClick={async()=>{await client.current?.auth.signOut();setSession(null);setCampaigns([]);resetSample();}}>Sign out</button></>}
      {authMessage&&<p role="status" className="notice">{authMessage}</p>}<button className="text-button sample-reset" disabled={busy} onClick={resetSample}>Start a fresh sample</button>
    </section></div>}
  </div>;
}
