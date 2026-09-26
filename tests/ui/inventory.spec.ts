import { test, expect, type Page } from '@playwright/test';
import { seedWorld } from '../../src/engine/seed';
import { playerView } from '../../src/engine/view';
import type { PlayerView } from '../../src/engine/types';

const campaignId='21ea639a-e5e2-49e1-b8cf-21df35718af7';
const inventory=[
  {id:'notebook-one',name:'Weathered notebook',quantity:1,usable:true,consumable:false},
  {id:'notebook-two',name:'Weathered notebook',quantity:1,usable:true,consumable:false},
  {id:'rations',name:'Travel rations',quantity:2,usable:true,consumable:true},
  {id:'broken-lantern',name:'Broken lantern with a very long name that must wrap safely on a small phone screen',quantity:1,usable:false,consumable:false},
];
type TurnRequest={campaignId:string;turnId:string;input:string;itemId?:string};

async function mockAdventure(page:Page,options:{archived?:boolean;legacy?:boolean}={}) {
  const view:PlayerView={...playerView(seedWorld()),inventory:options.legacy?undefined:inventory};
  const saved={id:campaignId,title:view.title,character_name:view.character.name,revision:0,created_at:'2026-09-26T00:00:00Z',updated_at:'2026-09-26T00:00:00Z',archived_at:options.archived?'2026-09-26T00:00:00Z':null};
  await page.route('**/api/campaigns**',async route=>{
    const url=new URL(route.request().url());
    await route.fulfill({json:url.searchParams.has('id')?{id:campaignId,view,turns:[],archived:!!options.archived}:{campaigns:[saved]}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:options.archived?'View history':'Continue adventure',exact:true}).click();
  return view;
}

test('phone inventory prepares an action without submitting and sends the chosen stable item ID',async({page})=>{
  const requests:TurnRequest[]=[];
  const view=await mockAdventure(page);
  await page.route('**/api/turns',async route=>{
    const request=route.request().postDataJSON() as TurnRequest;
    requests.push(request);
    await route.fulfill({json:{view:{...view,revision:1},turn:{id:request.turnId,input:request.input,interpretation:'You study your notes.',changes:[],narration:'You turn to a fresh page.'}}});
  });
  await page.getByRole('button',{name:'Open inventory, 5 items'}).click();
  await expect(page.getByRole('heading',{name:'What you carry'})).toBeVisible();
  const notebooks=page.getByRole('article',{name:'Weathered notebook, quantity 1',exact:true});
  await expect(notebooks).toHaveCount(2);
  await expect(notebooks.first().getByRole('button',{name:'Consume one'})).toHaveCount(0);
  const broken=page.getByRole('article',{name:/Broken lantern/});
  await expect(broken.getByRole('button',{name:'Use',exact:true})).toBeDisabled();
  await expect(broken.getByRole('button',{name:'Drop',exact:true})).toBeEnabled();
  await expect(page.getByRole('article',{name:'Travel rations, quantity 2'}).getByRole('button',{name:'Consume one'})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('phone-inventory.png'),fullPage:true});
  await notebooks.nth(1).getByRole('button',{name:'Use',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue('I use my Weathered notebook to ');
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toContainText('Weathered notebook');
  expect(requests).toHaveLength(0);
  await page.getByRole('textbox',{name:'Your action'}).fill('I use my Weathered notebook to review my notes.');
  await page.getByRole('button',{name:'Send action'}).click();
  await expect(page.getByText('You turn to a fresh page.')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].itemId).toBe('notebook-two');
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue('');
});

test('missing gear keeps the action, and item selection is part of retry identity',async({page})=>{
  await mockAdventure(page);
  const requests:TurnRequest[]=[];
  await page.route('**/api/turns',async route=>{
    requests.push(route.request().postDataJSON() as TurnRequest);
    await route.fulfill({status:409,json:{error:'ITEM_REQUIRED'}});
  });
  const action='I use my staff to pry the gate open.';
  await page.getByRole('textbox',{name:'Your action'}).fill(action);
  await page.getByRole('button',{name:'Send action'}).click();
  await expect(page.getByRole('status')).toContainText('You do not have the item needed for that action.');
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue(action);
  expect(requests).toHaveLength(1);
  expect(requests[0].itemId).toBeUndefined();

  await page.getByRole('button',{name:'Open inventory, 5 items'}).click();
  await page.getByRole('article',{name:'Weathered notebook, quantity 1',exact:true}).first().getByRole('button',{name:'Use',exact:true}).click();
  await page.getByRole('button',{name:'Send action'}).click();
  await expect(page.getByRole('status')).toContainText('Your world is unchanged, and your text is kept.');
  await page.getByRole('button',{name:'Send action'}).click();
  await expect.poll(()=>requests.length).toBe(3);
  expect(requests[1].itemId).toBe('notebook-one');
  expect(requests[2].turnId).toBe(requests[1].turnId);

  await page.getByRole('button',{name:'Open inventory, 5 items'}).click();
  await page.getByRole('article',{name:'Weathered notebook, quantity 1',exact:true}).nth(1).getByRole('button',{name:'Use',exact:true}).click();
  await page.getByRole('button',{name:'Send action'}).click();
  await expect.poll(()=>requests.length).toBe(4);
  expect(requests[3].input).toBe(requests[2].input);
  expect(requests[3].itemId).toBe('notebook-two');
  expect(requests[3].turnId).not.toBe(requests[2].turnId);
  await expect(page.getByRole('button',{name:'Send action'})).toBeEnabled();
  await page.getByRole('button',{name:'Clear selected item'}).click();
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toHaveCount(0);
});

test('a pending inventory action resumes with its item and UUID after reload',async({page})=>{
  await mockAdventure(page);
  const requests:TurnRequest[]=[];
  await page.route('**/api/turns',async route=>{
    requests.push(route.request().postDataJSON() as TurnRequest);
    await route.fulfill({status:504,json:{error:'MODEL_TIMEOUT'}});
  });
  await page.getByRole('button',{name:'Open inventory, 5 items'}).click();
  await page.getByRole('article',{name:'Travel rations, quantity 2'}).getByRole('button',{name:'Drop',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue('I drop all 2 of my Travel rations.');
  expect(requests).toHaveLength(0);
  await page.getByRole('button',{name:'Open inventory, 5 items'}).click();
  await page.getByRole('article',{name:'Travel rations, quantity 2'}).getByRole('button',{name:'Consume one'}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue('I consume one Travel rations.');
  expect(requests).toHaveLength(0);
  await page.getByRole('button',{name:'Send action'}).click();
  await expect(page.getByRole('status')).toContainText('The world update took too long.');
  await page.reload();
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toContainText('Travel rations');
  await page.getByRole('button',{name:'Send action'}).click();
  await expect.poll(()=>requests.length).toBe(2);
  expect(requests[1]).toEqual(requests[0]);
});

test('reload clears a committed pending action and keeps only the text of an unavailable-item draft',async({page})=>{
  const view=await mockAdventure(page);
  const committedId='6b715d29-f0eb-47b7-aadc-d5b5f1057967';
  const input='I consume one Travel rations.';
  await page.route('**/api/campaigns?id=*',async route=>route.fulfill({json:{id:campaignId,view:{...view,inventory:[],revision:1},archived:false,turns:[{id:committedId,input,interpretation:'You eat.',changes:['You consume your rations.'],narration:'The meal restores your energy.',revision:1}]}}));
  await page.evaluate(({campaignId,committedId,input})=>localStorage.setItem(`storyquest.pending.${campaignId}`,JSON.stringify({id:committedId,campaign:campaignId,input,itemId:'rations'})),{campaignId,committedId,input});
  await page.reload();
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue('');
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toHaveCount(0);
  expect(await page.evaluate(id=>localStorage.getItem(`storyquest.pending.${id}`),campaignId)).toBeNull();

  await page.evaluate(({campaignId,input})=>localStorage.setItem(`storyquest.pending.${campaignId}`,JSON.stringify({id:'7ecb0a8b-930a-4682-9d7f-c8d9ad36240f',campaign:campaignId,input,itemId:'rations'})),{campaignId,input});
  await page.reload();
  await page.getByRole('button',{name:'Continue adventure',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveValue(input);
  await expect(page.getByRole('group',{name:'Selected inventory item'})).toHaveCount(0);
  expect(await page.evaluate(id=>localStorage.getItem(`storyquest.pending.${id}`),campaignId)).toBeNull();
});

test('archived inventories and legacy projections remain readable without item actions',async({page})=>{
  await mockAdventure(page,{archived:true});
  await page.getByRole('button',{name:'Character',exact:true}).click();
  await expect(page.getByRole('article',{name:'Travel rations, quantity 2'})).toBeVisible();
  await expect(page.locator('.inventory').getByRole('button')).toHaveCount(0);
  await page.getByRole('button',{name:'Story',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Your action'})).toHaveCount(0);

  await mockAdventure(page,{legacy:true});
  await page.getByRole('button',{name:'Character',exact:true}).click();
  await expect(page.locator('.inventory').getByText('Weathered notebook',{exact:true})).toBeVisible();
  await expect(page.locator('.inventory').getByRole('button')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
