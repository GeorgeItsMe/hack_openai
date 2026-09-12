// Actual installed extension -> actual local backend -> paid DeepSeek completions.
// The two local source pages are prepared verification fixtures, not live websites.
import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const path=resolve('dist/extension');
const manifest=JSON.parse(await readFile(path+'/manifest.json','utf8'));
const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const fixture=createServer((req,res)=>{
 const cats=req.url==='/cats';res.setHeader('Content-Type','text/html');
 res.end(`<title>${cats?'Funny cats compilation':'React login form tutorial'}</title><main><h1>${cats?'Funny cats compilation':'Build a login form in React'}</h1><p>${cats?'Entertainment video: funny kittens playing with toys and jumping around.':'Create LoginForm.jsx. Add email and password fields. Use React state to capture input and render validation errors. Add a submit handler.'}</p></main>`);
});
await new Promise(r=>fixture.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+fixture.address().port;
const profile=await mkdtemp(join(tmpdir(),'tabby-live-check-'));
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1100,height:900},args:[`--disable-extensions-except=${path}`,`--load-extension=${path}`]});
const checks=[];let report={at:new Date().toISOString(),liveModel:true,preparedSourcePages:true,checks};
try {
 const panel=await context.newPage();await panel.goto(`chrome-extension://${id}/sidepanel.html`);
 const cmd=(type,payload={})=>panel.evaluate(async({type,payload})=>{const r=await chrome.runtime.sendMessage({type,...payload});if(!r.ok)throw new Error(r.error);return r.data},{type,payload});
 const get=()=>cmd('GET');
 const pass=name=>{checks.push(name);console.log('PASS:',name)};
 const token=(await readFile('.local/pairing.txt','utf8')).trim();
 await cmd('SETTINGS',{settings:{pairToken:token,consent:true,readText:true,mode:'strict',language:'en'}});await cmd('CONNECT');
 report.model=(await get()).ai.model;expect(report.model).toBe('deepseek-v3.2');pass('real backend connection and exact DeepSeek model');
 const work=await context.newPage();await work.goto(base+'/react');
 await cmd('START',{goal:'Build a React login form',taskId:'',minutes:25});
 await expect.poll(async()=>(await get()).assessment?.category,{timeout:45000}).toBe('aligned');
 const aligned=await get();expect(aligned.assessment.source).toBe('ai');pass('real DeepSeek marks the React tutorial on track');
 const cats=await context.newPage();await cats.goto(base+'/cats');
 await expect.poll(async()=>(await get()).assessment?.category,{timeout:45000}).toBe('distracting');
 await expect(cats.locator('#tabby-reminder')).toHaveCount(1);pass('real distraction assessment creates the in-page reminder');
 await cmd('RETURN');await expect.poll(async()=>(await get()).page?.title,{timeout:12000}).toBe('React login form tutorial');pass('Back to work activates the actual original Chrome tab');
 await cmd('PAUSE');await work.bringToFront();
 await panel.getByRole('button',{name:'Tasks',exact:true}).click();
 await cmd('AI',{kind:'task'});await expect(panel.getByLabel('Title',{exact:true})).not.toHaveValue('');
 const draft=(await get()).taskDraft;expect(draft.source).toBe(base+'/react');
 await panel.getByRole('button',{name:'Save task',exact:true}).click();
 expect((await get()).tasks.length).toBe(1);pass('real AI creates an editable page task; Save persists its source and steps');
 await cmd('AI',{kind:'groups'});expect((await get()).groupDraft.length).toBeGreaterThan(0);
 await cmd('APPLY_GROUPS');const groups=await panel.evaluate(()=>chrome.tabGroups.query({}));expect(groups.length).toBeGreaterThan(0);pass('real AI group proposal creates actual Chrome tab groups after confirmation');
 await panel.reload();expect((await get()).tasks.length).toBe(1);pass('saved task survives reloading the extension UI');
 report={...report,passed:true,usage:(await get()).usage,task:{title:draft.title,steps:draft.steps},groups:groups.map(g=>({title:g.title,color:g.color}))};
}catch(e){report.error=e.message;report.passed=false;console.error('FAIL:',e.message);process.exitCode=1;}
finally {await mkdir('.local',{recursive:true});await writeFile('.local/live-extension-check.json',JSON.stringify(report,null,2));await context.close();fixture.closeAllConnections();await new Promise(r=>fixture.close(r));await rm(profile,{recursive:true,force:true});}
