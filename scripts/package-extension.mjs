import { mkdtemp, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile);
const source=resolve('dist/extension');
const allowed=['manifest.json','worker.js','content.js','panel.js','panel.css','sidepanel.html','icons'];
for(const name of allowed)await stat(join(source,name));
const extras=(await readdir(source)).filter(name=>!allowed.includes(name));
if(extras.length)throw new Error(`Unexpected files in extension build: ${extras.join(', ')}`);
const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
const temp=await mkdtemp(join(tmpdir(),'tabby-package-'));
try{
 const archive=join(temp,'tabby-extension.zip');
 await run('zip',['-q','-r',archive,...allowed],{cwd:source});
 await run('unzip',['-t',archive]);
 await rename(archive,resolve('dist/tabby-extension.zip'));
 console.log(`Tabby ${manifest.version}: dist/tabby-extension.zip. Extract and load the folder containing manifest.json in Chrome.`);
}finally{await rm(temp,{recursive:true,force:true});}
