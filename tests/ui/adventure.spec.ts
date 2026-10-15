import { test, expect, type Page } from '@playwright/test';
import { seedWorld } from '../../src/engine/seed';
import { playerView } from '../../src/engine/view';
import type { PublicTurn } from '../../src/engine/types';

const firstId='a87d6f4f-f7f2-47ac-87ab-33acfa3c360e';
const secondId='d2d38753-c2d3-42b4-9ec8-8d4e6e72b58e';
const date='2026-09-18T12:00:00Z';
const saved={id:firstId,title:'The Silence of Ashford',character_name:'Rowan',revision:0,created_at:date,updated_at:date,archived_at:null as string|null};
const publicCampaign=(id=firstId)=>({id,view:playerView(seedWorld()),turns:[] as PublicTurn[],archived:false});

async function mockCampaigns(page:Page,existing=false) {
  let campaigns=existing?[{...saved}]:[];
  const adventure=publicCampaign();
  const creations:unknown[]=[];
  const deletions:string[]=[];
  const resets:string[]=[];
  await page.route('**/api/campaigns**',async route=>{
    const request=route.request(),url=new URL(request.url());
    expect(request.headers()['authorization']).toBeUndefined();
    if(url.pathname==='/api/campaigns/delete') {
      const {campaignId}=request.postDataJSON();
      deletions.push(campaignId);campaigns=campaigns.filter(c=>c.id!==campaignId);
      await route.fulfill({json:{deleted:true}});return;
    }
    if(url.pathname==='/api/campaigns/reset') {
      const {campaignId}=request.postDataJSON();resets.push(campaignId);
      campaigns=campaigns.map(c=>({...c,archived_at:date}));
      campaigns.push({...saved,id:secondId});
      await route.fulfill({json:publicCampaign(secondId)});return;
    }
    if(request.method()==='POST') {
      creations.push(request.postDataJSON());campaigns.push({...saved});
      await route.fulfill({json:publicCampaign()});return;
    }
    if(url.searchParams.has('id')) {
      const id=url.searchParams.get('id')!;
      await route.fulfill(campaigns.some(c=>c.id===id)?{json:{...adventure,id}}:{status:404,json:{error:'NOT_FOUND'}});return;
    }
    await route.fulfill({json:{campaigns}});
  });
  return {creations,deletions,resets,adventure};
}

test('open lobby starts a real adventure with one click and no login',async({page})=>{
  const calls=await mockCampaigns(page);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'A story is waiting.'})).toBeVisible();
  await expect(page.getByText('OPEN PLAYTEST · NO LOGIN')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Email'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Play mode'})).toHaveCount(0);
  await page.getByRole('button',{name:'Start a new adventure',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeVisible();
  expect(calls.creations).toHaveLength(1);
  expect(calls.creations[0]).toMatchObject({name:'Rowan'});
  await page.screenshot({path:test.info().outputPath('phone-adventure.png'),fullPage:true});
  await page.reload();
  await expect(page.getByRole('heading',{name:'A story is waiting.'})).toBeVisible();
  await expect(page.getByText('Last opened here')).toBeVisible();
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('any existing adventure can resume, reset, and delete after confirmation',async({page})=>{
  const calls=await mockCampaigns(page,true);
  await page.goto('/');
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeVisible();
  await page.getByRole('button',{name:'Adventures',exact:true}).click();
  await page.getByRole('button',{name:'Reset current adventure',exact:true}).click();
  await page.getByRole('button',{name:'Confirm reset',exact:true}).click();
  await expect(page.getByText('A fresh run is ready. The previous story is preserved in Adventures.')).toBeVisible();
  expect(calls.resets).toEqual([firstId]);
  await page.getByRole('button',{name:'Adventures',exact:true}).click();
  await expect(page.getByRole('button',{name:'View history',exact:true})).toBeVisible();
  const active=page.getByRole('article').filter({has:page.getByRole('button',{name:'Continue adventure',exact:true})});
  await active.getByRole('button',{name:'Delete',exact:true}).click();
  expect(calls.deletions).toHaveLength(0);
  await active.getByRole('button',{name:'Keep adventure',exact:true}).click();
  expect(calls.deletions).toHaveLength(0);
  await active.getByRole('button',{name:'Delete',exact:true}).click();
  await active.getByRole('button',{name:'Delete adventure',exact:true}).click();
  await expect(page.getByText('Adventure deleted.',{exact:true})).toBeVisible();
  expect(calls.deletions).toEqual([secondId]);
  await expect(page.getByRole('button',{name:'Continue adventure',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Reset current adventure'})).toHaveCount(0);
});

test('server save succeeds when browser storage is unavailable',async({page})=>{
  await mockCampaigns(page);
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
  await page.goto('/');
  await page.getByRole('button',{name:'Start a new adventure',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toBeVisible();
  await expect(page.getByText('Could not start the adventure. Please try again.')).toHaveCount(0);
});

test('scripted preview is secondary and separates claims from world facts',async({page})=>{
  await mockCampaigns(page);
  await page.goto('/');
  await page.getByRole('button',{name:'Explore scripted preview · No AI',exact:true}).click();
  await expect(page.getByRole('heading',{name:'The Silence of Ashford'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Play mode'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveCount(0);
  await page.getByRole('button',{name:'Ask the woman what happened'}).click();
  await expect(page.getByText('The woman at the arch introduces herself as Mara.')).toBeVisible();
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  await expect(page.getByText('The woman at the arch · Unverified account')).toBeVisible();
  await expect(page.getByText(/Hollow Choir/)).toHaveCount(0);
  await page.getByRole('button',{name:'World',exact:true}).click();
  await expect(page.getByRole('heading',{name:'The world you know'})).toBeVisible();
  await page.getByRole('button',{name:'Character',exact:true}).click();
  await expect(page.getByText('Weathered notebook')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

type ActionRequest={campaignId:string;turnId:string;revision:number;input:string;retry?:boolean};
const acceptedTurn=(request:ActionRequest):PublicTurn=>({id:request.turnId,input:request.input,interpretation:'You ask why she remains here.',changes:[],narration:'She cups the lantern against the wind. “I promised I would wait.”',revision:1});

test('an interrupted story keeps the action and offers a deliberate retry without exposing engine details',async({page})=>{
  await mockCampaigns(page,true);
  const requests:ActionRequest[]=[];
  let releaseRetry!:()=>void;
  const retryReleased=new Promise<void>(resolve=>{releaseRetry=resolve;});
  await page.route('**/api/turns',async route=>{
    const request:ActionRequest=route.request().postDataJSON();requests.push(request);
    if(requests.length===1) {await route.fulfill({status:400,json:{error:'STORY_UNKNOWN_FACT'}});return;}
    await retryReleased;
    await route.fulfill({json:{view:{...playerView(seedWorld()),revision:1},turn:acceptedTurn(request)}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  const action='I ask the woman what she is doing in this desolate area.';
  const prompt=page.getByRole('textbox',{name:'Your action'});
  await prompt.fill(action);
  await page.getByRole('button',{name:'Send action',exact:true}).click();
  const recovery=page.getByRole('region',{name:'Let’s pick up the thread',exact:true});
  await expect(recovery).toBeVisible();
  await expect(recovery.getByRole('status')).toContainText('That moment hasn’t unfolded yet. Your words are still here');
  await expect(page.getByText(/STORY_UNKNOWN_FACT|Reference:|could not be applied|The AI’s response/)).toHaveCount(0);
  await expect(prompt).toHaveValue(action);
  await expect(page.getByRole('button',{name:'Send action',exact:true})).toBeEnabled();
  await expect(page.locator('.player-action')).toHaveCount(0);
  await expect(recovery.getByRole('button',{name:'Edit action',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('.composer').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/storyquest-recovery-phone.png',fullPage:true});
  expect(requests).toHaveLength(1);
  expect(requests[0].retry).toBeUndefined();
  await recovery.getByRole('button',{name:'Try again',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await expect.poll(()=>requests.length).toBe(2);
  await expect(prompt).toBeDisabled();
  expect(requests[1]).toEqual({...requests[0],retry:true});
  releaseRetry();
  await expect(page.getByText('She cups the lantern against the wind. “I promised I would wait.”',{exact:true})).toBeVisible();
  await expect(recovery).toHaveCount(0);
  await expect(prompt).toBeEnabled();
  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveValue('');
  await expect(page.locator('.player-action')).toHaveCount(1);
  expect(requests).toHaveLength(2);
});

test('editing an interrupted action clears its recovery card and sends the new intent with a new identity',async({page})=>{
  await mockCampaigns(page,true);
  const requests:ActionRequest[]=[];
  await page.route('**/api/turns',async route=>{
    const request:ActionRequest=route.request().postDataJSON();requests.push(request);
    await route.fulfill(requests.length===1?{status:400,json:{error:'STORY_UNKNOWN_FACT'}}:{json:{view:{...playerView(seedWorld()),revision:1},turn:acceptedTurn(request)}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  const prompt=page.getByRole('textbox',{name:'Your action'});
  await prompt.fill('I ask the woman why she is here.');
  await page.getByRole('button',{name:'Send action',exact:true}).click();
  const recovery=page.getByRole('region',{name:'Let’s pick up the thread',exact:true});
  await expect(recovery).toBeVisible();
  await recovery.getByRole('button',{name:'Edit action',exact:true}).click();
  await expect(recovery).toHaveCount(0);
  await expect(prompt).toBeFocused();
  expect(requests).toHaveLength(1);
  const edited='I greet the woman and ask who she is waiting for.';
  await prompt.fill(edited);
  await page.getByRole('button',{name:'Send action',exact:true}).click();
  await expect(page.locator('.player-action')).toContainText(edited);
  expect(requests).toHaveLength(2);
  expect(requests[1].input).toBe(edited);
  expect(requests[1].turnId).not.toBe(requests[0].turnId);
  expect(requests[1].retry).toBeUndefined();
});

test('a lost response uses neutral recovery copy and retrieves the same committed turn without duplicating it',async({page})=>{
  const {adventure}=await mockCampaigns(page,true);
  const requests:ActionRequest[]=[];
  await page.route('**/api/turns',async route=>{
    const request:ActionRequest=route.request().postDataJSON();requests.push(request);
    const turn=acceptedTurn(request);
    if(requests.length===1) {
      adventure.view={...adventure.view,revision:1};adventure.turns=[turn];
      await route.abort('connectionreset');return;
    }
    await route.fulfill({json:{replayed:true,view:adventure.view,turn:adventure.turns[0]}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  const prompt=page.getByRole('textbox',{name:'Your action'});
  const action='I ask the woman why she is waiting.';
  await prompt.fill(action);
  await page.getByRole('button',{name:'Send action',exact:true}).click();
  const recovery=page.getByRole('region',{name:'Let’s pick up the thread',exact:true});
  await expect(recovery).toContainText('The next passage hasn’t reached you yet.');
  await expect(recovery).not.toContainText('hasn’t unfolded');
  await expect(recovery).not.toContainText('unchanged');
  await expect(prompt).toHaveValue(action);
  expect(requests).toHaveLength(1);
  await recovery.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.locator('.player-action')).toHaveCount(1);
  await expect(page.locator('.player-action')).toContainText(action);
  await expect(recovery).toHaveCount(0);
  await expect(prompt).toHaveValue('');
  await expect(prompt).toBeFocused();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual({...requests[0],retry:true});
});
