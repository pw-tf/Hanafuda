import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-Hanafuda/4ccd9102-09e3-540c-8cac-004bcda1ac19/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const log = (tag,m)=>console.log(`[${tag}] ${m}`);

const host = await b.newPage({ viewport:{width:390,height:844} });
const guest = await b.newPage({ viewport:{width:390,height:844} });
host.on('pageerror',e=>log('host','PAGEERROR '+e));
guest.on('pageerror',e=>log('guest','PAGEERROR '+e));
host.on('console',m=>{ if(m.type()==='error') log('host','console: '+m.text().slice(0,160)); });
guest.on('console',m=>{ if(m.type()==='error') log('guest','console: '+m.text().slice(0,160)); });

await host.goto('http://localhost:4175/#/multiplayer',{waitUntil:'networkidle'});
await guest.goto('http://localhost:4175/#/multiplayer',{waitUntil:'networkidle'});
await host.waitForTimeout(400);

const code = (await host.locator('.roomcode span').allTextContents()).join('');
log('host', `room code: ${code}`);

await host.getByRole('button',{name:'Open room'}).click();
await host.waitForTimeout(1200);
await host.screenshot({path:`${OUT}/p2p-host-waiting.png`});

await guest.locator('.input').fill(code);
await guest.getByRole('button',{name:'Join'}).click();

// Poll both netbars for up to 60s.
for (let i=0;i<30;i++){
  const h = (await host.locator('.netbar').textContent().catch(()=>null)) ?? 'n/a';
  const g = (await guest.locator('.netbar').textContent().catch(()=>null)) ?? 'n/a';
  log('poll', `${i*2}s host="${h.slice(0,60)}" guest="${g.slice(0,60)}"`);
  if (h.startsWith('Connected') && g.startsWith('Connected')) { log('poll','BOTH CONNECTED'); break; }
  await host.waitForTimeout(2000);
}
await host.screenshot({path:`${OUT}/p2p-host.png`});
await guest.screenshot({path:`${OUT}/p2p-guest.png`});

// If connected, verify state sync: guest should see the same field.
const hf = await host.locator('.board__slot').count().catch(()=>-1);
const gf = await guest.locator('.board__slot').count().catch(()=>-1);
log('sync', `host field slots=${hf} guest field slots=${gf}`);
await b.close();
