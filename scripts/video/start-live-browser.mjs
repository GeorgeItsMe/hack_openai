// Isolated, real extension session for the narrated window recording.
import {chromium} from '@playwright/test';
import {readFile, mkdir, mkdtemp, cp, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
await mkdir('.local', {recursive:true});
const profile=await mkdtemp(resolve('.local/live-film-'));
const extension=profile+'-extension';
await cp(resolve('dist/extension'),extension,{recursive:true});
const manifest=JSON.parse(await readFile(extension+'/manifest.json','utf8'));
const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:false,viewport:null,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--window-size=1512,930','--window-position=0,25','--remote-debugging-port=9445']});
const panel=await context.newPage(); await panel.goto(`chrome-extension://${id}/sidepanel.html`);
const token=(await readFile('.local/pairing.txt','utf8')).trim();
await panel.evaluate(async token=>{
 for(const message of [{type:'SETTINGS',settings:{pairToken:token,consent:true,readText:true,mode:'soft',language:'en'}},{type:'CONNECT'}]){
  const r=await chrome.runtime.sendMessage(message);if(!r.ok)throw new Error(r.error);
 }
},token);
const work=await context.newPage();await work.goto('https://react.dev/learn/managing-state');
const cats=await context.newPage();await cats.goto('https://www.youtube.com/watch?v=J---aiyznGQ',{waitUntil:'domcontentloaded'});
await panel.bringToFront();
await panel.evaluate(()=>{const b=document.createElement('button');b.id='open-film-panel';b.textContent='Open side panel';b.style.cssText='position:fixed;right:30px;bottom:30px;z-index:2147483647;padding:18px;background:#ff7745';b.onclick=async()=>{const w=await chrome.windows.getCurrent();await chrome.sidePanel.open({windowId:w.id})};document.body.append(b)});
await panel.locator('#open-film-panel').click();await panel.locator('#open-film-panel').evaluate(e=>e.remove());
await panel.close();
for(const p of context.pages())if(p.url()==='about:blank')await p.close();
await work.bringToFront();
await writeFile('.local/live-film-browser.json',JSON.stringify({profile,extension,id,port:9445},null,2));
console.log('READY: isolated Chrome, real React + YouTube, real DeepSeek, native Tabby panel.');
await new Promise(r=>context.on('close',r));
