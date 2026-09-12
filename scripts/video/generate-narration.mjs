import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const key=process.env.GPTUNNEL_API_KEY;if(!key)throw new Error('Set GPTUNNEL_API_KEY through .env.');
const root='artifacts/tabby-live-video/voice';await mkdir(root,{recursive:true});
const voice='69e7736997a24533bd8ffca7'; // Alexey, catalog description explicitly supports fluent English.
const lines=JSON.parse(await readFile('scripts/video/narration.json','utf8'));
async function api(path,body){const r=await fetch('https://gptunnel.ru/api/v2/media/'+path,{method:body?'POST':'GET',headers:{Authorization:key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});const d=await r.json();if(!r.ok)throw new Error(`TTS HTTP ${r.status}: ${d.code??'unknown'}`);return d;}
const tasks=[];
for(const line of lines){
 const output=`${root}/${line.id}.mp3`;try{await access(output);console.log(`${line.id}: cached`);continue;}catch{}
 const hash=createHash('sha256').update(voice+line.text).digest('hex').slice(0,24);
 const task=await api('tasks',{model:'tts2',prompt:line.text,params:{voice},idempotency_key:`tabby-voice-${hash}`});
 await writeFile(`${root}/${line.id}-job.json`,JSON.stringify({id:task.id,price:task.price,voice}));
 tasks.push({line,task,output});console.log(`${line.id}: ${task.status}`);
}
for(let attempt=0;tasks.length&&attempt<90;attempt++){
 await new Promise(r=>setTimeout(r,2500));
 for(let n=tasks.length-1;n>=0;n--){const item=tasks[n];const task=await api('tasks/'+item.task.id);if(task.status==='failed')throw new Error(`TTS ${item.line.id} failed: ${task.error?.title}`);if(task.status!=='done')continue;
  const url=task.result?.[0]?.url;if(!url||new URL(url).protocol!=='https:')throw new Error('Invalid audio result');
  const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Audio download ${r.status}`);await writeFile(item.output,Buffer.from(await r.arrayBuffer()));
  console.log(`${item.line.id}: ready, ${task.price} RUB`);tasks.splice(n,1);
 }
}
if(tasks.length)throw new Error('Narration is still processing; rerun to resume the same idempotent jobs.');
