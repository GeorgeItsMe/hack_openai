import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Post-production only: the renderer never controls the recorded browser or calls AI.
const encoder=process.env.TABBY_FFMPEG||'ffmpeg',fps=30,duration=60;
const captureRoot=resolve(process.env.TABBY_CAPTURE_DIR||'artifacts/browser-demo');
const {captures}=JSON.parse(await readFile(resolve(captureRoot,'capture-index.json'),'utf8'));
const frames=(a,b)=>captures.slice(a,b+1);
const clips=[];
function clip(start,end,a,b,chapter,kicker,title,sub,zoom=[1.45,1.52],pan=[-90,-105]){clips.push({start,end,frames:frames(a,b),chapter,kicker,title,sub,zoom,pan});}
clip(0,3,0,0,0,'01 / ONE CLEAR GOAL','Start with<br><em>intention.</em>','Build a React login form.',[1,1],[0,0]);
clip(3,8.5,0,10,0,'01 / ONE CLEAR GOAL','Make room<br>for <em>one thing.</em>','Set a goal. Choose 25 minutes. Start your focus session.',[1,1.47],[0,-280]);
clip(8.5,11,11,16,0,'01 / ONE CLEAR GOAL','A little<br><em>momentum.</em>','Tabby starts checking the page against your goal.',[1.4,1.45],[-100,-110]);
clip(11,17,29,33,1,'02 / CONTEXT THAT COUNTS','The right<br>kind of <em>tab.</em>','React documentation fits the goal. Tabby explains why.',[1.48,1.55],[-100,-110]);
clip(17,24,66,71,1,'02 / A GENTLE NUDGE','Just one<br><em>cat video?</em>','Tabby spots the detour and suggests a way back.',[1,1.48],[0,-120]);
clip(24,25,71,71,1,'03 / BACK TO WORK','One click.<br><em>You’re back.</em>','Return to the work tab you left open.',[1.48,1.48],[-120,-120]);
clip(25,28,72,76,1,'03 / BACK TO WORK','One click.<br><em>You’re back.</em>','Return to the work tab you left open.',[1.3,1],[0,0]);
clip(28,31,159,163,2,'04 / FROM PAGE TO PLAN','Keep the<br><em>next step.</em>','Turn the current page into a task draft.',[1,1.45],[0,-170]);
clip(31,34,169,176,2,'04 / FROM PAGE TO PLAN','A page.<br><em>A small plan.</em>','AI drafts a title and three practical steps.',[1.45,1.5],[-230,-250]);
clip(34,38,178,182,2,'04 / REVIEW, THEN SAVE','Your call.<br><em>Always.</em>','Review the draft and its source link before saving.',[1.48,1.48],[-160,-170]);
clip(38,42,183,189,2,'04 / READY WHEN YOU ARE','Less to hold<br>in your <em>head.</em>','The task, steps and source stay together in Tabby.',[1.4,1.48],[-180,-210]);
clip(42,45,198,211,3,'05 / A CALMER BROWSER','Give your<br>tabs a <em>home.</em>','Ask Tabby to suggest groups for the open tabs.',[1,1.38],[0,-180]);
clip(45,49,272,274,3,'05 / REVIEW THE GROUPS','A little<br><em>order.</em>','Review the suggested groups before applying them.',[1.48,1.52],[-120,-130]);
clip(49,54,277,284,3,'05 / REAL CHROME GROUPS','And it’s<br><em>organized.</em>','Your tabs become real, named groups in Chrome.',[1.08,1],[0,0]);
clip(54,57,287,291,4,'06 / BACK TO YOUR GOAL','Keep your<br><em>momentum.</em>','A clear goal. A saved task. A calmer browser.',[1.4,1.46],[-140,-160]);
clip(57,60,291,291,4,'','Less chaos.<br>More <em>focus.</em>','',[1,1],[0,0]);
const edit={duration,fps,source:'Actual Chrome for Testing window and installed Tabby side panel; real DeepSeek calls; edited timing.',clips};
await mkdir('artifacts/browser-video-review',{recursive:true});await mkdir('public/demo',{recursive:true});
await writeFile('artifacts/browser-video-review/edit.json',JSON.stringify(edit,null,2));
const routes=new Map([['/',['scripts/video/browser-demo.html','text/html']],['/brand/tabby-logo.svg',['public/brand/tabby/tabby-logo.svg','image/svg+xml']],['/brand/tabby-mark-task.svg',['public/brand/tabby/tabby-mark-task.svg','image/svg+xml']]]);
for(const file of new Set(clips.flatMap(c=>c.frames.map(f=>f.file))))routes.set('/capture/'+file,[resolve(captureRoot,'raw',file),'image/jpeg']);
const server=createServer(async(req,res)=>{try{if(req.url==='/edit.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(edit));return;}const found=routes.get(req.url);if(!found){res.writeHead(404).end();return;}res.setHeader('Content-Type',found[1]);res.end(await readFile(found[0]));}catch{res.writeHead(500).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chromium',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const origin=`http://127.0.0.1:${server.address().port}`;await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
try{
 await page.goto(origin);await page.evaluate(()=>window.ready);
 for(const t of [1.5,7,10,14,21,26.5,33,36,40,47,52,55.5,59]){await page.evaluate(t=>window.render(t),t);await page.screenshot({path:`artifacts/browser-video-review/frame-${t}.jpg`,type:'jpeg',quality:94});}
 await page.evaluate(()=>window.render(14));await page.screenshot({path:'public/demo/tabby-browser-poster.jpg',type:'jpeg',quality:94});
 if(!process.argv.includes('--preview')){
  const output=resolve('public/demo/tabby-browser-demo.mp4');
  const proc=spawn(encoder,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-i','artifacts/browser-video-review/soundtrack.wav','-c:a','aac','-b:a','160k','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-frames:v',String(fps*duration),'-t','60',output],{stdio:['pipe','ignore','pipe']});
  let stderr='';proc.stderr.on('data',d=>stderr+=d);proc.stdin.on('error',()=>{});const done=new Promise((r,j)=>{proc.on('error',j);proc.on('close',code=>code===0?r():j(new Error(stderr)));});done.catch(()=>{});
  for(let n=0;n<fps*duration;n++){if(proc.exitCode!==null)throw new Error(stderr);await page.evaluate(t=>window.render(t),n/fps);const image=await page.screenshot({type:'jpeg',quality:94});if(!proc.stdin.write(image))await once(proc.stdin,'drain');if(n%180===0)console.log(`Rendered ${n}/${fps*duration} frames`);}
  proc.stdin.end();await done;console.log(`Ready: ${output} · 60s · 1920×1080 · 30fps`);
 }
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();await new Promise(r=>server.close(r));}
