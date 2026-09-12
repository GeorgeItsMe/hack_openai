import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const encoder=process.env.TABBY_FFMPEG || 'ffmpeg';
const fps=30,duration=15,output=resolve('public/demo/tabby-focus-demo.mp4');
await mkdir('public/demo',{recursive:true});await mkdir('artifacts/video-review',{recursive:true});
const paths={
 '/': 'scripts/video/focus-demo.html',
 '/brand/tabby-logo.svg':'public/brand/tabby/tabby-logo.svg',
 '/brand/tabby-mark-sleepy.svg':'public/brand/tabby/tabby-mark-sleepy.svg',
 '/brand/tabby-mark-task.svg':'public/brand/tabby/tabby-mark-task.svg',
 '/assets/context-aligned@4x.png':'scripts/video/assets/context-aligned@4x.png',
 '/assets/context-distraction@4x.png':'scripts/video/assets/context-distraction@4x.png',
};
for(const path of Object.values(paths))await access(path);
const server=createServer(async(req,res)=>{const path=paths[req.url];if(!path){res.writeHead(404).end();return;}res.setHeader('Content-Type',path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(await readFile(path));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chromium',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=`http://127.0.0.1:${server.address().port}`;
await page.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
try{
 await page.goto(url);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 for(const t of [2,6.5,8.5,10,13.5]){await page.evaluate(t=>window.render(t),t);await page.screenshot({path:`artifacts/video-review/frame-${t}.png`});}
 await page.evaluate(()=>window.render(6.5));await page.screenshot({path:'public/demo/tabby-focus-poster.jpg',type:'jpeg',quality:94});
 if(process.argv.includes('--preview')){console.log('Storyboard frames ready.');}
 else {
 const proc=spawn(encoder,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-frames:v',String(fps*duration),output],{stdio:['pipe','ignore','pipe']});
 let encoderError='';proc.stderr.on('data',d=>encoderError+=d.toString());proc.stdin.on('error',()=>{});const done=new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('close',code=>code===0?resolve():reject(new Error(encoderError||`encoder exit ${code}`)));});done.catch(()=>{});
 for(let n=0;n<fps*duration;n++){if(proc.exitCode!==null)throw new Error(encoderError);await page.evaluate(t=>window.render(t),n/fps);const frame=await page.screenshot({type:'jpeg',quality:94});if(!proc.stdin.write(frame))await once(proc.stdin,'drain');if(n%90===0)console.log(`Rendered ${n}/${fps*duration} frames`);}
 proc.stdin.end();await done;
 if(errors.length)throw new Error(errors.join('\n'));
 await writeFile('public/demo/tabby-focus-demo.vtt','WEBVTT\n\n00:00.000 --> 00:04.400\nSet a goal: build a React login form. Tabby recognizes a relevant tutorial.\n\n00:04.400 --> 00:08.750\nA cat-video tab is a detour. Tabby suggests returning to your task.\n\n00:08.750 --> 00:12.100\nClick Back to work to return to the React tutorial.\n\n00:12.100 --> 00:15.000\nTabby. Less chaos. More focus.\n');
 console.log(`Ready: ${output} · ${duration}s · 1920×1080 · ${fps} fps · no audio`);
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
