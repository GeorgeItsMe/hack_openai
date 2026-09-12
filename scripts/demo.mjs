import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
const path = resolve('dist/extension');
const manifest = JSON.parse(await readFile(path + '/manifest.json', 'utf8'));
const id = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const token = (await readFile('.local/pairing.txt','utf8')).trim();
const fixture = createServer((req,res)=>{
 const cats=req.url?.includes('cats');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html lang="en"><head><title>${cats?'Funny cats compilation':'React authentication tutorial'}</title><style>body{font:18px/1.8 system-ui;background:#f6f5f0;color:#272923;max-width:760px;margin:90px auto;padding:30px}h1{font-size:40px}small{color:#77796f}a{color:#272923}</style></head><body><small>TABBY · DEMO PAGE · LIVE DEEPSEEK ASSESSMENT</small><main><h1>${cats?'Funny cats':'React authentication'}</h1><p>${cats?'Entertainment compilation: cats jump, play with toys and get into funny situations.':'Tutorial: create a LoginForm component in React, add email and password fields, a submit handler and login error feedback. Next, create the form component.'}</p></main><a href="${cats?'/react':'/cats'}">${cats?'Back to the tutorial':'Open the entertainment page'}</a><p><small>These are prepared prototype test pages. Model responses are real. Form values, cookies and browsing history are not sent.</small></p></body></html>`);
});
await new Promise((resolve,reject)=>{fixture.once('error',reject);fixture.listen(44321,'127.0.0.1',resolve)});
await mkdir('.local/demo-chrome',{recursive:true});
// Keep chrome.storage and browsing data, but invalidate this demo profile's
// cached service-worker code when an unpacked extension build changes.
const buildHash=createHash('sha256').update(await readFile(path+'/worker.js')).digest('hex');
let previousBuild='';try{previousBuild=await readFile('.local/demo-chrome/.tabby-build','utf8')}catch{}
if(previousBuild!==buildHash){
 try{await rename('.local/demo-chrome/Default/Service Worker',`.local/demo-chrome/worker-cache-backup-${Date.now()}`)}catch(error){if(error.code!=='ENOENT')throw error}
 await writeFile('.local/demo-chrome/.tabby-build',buildHash);
}

const browser=await chromium.launchPersistentContext(resolve('.local/demo-chrome'),{channel:'chromium',headless:false,viewport:null,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${path}`,`--load-extension=${path}`,'--window-size=1440,1000']});
const panel=await browser.newPage();await panel.goto(`chrome-extension://${id}/sidepanel.html`);
const command=(type,payload={})=>panel.evaluate(async ({type,payload})=>{const r=await chrome.runtime.sendMessage({type,...payload});if(!r.ok)throw new Error(r.error);return r.data},{type,payload});
await command('SETTINGS',{settings:{pairToken:token,consent:true,readText:true,mode:'soft',language:'en'}});
await command('CONNECT');
if(process.argv.includes('--ready')){
 const old=await command('GET');if(old.session&&old.session.phase!=='finished')await command('PAUSE');
 const web=process.argv.includes('--web');
 const workUrl=web?'https://react.dev/learn/managing-state':'http://127.0.0.1:44321/react';
 const catsUrl=web?'https://www.youtube.com/watch?v=J---aiyznGQ':'http://127.0.0.1:44321/cats';
 const work=await browser.newPage(); await work.goto(workUrl);
 const cats=await browser.newPage(); await cats.goto(catsUrl,{waitUntil:'domcontentloaded'}); await work.bringToFront();
 await panel.bringToFront();
 await panel.evaluate(()=>{const b=document.createElement('button');b.id='open-native-demo';b.style.cssText='position:fixed;right:24px;bottom:80px;z-index:2147483647;background:#ff7745;color:#272923;padding:12px 20px;border-radius:10px';b.textContent='Open side panel';b.onclick=async()=>{const w=await chrome.windows.getCurrent();await chrome.sidePanel.open({windowId:w.id});};document.body.append(b);});
 await panel.locator('#open-native-demo').click();await panel.locator('#open-native-demo').evaluate(el=>el.remove());
 const state=await command('GET');
 await panel.close();
 for(const page of browser.pages())if(page.url()==='about:blank')await page.close();
 await work.bringToFront();
 console.log(`READY: ${state.ai.model} connected; latest extension and native Side Panel open. ${state.session&&state.session.phase!=='finished'?'Click Resume.':'Enter a goal and click Start focusing.'}`);
 if(web)console.log('On each website, use Focus → Allow access to this site for page text and in-page reminders.');
 await new Promise(resolve=>browser.on('close',resolve));fixture.close();process.exit(0);
}
console.log('Real DeepSeek connected. Running the main loop using two prepared demo pages.');
const old=await command('GET');if(old.session&&old.session.phase!=='finished')await command('STOP');
await panel.getByLabel('What would you like to focus on?').fill('Learn React authentication and build an example');
await panel.getByRole('button',{name:'Start focusing',exact:false}).click();
const work=await browser.newPage();await work.goto('http://127.0.0.1:44321/react');await work.bringToFront();
async function waitAssessment(title){for(let i=0;i<50;i++){const s=await command('GET');if(s.assessment?.source==='ai'&&s.page?.title===title)return s;if(s.ai.code!=='ANALYZING'&&!s.pendingAt&&!s.ai.connected)throw new Error(s.ai.code);await new Promise(r=>setTimeout(r,1000));}throw new Error('DEMO_ASSESSMENT_TIMEOUT');}
try{
 const aligned=await waitAssessment('React authentication tutorial');console.log('Live work-page category:',aligned.assessment.category);
 const cats=await browser.newPage();await cats.goto('http://127.0.0.1:44321/cats');await cats.bringToFront();
 const distraction=await waitAssessment('Funny cats compilation');console.log('Live entertainment-page category:',distraction.assessment.category);
 if(aligned.assessment.category!=='aligned'||distraction.assessment.category!=='distracting')throw new Error('Review live classifications');
 await command('RETURN');await new Promise(r=>setTimeout(r,500));await command('PAUSE');
 const state=await command('GET');
 await writeFile('.local/live-browser-report.json',JSON.stringify({live:true,model:state.ai.model,work:aligned.assessment,entertainment:distraction.assessment,returns:state.session.returns,usage:state.usage,at:new Date().toISOString()},null,2));
 await panel.bringToFront();
 await panel.evaluate(()=>{const b=document.createElement('button');b.id='open-native-demo';b.style.cssText='position:fixed;right:24px;bottom:80px;z-index:2147483647;background:#ff7745;color:#272923;padding:12px 20px;border-radius:10px';b.textContent='Open side panel';b.onclick=async()=>{const w=await chrome.windows.getCurrent();await chrome.sidePanel.open({windowId:w.id});};document.body.append(b);});
 await panel.locator('#open-native-demo').click();await panel.locator('#open-native-demo').evaluate(el=>el.remove());await work.bringToFront();
 console.log('PASS: real extension → local server → DeepSeek → reminder → return to work. Demo is paused and ready in Chrome.');
}catch(e){await command('PAUSE').catch(()=>{});console.error('Live demo:',e.message);await panel.bringToFront();}
await new Promise(resolve=>browser.on('close',resolve));fixture.close();
