import { test, expect, type Page } from '@playwright/test';
import { seedWorld } from '../../src/engine/seed';
import { playerView } from '../../src/engine/view';

const firstId='a87d6f4f-f7f2-47ac-87ab-33acfa3c360e';
const secondId='d2d38753-c2d3-42b4-9ec8-8d4e6e72b58e';
const date='2026-09-18T12:00:00Z';
const saved={id:firstId,title:'The Silence of Ashford',character_name:'Rowan',revision:0,created_at:date,updated_at:date,archived_at:null as string|null};
const publicCampaign=(id=firstId)=>({id,view:playerView(seedWorld()),turns:[],archived:false});

async function mockCampaigns(page:Page,existing=false) {
  let campaigns=existing?[{...saved}]:[];
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
      await route.fulfill(campaigns.some(c=>c.id===id)?{json:publicCampaign(id)}:{status:404,json:{error:'NOT_FOUND'}});return;
    }
    await route.fulfill({json:{campaigns}});
  });
  return {creations,deletions,resets};
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

test('a rejected AI proposal explains the failure and keeps the player action without retrying',async({page})=>{
  await mockCampaigns(page,true);
  let attempts=0;
  await page.route('**/api/turns',async route=>{
    attempts+=1;
    await route.fulfill({status:400,json:{error:'DUPLICATE_ID'}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  const action='I ask the woman what she is doing in this desolate area.';
  await page.getByRole('textbox',{name:'Your action'}).fill(action);
  await page.getByRole('button',{name:'Send action',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('The AI’s response could not be applied consistently. Your world is unchanged, and your text is kept.');
  await expect(page.getByRole('status')).toContainText('Reference: DUPLICATE_ID.');
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue(action);
  await expect(page.getByRole('button',{name:'Send action',exact:true})).toBeEnabled();
  await expect(page.getByText(`Your attempt: ${action}`,{exact:true})).toHaveCount(0);
  expect(attempts).toBe(1);
});
