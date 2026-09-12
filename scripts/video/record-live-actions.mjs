// Record live Chromium compositor streams while exercising the real extension.
// No screenshots, mocked model responses, or replacement product UI are used.
import {chromium} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const root='artifacts/tabby-live-video/take-'+Date.now();
await mkdir(root,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9445');
const context=browser.contexts()[0];
const work=context.pages().find(p=>p.url().startsWith('https://react.dev/'));
const cats=context.pages().find(p=>p.url().startsWith('https://www.youtube.com/watch'));
const panel=context.pages().find(p=>p.url().endsWith('/sidepanel.html'));
if(!work||!cats||!panel)throw new Error('Run start-live-browser.mjs first');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const get=()=>panel.evaluate(async()=>{const r=await chrome.runtime.sendMessage({type:'GET'});if(!r.ok)throw new Error(r.error);return r.data});
const wait=async test=>{for(let n=0;n<90;n++){const state=await get();if(test(state))return state;await delay(500)}throw new Error('Live AI response timed out')};
const captures={},pending=[],marks=[];
const continuing=process.argv.includes('--continue');
async function record(name,page){
 const cdp=await context.newCDPSession(page);const frames=[];
 await mkdir(root+'/'+name,{recursive:true});
 cdp.on('Page.screencastFrame',event=>{
  cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  const path=name+'/'+String(frames.length).padStart(6,'0')+'.jpg';
  frames.push({path,t:event.metadata.timestamp});
  pending.push(writeFile(root+'/'+path,Buffer.from(event.data,'base64')));
 });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:94,maxWidth:1920,maxHeight:1200,everyNthFrame:1});
 captures[name]={cdp,frames,size:await page.evaluate(()=>({width:innerWidth,height:innerHeight}))};
}
function mark(name){marks.push({name,t:Date.now()/1000});console.log(name)}
async function click(locator){await locator.scrollIntoViewIfNeeded();await delay(350);await locator.click();}
async function shot(name,ms=3000){mark(name);await delay(ms)}
let error;
try{
 await cats.bringToFront();
 const play=cats.getByRole('button',{name:/^Play \(k\)$/});if(await play.count())await play.click().catch(()=>{});
 if(!continuing)await work.bringToFront();
 await Promise.all([record('work',work),record('cats',cats),record('panel',panel)]);
 if(!continuing){
 mark('intro');
 await work.mouse.move(750,400);await work.mouse.wheel(0,220);await delay(3000);await work.mouse.wheel(0,-220);await delay(2000);
 mark('goal');
 const input=panel.getByLabel('What would you like to focus on?',{exact:true});
 await click(input);await input.pressSequentially('Build a React login form',{delay:105});await delay(700);
 await click(panel.getByRole('button',{name:/Start focusing/}));await work.bringToFront();
 mark('started');
 await wait(s=>s.assessment?.source==='ai'&&s.assessment.category==='aligned');
 await shot('aligned',5000);
 }
 mark('switch-cats');await cats.bringToFront();
 await wait(s=>s.assessment?.source==='ai'&&s.assessment.category==='distracting');
 await shot('distraction',4000);
 await click(panel.getByRole('button',{name:'Back to work',exact:true}).first());
 mark('return');await delay(2000);await work.bringToFront();
 await wait(s=>s.assessment?.category==='aligned');
 mark('task');
 await click(panel.getByRole('button',{name:'Task from page',exact:true}));
 await wait(s=>!!s.taskDraft);await shot('task-draft',4000);
 await panel.getByLabel('Source link',{exact:true}).scrollIntoViewIfNeeded();await delay(1500);
 await click(panel.getByRole('button',{name:'Save task',exact:true}));await shot('task-saved',2500);
 await click(panel.getByRole('button',{name:'Tabs',exact:true}));mark('tabs');
 await click(panel.getByRole('button',{name:/Suggest groups/}));
 await wait(s=>!!s.groupDraft?.length);await shot('groups-draft',3500);
 await click(panel.getByRole('button',{name:'Confirm & create groups',exact:true}));
 await shot('groups-created',3500);
 const groups=await panel.evaluate(()=>chrome.tabGroups.query({}));
 if(!groups.length)throw new Error('Chrome did not create the tab groups');
 await writeFile(root+'/verified-groups.json',JSON.stringify(groups.map(({title,color})=>({title,color})),null,2));
 await click(panel.getByRole('button',{name:'Focus',exact:true}));await work.bringToFront();
 await shot('ending',7000);
 await click(panel.getByRole('button',{name:'Pause',exact:true}));
}catch(e){error=e.message;console.error('Recording paused:',error)}
finally{
 mark('end');
 for(const capture of Object.values(captures))await capture.cdp.send('Page.stopScreencast').catch(()=>{});
 await Promise.all(pending);
 const index={root,marks,error,streams:Object.fromEntries(Object.entries(captures).map(([name,{frames,size}])=>[name,{frames,size}]))};
 await writeFile(root+'/index.json',JSON.stringify(index,null,2));
 await writeFile('artifacts/tabby-live-video/latest-take.json',JSON.stringify({root},null,2));
 console.log('Saved live compositor recordings:',root,Object.fromEntries(Object.entries(captures).map(([name,{frames}])=>[name,frames.length])));
 await browser.close();
}
if(error)process.exitCode=1;
