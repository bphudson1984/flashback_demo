import fs from 'node:fs';
import {Engine,SR} from '../public/dsp.js';
import {demos} from '../public/presets.js';
import {wavBuffer} from '../public/audio-utils.js';
const module=await WebAssembly.compile(fs.readFileSync(new URL('../public/braids.wasm',import.meta.url)));
const folder=new URL('../public/demos/',import.meta.url);fs.mkdirSync(folder,{recursive:true});const manifest=[];
for(let d=0;d<demos.length;d++){
 const e=new Engine(new WebAssembly.Instance(module,{}));e.loadDemo(d);e.start();
 const cycle=16*30/e.p.bpm,playSeconds=cycle*2,tailSeconds=10,n=Math.ceil((playSeconds+tailSeconds)*SR);
 const l=new Float32Array(n),r=new Float32Array(n),dryL=new Float32Array(n),dryR=new Float32Array(n);let peak=0,sum=0,clipped=0;
 for(let i=0;i<n;i++){if(i===Math.floor(playSeconds*SR))e.stop();const o=e.next();l[i]=o[0];r[i]=o[1];dryL[i]=e.dry[0]*e.master;dryR[i]=e.dry[1]*e.master;peak=Math.max(peak,Math.abs(o[0]),Math.abs(o[1]));sum+=o[0]*o[0]+o[1]*o[1];if(Math.abs(o[0])>=.8899||Math.abs(o[1])>=.8899)clipped++;}
 const slug=demos[d].name.toLowerCase().replaceAll(' ','-');fs.writeFileSync(new URL(slug+'.wav',folder),Buffer.from(wavBuffer(l,r)));fs.writeFileSync(new URL(slug+'-dry.wav',folder),Buffer.from(wavBuffer(dryL,dryR)));
 const a={name:demos[d].name,slug,seconds:n/SR,playSeconds,tailSeconds,sampleRate:SR,channels:2,bits:16,peakDb:20*Math.log10(peak),rmsDb:20*Math.log10(Math.sqrt(sum/(2*n))),limitedSamples:clipped,patch:e.p};manifest.push(a);console.log(a.name,a.peakDb.toFixed(2),'dBFS',a.rmsDb.toFixed(2),'RMS',clipped,'limited');
}
fs.writeFileSync(new URL('manifest.json',folder),JSON.stringify(manifest,null,2));
