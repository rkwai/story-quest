import { test, expect, type Page } from '@playwright/test';
import { seedWorld } from '../../src/engine/seed';
import { playerView } from '../../src/engine/view';
import type { PlayerView, PublicLead, PublicTurn } from '../../src/engine/types';

const campaignId='6214df3c-cc60-4dde-b113-824415b28c30';
const lead:PublicLead={id:'mara-purpose',questId:'woman-purpose',text:'Ask the woman why she came to Ashford.',action:'I ask the woman what brought her to Ashford.',entityIds:['mara']};
const nextLead:PublicLead={id:'look-tower',questId:'woman-purpose',text:'Look for a way into the surviving tower.',action:'I look for an entrance to the surviving tower.',entityIds:['tower']};
const storyView=():PlayerView=>({...playerView(seedWorld()),quests:[
  {id:'world-question',title:'The old promises',description:'Learn why old promises shape this world.',status:'active',scope:'world',parentId:null,objective:'Understand the promises.',stakes:'Their consequences reach beyond Ashford.',leads:[]},
  {id:'woman-purpose',title:'Why she waits',description:'The woman may have a reason to remain here.',status:'active',scope:'immediate',parentId:'world-question',objective:'Find out why the woman is waiting at the arch.',stakes:'Her account could offer a first direction.',leads:[lead]},
],story:{focusQuestId:'woman-purpose',quietTurns:2,leads:[lead]}});

async function mockAdventure(page:Page,view=storyView(),archived=false) {
  const state={view,turns:[] as PublicTurn[]};
  await page.route('**/api/campaigns**',async route=>{
    const url=new URL(route.request().url());
    await route.fulfill({json:url.searchParams.has('id')?{id:campaignId,...state,archived}:{campaigns:[{id:campaignId,title:view.title,character_name:view.character.name,revision:state.view.revision,created_at:'2026-09-26T00:00:00Z',updated_at:'2026-09-26T00:00:00Z',archived_at:archived?'2026-09-26T00:00:00Z':null}]}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:archived?'View history':'Continue adventure',exact:true}).click();
  return state;
}

test('a phone lead prepares editable text, clears selected equipment, and waits for Send',async({page})=>{
  const state=await mockAdventure(page);
  const requests:{input:string;itemId?:string;turnId:string}[]=[];
  await page.route('**/api/turns',async route=>{
    const request=route.request().postDataJSON();requests.push(request);
    await route.fulfill({json:{view:{...state.view,revision:1},turn:{id:request.turnId,input:request.input,interpretation:'You ask why she is here.',changes:[],narration:'She considers your question.',revision:1}}});
  });
  const guidance=page.getByRole('region',{name:'A LEAD TO FOLLOW'});
  await expect(guidance.getByRole('heading',{name:'Why she waits'})).toBeVisible();
  await expect(guidance).toContainText('Find out why the woman is waiting at the arch.');
  await expect(page.locator('.composer>.suggestions')).toHaveCount(0);
  await page.getByRole('button',{name:'Open inventory, 1 item'}).click();
  await page.getByRole('button',{name:'Use',exact:true}).click();
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toBeVisible();
  await guidance.getByRole('button',{name:lead.text}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue(lead.action);
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeFocused();
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toHaveCount(0);
  expect(requests).toHaveLength(0);
  const edited='I ask the woman why she came here, and whether she is waiting for someone.';
  await page.getByRole('textbox',{name:'Your action'}).fill(edited);
  await page.getByRole('button',{name:'Send action'}).click();
  await expect(page.getByText('She considers your question.')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].input).toBe(edited);
  expect(requests[0].itemId).toBeUndefined();
});

test('current leads update after a turn and remain available when an adventure resumes',async({page})=>{
  const state=await mockAdventure(page);
  await page.route('**/api/turns',async route=>{
    const request=route.request().postDataJSON();
    state.view={...state.view,revision:1,story:{focusQuestId:'woman-purpose',quietTurns:0,leads:[nextLead]}};
    const turn:PublicTurn={id:request.turnId,input:request.input,interpretation:'You ask about her purpose.',changes:['She points toward the tower.'],narration:'Her attention turns toward the tower.',revision:1};
    state.turns.push(turn);
    await route.fulfill({json:{view:state.view,turn}});
  });
  await page.getByRole('button',{name:lead.text}).click();
  await page.getByRole('button',{name:'Send action'}).click();
  await expect(page.getByRole('button',{name:nextLead.text})).toBeVisible();
  await expect(page.getByRole('button',{name:lead.text})).toHaveCount(0);
  await page.reload();
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  await expect(page.getByRole('button',{name:nextLead.text})).toBeVisible();
  await expect(page.getByText('Follow a lead or choose your own path.')).toBeVisible();
  await page.locator('.composer').scrollIntoViewIfNeeded();
  await page.screenshot({path:test.info().outputPath('phone-story-guidance.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('archived stories and the scripted preview expose no live lead actions',async({page})=>{
  await mockAdventure(page,storyView(),true);
  await expect(page.getByRole('region',{name:'A LEAD TO FOLLOW'})).toContainText(lead.text);
  await expect(page.getByRole('region',{name:'A LEAD TO FOLLOW'}).getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveCount(0);
  await page.getByRole('button',{name:'Adventures',exact:true}).click();
  await page.getByRole('button',{name:'Explore scripted preview · No AI',exact:true}).click();
  await expect(page.locator('.story-guidance').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveCount(0);
});

test('journal shows public quest relationships, scopes and objectives without mobile overflow',async({page})=>{
  const view=storyView();
  view.quests.push(
    {id:'arc',title:'An account recovered',description:'This chapter is finished.',status:'completed',scope:'arc',objective:'Record the account.',stakes:'Remember what was said.',leads:[nextLead]},
    {id:'local',title:'The extremely long name of a local mystery with a detailed history that should wrap on a phone',description:'A local thread has ended.',status:'failed',scope:'local',parentId:'unseen-parent',objective:'Learn what happened near the arch.',leads:[]},
  );
  await mockAdventure(page,view);
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  const immediate=page.getByRole('article',{name:'Why she waits',exact:true});
  await expect(immediate).toContainText('Immediate');
  await expect(immediate).toContainText('Part of: The old promises');
  await expect(immediate).toContainText('Objective');
  await expect(immediate).toContainText('Why it matters');
  await expect(immediate).toContainText(lead.text);
  await expect(page.getByRole('article',{name:'The old promises',exact:true})).toContainText('World');
  const completed=page.getByRole('article',{name:'An account recovered',exact:true});
  await expect(completed).toContainText('completed');
  await expect(completed).toContainText('Major');
  await expect(completed).not.toContainText(nextLead.text);
  const local=page.getByRole('article',{name:/The extremely long name/});
  await expect(local).toContainText('Local');
  await expect(local).not.toContainText('Part of:');
  await expect(page.getByText('unseen-parent')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('phone-quest-journal.png'),fullPage:true});
  await page.setViewportSize({width:1200,height:900});
  await expect(page.locator('.sidebar-quest')).toContainText('Why she waits');
  await expect(page.locator('.sidebar-quest')).toContainText('Find out why the woman is waiting at the arch.');
});

test('empty quest lists invite player intent and older saved projections stay readable',async({page})=>{
  await mockAdventure(page,{...storyView(),quests:[],story:{focusQuestId:null,quietTurns:0,leads:[]}});
  await expect(page.locator('.story-guidance')).toContainText('Look around, speak to someone, or describe what matters to your character.');
  await expect(page.locator('.composer>.suggestions')).toHaveCount(0);
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  await expect(page.getByText('No quests yet. The people you meet and choices you make can open new threads.')).toBeVisible();
  await expect(page.locator('.quest-card')).toHaveCount(0);
  const legacy={...storyView(),story:undefined,quests:[{id:'old-quest',title:'A previous thread',description:'A question already recorded.',status:'active'}]};
  await mockAdventure(page,legacy);
  await expect(page.locator('.story-guidance')).toContainText('A previous thread');
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeVisible();
});
