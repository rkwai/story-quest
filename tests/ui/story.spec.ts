import { test, expect, type Page } from '@playwright/test';
import { seedWorld } from '../../src/engine/seed';
import { playerView } from '../../src/engine/view';
import type { PlayerView, PublicTurn } from '../../src/engine/types';

const campaignId='6214df3c-cc60-4dde-b113-824415b28c30';
const legacyLead={id:'old-lead',questId:'woman-purpose',text:'OLD GENERATED SUGGESTION: ask about her arrival.',action:'OLD GENERATED ACTION: ask what brought her here.',entityIds:['mara']};
const storyView=():PlayerView=>({...playerView(seedWorld()),quests:[
  {id:'world-question',title:'The old promises',description:'Learn why old promises shape this world.',status:'active',scope:'world',parentId:null,objective:'Understand the promises.',stakes:'Their consequences reach beyond Ashford.'},
  {id:'woman-purpose',title:'Why she waits',description:'The woman may have a reason to remain here.',status:'active',scope:'immediate',parentId:'world-question',objective:'Find out why the woman is waiting at the arch.',stakes:'Her account could offer a first direction.'},
],story:{focusQuestId:'woman-purpose',quietTurns:2}});
// Older public responses can still contain suggestion fields during a deployment
// or in recorded fixtures. The UI must ignore them rather than prepare actions.
const legacyView=()=>{
  const view=storyView();
  return {...view,story:{...view.story!,leads:[legacyLead]},quests:view.quests.map(quest=>({...quest,leads:[legacyLead]}))};
};

async function mockAdventure(page:Page,view=storyView(),options:{archived?:boolean;turns?:PublicTurn[]}={}) {
  const state={view,turns:options.turns??[]};
  await page.route('**/api/campaigns**',async route=>{
    const url=new URL(route.request().url());
    await route.fulfill({json:url.searchParams.has('id')?{id:campaignId,...state,archived:!!options.archived}:{campaigns:[{id:campaignId,title:view.title,character_name:view.character.name,revision:state.view.revision,created_at:'2026-09-26T00:00:00Z',updated_at:'2026-09-26T00:00:00Z',archived_at:options.archived?'2026-09-26T00:00:00Z':null}]}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:options.archived?'View history':'Continue adventure',exact:true}).click();
  return state;
}

async function expectNoGeneratedSuggestions(page:Page) {
  await expect(page.getByText(legacyLead.text,{exact:true})).toHaveCount(0);
  await expect(page.getByText(legacyLead.action,{exact:true})).toHaveCount(0);
  await expect(page.locator('.story-guidance,.story-leads,.quest-leads')).toHaveCount(0);
  await expect(page.getByText('Known leads',{exact:true})).toHaveCount(0);
}

test('live play uses freeform input and ignores legacy generated suggestions before and after reload',async({page})=>{
  const state=await mockAdventure(page,legacyView());
  const requests:{input:string;itemId?:string;turnId:string}[]=[];
  await page.route('**/api/turns',async route=>{
    const request=route.request().postDataJSON();requests.push(request);
    state.view={...state.view,revision:1};
    const turn:PublicTurn={id:request.turnId,input:request.input,interpretation:'You ask why she is here.',changes:[],narration:'She considers your question.',revision:1};
    state.turns.push(turn);
    await route.fulfill({json:{view:state.view,turn}});
  });
  await expectNoGeneratedSuggestions(page);
  await expect(page.locator('.composer .suggestions')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue('');
  expect(requests).toHaveLength(0);
  const action='I ask the woman why she came here, and whether she is waiting for someone.';
  await page.getByRole('textbox',{name:'Your action'}).fill(action);
  await page.getByRole('button',{name:'Send action'}).click();
  await expect(page.getByText('She considers your question.')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].input).toBe(action);
  expect(requests[0].itemId).toBeUndefined();
  await expectNoGeneratedSuggestions(page);
  await page.reload();
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  await expectNoGeneratedSuggestions(page);
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue('');
});

test('story follows the input with newest passages first and no visible chronology headings',async({page})=>{
  const turns:PublicTurn[]=[1,2,3].map(revision=>({id:`turn-${revision}`,revision,input:`My action ${revision}.`,interpretation:`Recorded outcome ${revision}.`,changes:[`Lead available: ${legacyLead.text}`,`The world changed in turn ${revision}.`],narration:revision===1?null:revision===2?Array(12).fill('Rain runs along the stone road.').join('\n\n'):'The latest passage remains fully readable.'}));
  await mockAdventure(page,{...legacyView(),revision:3},{turns});
  await expect(page.getByRole('region',{name:'Latest interaction',exact:true})).toContainText('My action 3.');
  await expect(page.getByText('Latest interaction',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Past story',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Newest first. Scroll to revisit earlier moments.',{exact:true})).toHaveCount(0);
  await expect(page.getByText('THE BEGINNING',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Turn 3',{exact:true})).toHaveCount(0);
  await expect(page.getByText(`Lead available: ${legacyLead.text}`,{exact:true})).toHaveCount(0);
  await expect(page.getByText('The world changed in turn 3.',{exact:true})).toBeVisible();
  const position=await page.evaluate(()=>({input:document.querySelector('.composer form')!.getBoundingClientRect().top,story:document.querySelector('.latest-interaction')!.getBoundingClientRect().top}));
  expect(position.input).toBeLessThan(position.story);
  const history=page.getByRole('region',{name:'Past interactions, newest first'});
  await expect(history.locator(':scope>.turn')).toHaveCount(2);
  await expect(history.locator(':scope>.turn').first()).toContainText('My action 2.');
  await expect(history.locator(':scope>.turn').last()).toContainText('My action 1.');
  const size=await history.evaluate(element=>({height:element.clientHeight,scroll:element.scrollHeight}));
  expect(size.scroll).toBeGreaterThan(size.height);
  await history.focus();
  await page.keyboard.press('PageDown');
  await expect.poll(()=>history.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
  const retries:unknown[]=[];
  await page.route('**/api/narration',async route=>{retries.push(route.request().postDataJSON());await route.fulfill({json:{narration:'An earlier passage restored.'}});});
  await history.getByRole('button',{name:'Continue the narration'}).click();
  await expect(history.getByRole('region',{name:'Interaction 1',exact:true})).toContainText('An earlier passage restored.');
  expect(retries).toEqual([{campaignId,turnId:'turn-1'}]);
  await expect(page.locator('.latest-interaction')).toContainText('The latest passage remains fully readable.');
  await page.locator('.composer').scrollIntoViewIfNeeded();
  await page.screenshot({path:test.info().outputPath('phone-freeform-story.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('archived runs hide generated suggestions while the offline preview retains its scripted controls',async({page})=>{
  await mockAdventure(page,legacyView(),{archived:true});
  await expectNoGeneratedSuggestions(page);
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveCount(0);
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  await expectNoGeneratedSuggestions(page);
  await expect(page.getByRole('article',{name:'Why she waits',exact:true})).toContainText('Find out why the woman is waiting at the arch.');
  await page.getByRole('button',{name:'Adventures',exact:true}).click();
  await page.getByRole('button',{name:'Explore scripted preview · No AI',exact:true}).click();
  await expect(page.getByRole('region',{name:'Play mode'})).toContainText('scripted preview');
  await expect(page.locator('.sample-choices').getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveCount(0);
  await expectNoGeneratedSuggestions(page);
});

test('journal retains public objectives, stakes and quest hierarchy without generated lead lists',async({page})=>{
  const view:PlayerView=legacyView();
  view.quests.push(
    {id:'arc',title:'An account recovered',description:'This chapter is finished.',status:'completed',scope:'arc',objective:'Record the account.',stakes:'Remember what was said.'},
    {id:'local',title:'The extremely long name of a local mystery with a detailed history that should wrap on a phone',description:'A local thread has ended.',status:'failed',scope:'local',parentId:'unseen-parent',objective:'Learn what happened near the arch.'},
  );
  await mockAdventure(page,view);
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  const immediate=page.getByRole('article',{name:'Why she waits',exact:true});
  await expect(immediate).toContainText('Immediate');
  await expect(immediate).toContainText('Part of: The old promises');
  await expect(immediate).toContainText('Objective');
  await expect(immediate).toContainText('Find out why the woman is waiting at the arch.');
  await expect(immediate).toContainText('Why it matters');
  await expect(immediate).toContainText('Her account could offer a first direction.');
  await expect(page.getByRole('article',{name:'The old promises',exact:true})).toContainText('World');
  await expect(page.getByRole('article',{name:'An account recovered',exact:true})).toContainText('completed');
  await expect(page.getByRole('article',{name:'An account recovered',exact:true})).toContainText('Major');
  const local=page.getByRole('article',{name:/The extremely long name/});
  await expect(local).toContainText('Local');
  await expect(local).not.toContainText('Part of:');
  await expect(page.getByText('unseen-parent')).toHaveCount(0);
  await expectNoGeneratedSuggestions(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('phone-quest-journal.png'),fullPage:true});
  await page.setViewportSize({width:1200,height:900});
  await expect(page.locator('.sidebar-quest')).toContainText('Why she waits');
  await expect(page.locator('.sidebar-quest')).toContainText('Find out why the woman is waiting at the arch.');
});

test('empty quests and old projections keep freeform input without live starter prompts',async({page})=>{
  await mockAdventure(page,{...storyView(),quests:[],story:{focusQuestId:null,quietTurns:0}});
  await expect(page.locator('.composer .suggestions')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeVisible();
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  await expect(page.getByText('No quests yet. The people you meet and choices you make can open new threads.')).toBeVisible();
  await expect(page.locator('.quest-card')).toHaveCount(0);
  await mockAdventure(page,{...storyView(),story:undefined,quests:[{id:'old-quest',title:'A previous thread',description:'A question already recorded.',status:'active'}]});
  await expect(page.locator('.composer .suggestions')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Ask the woman what happened'})).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeVisible();
});
