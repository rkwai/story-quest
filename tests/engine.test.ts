import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorld } from '../src/engine/seed';
import { applyProposal, replay } from '../src/engine/reducer';
import { playerView, publicChanges } from '../src/engine/view';
import { buildContext } from '../src/engine/context';
import { demoTurn } from '../src/engine/demo';
import type { Proposal, Operation } from '../src/engine/types';
const action = (operations:Operation[], elapsedMinutes=5):Proposal => ({kind:'action',interpretation:'You investigate.',clarification:null,elapsedMinutes,operations});

test('a hidden culprit cannot leak through player view, changes, or a false claim',()=>{
 const before=seedWorld();
 const p=action([{op:'add_claim',claim:{id:'lie',speakerId:'mara',text:'The storm destroyed the town.',knownBy:['player']}}]);
 const after=applyProposal(before,p);
 assert.equal(after.facts.find(f=>f.id==='cause')?.text,before.facts.find(f=>f.id==='cause')?.text);
 const visible=JSON.stringify({view:playerView(after),changes:publicChanges(before,after)});
 assert.ok(!visible.includes('Hollow Choir'));
 assert.ok(!visible.includes('buried bell'));
 assert.match(visible,/claims/);
});
test('discovery changes knowledge without changing historical attribution',()=>{
 const before=seedWorld(); const fact=structuredClone(before.facts.find(f=>f.id==='cause')!);
 const after=applyProposal(before,action([{op:'discover_entity',id:'order',characterId:'player'},{op:'learn_fact',id:'cause',characterId:'player'}]));
 assert.equal(after.facts.find(f=>f.id==='cause')?.text,fact.text);
 assert.ok(playerView(after).facts.some(f=>f.id==='cause'));
 assert.ok(!playerView(before).facts.some(f=>f.id==='cause'));
});
test('canonical fact cannot be overwritten under another ID and a failed proposal is atomic',()=>{
 const before=seedWorld(), original=structuredClone(before);
 assert.throws(()=>applyProposal(before,action([
  {op:'update_entity',id:'player',field:'condition',value:'Hurt'},
  {op:'establish_fact',fact:{...before.facts[1],id:'replacement',text:'A storm destroyed Ashford.'}}
 ])),/ESTABLISHED_FACT/);
 assert.deepEqual(before,original);
});
test('a valid proposal replays identically without models',()=>{
 const seed=seedWorld(); const proposals=[action([{op:'learn_fact',id:'cause',characterId:'mara'}]),action([{op:'update_entity',id:'player',field:'condition',value:'Tired'}])];
 const a=replay(seed,proposals), b=replay(seed,proposals);
 assert.deepEqual(a,b); assert.equal(seed.revision,0); assert.equal(a.revision,2);
});
test('an item cannot be owned by a location or occupy two locations',()=>{
 const seed=seedWorld();
 assert.throws(()=>applyProposal(seed,action([{op:'update_entity',id:'journal',field:'ownerId',value:'ashford'}])),/INVALID_OWNER/);
 assert.throws(()=>applyProposal(seed,action([{op:'update_entity',id:'journal',field:'locationId',value:'ashford'}])),/ITEM_TWO_LOCATIONS/);
});
test('hidden NPC condition and descriptions do not leak on a known entity',()=>{
 const seed=seedWorld(); seed.entities.find(e=>e.id==='mara')!.condition='Secretly possessed by the Hollow Choir';
 assert.ok(!JSON.stringify(playerView(seed)).includes('possessed'));
});
test('time cannot pass a commitment without an outcome',()=>{
 assert.throws(()=>applyProposal(seedWorld(),action([],600)),/UNRESOLVED_DEADLINE/);
 const result=demoTurn(seedWorld(),'Wait until dusk','wait');
 assert.equal(result.world.minute,1080); assert.equal(result.world.scheduled[0].resolved,true);
});
test('clarification is a no-op and cannot smuggle mutations',()=>{
 const before=seedWorld();
 assert.deepEqual(applyProposal(before,{kind:'clarification',interpretation:'Clarify.',clarification:'Which person?',elapsedMinutes:0,operations:[]}),before);
 assert.throws(()=>applyProposal(before,{kind:'clarification',interpretation:'Clarify.',clarification:'Which?',elapsedMinutes:10,operations:[]}),/INVALID_CLARIFICATION/);
});
test('mandatory context retains secret local cause and pending deadlines but fails closed on overflow',()=>{
 const c=buildContext(seedWorld(),'Investigate the ruins');
 assert.ok(c.manifest.factIds.includes('cause')); assert.equal(c.state.scheduled[0].id,'dusk');
 assert.throws(()=>buildContext(seedWorld(),'Look',30),/CONTEXT_BUDGET_EXCEEDED/);
});
test('all sample branches produce consistent persistent outcomes',()=>{
 let world=seedWorld();
 for (const [i,input] of ['Ask the woman what happened','Examine the bell tower','Wait until dusk'].entries()) {
  const result=demoTurn(world,input,String(i)); assert.ok(result.turn); world=result.world;
 }
 assert.equal(world.entities.find(e=>e.id==='mara')?.locationId,'tower');
 assert.equal(world.revision,3); assert.equal(world.claims.length,1); assert.equal(world.scheduled[0].resolved,true);
 assert.ok(!JSON.stringify(playerView(world)).includes('Hollow Choir'));
});
