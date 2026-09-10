// Original host DSP, MIT. Braids runs unchanged inside braids.wasm.
import {defaults,subdivisions,demos,patchFor} from './presets.js';
export const SR=48000;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const tau=2*Math.PI;
class Envelope {
 constructor(){this.value=0;this.stage=0;this.releaseStep=0;}
 on(){this.stage=1;}
 off(r){this.stage=4;this.releaseStep=this.value/Math.max(1,r*SR);}
 next(a,d,s){
  if(this.stage===1){this.value+=1/Math.max(1,a*SR);if(this.value>=1){this.value=1;this.stage=2;}}
  else if(this.stage===2){this.value+=(s-this.value)*(1-Math.exp(-5/Math.max(1,d*SR)));if(Math.abs(this.value-s)<.0001)this.stage=3;}
  else if(this.stage===3)this.value=s;
  else if(this.stage===4){this.value=Math.max(0,this.value-this.releaseStep);if(this.value===0)this.stage=0;}
  return this.value;
 }
}
export class Delay {
 constructor(){this.size=SR*15;this.l=new Float32Array(this.size);this.r=new Float32Array(this.size);this.clear();}
 clear(){this.l.fill(0);this.r.fill(0);this.pos=0;this.time=0;this.lp=[0,0];this.lp2=[0,0];this.dc=[0,0];this.hold=[0,0];this.counter=0;this.env=0;this.wet=[0,0];this.reverseAge=0;this.grain=0;this.level=0;this.fb=0;}
 read(buf,d){let p=this.pos-clamp(d,1,this.size-2);if(p<0)p+=this.size;if(p>=this.size)p=0;const i=p|0,f=p-i;return buf[i]*(1-f)+buf[(i+1)%this.size]*f;}
 reverse(buf,d){const age=this.reverseAge%d, age2=(age+d*.5)%d;const w=.5-.5*Math.cos(tau*age/d);return this.read(buf,1+2*age)*w+this.read(buf,1+2*age2)*(1-w);}
 pitch(buf,d){const ph=this.grain,ph2=(ph+.5)%1,w=.5-.5*Math.cos(tau*ph);return this.read(buf,d+(1-ph)*3840)*w+this.read(buf,d+(1-ph2)*3840)*(1-w);}
 next(l,r,p,t,delayMod=0){
  const type=p.algorithm;
  let base=p.sync?60000/p.bpm:p.time;
  const ratios=p.sync?(p.subdiv===10?[p.customRatio]:subdivisions[p.subdiv][1]):[1];
  const target=clamp(base*ratios[0]*(1+p.mash*p.mashTime+p.expression*p.expTime)*Math.pow(2,delayMod),20,7000)*SR/1000;
  if(!this.time)this.time=target;
  this.time+=(target-this.time)*(type===2?.00025:.0015);
  this.level+=(clamp(p.level+p.mash*p.mashLevel+p.expression*p.expLevel,0,1.5)-this.level)*.002;
  this.fb+=(clamp(p.feedback+p.mash*p.mashFeedback+p.expression*p.expFeedback,0,.985)-this.fb)*.002;
  const d=this.time;
  const wow=type===2?d*(.0015*Math.sin(t*.71*tau)+.0003*Math.sin(t*6.13*tau))*p.modDepth:0;
  let a=0,b=0;
  if(type===6){a=this.reverse(this.l,d);b=this.reverse(this.r,d);}
  else if(type===5){a=this.pitch(this.l,d);b=this.pitch(this.r,d);}
  else if(type===4){
   for(let k=0;k<3;k++){const m=SR*.003*p.modDepth*Math.sin(t*tau*(.23+k*.19)+k*tau/3);a+=this.read(this.l,d+m)/3;b+=this.read(this.r,d-m)/3;}
  } else {a=this.read(this.l,d+wow);b=this.read(this.r,d+wow);}
  // A second rhythmic output tap shares the feedback memory of the first tap.
  if(ratios.length>1){const d2=d*ratios[1]/ratios[0];a=.5*(a+this.read(this.l,d2));b=.5*(b+this.read(this.r,d2));}
  let cutoff=type===1?Math.min(p.tone,2600):type===2?Math.min(p.tone,5200):type===7?Math.min(p.tone,3400):p.tone;
  const colored=type===1||type===2||type===7;
  if(colored){const c=1-Math.exp(-tau*cutoff/SR);for(let ch=0;ch<2;ch++){let x=ch?b:a;this.lp[ch]+=c*(x-this.lp[ch]);this.lp2[ch]+=c*(this.lp[ch]-this.lp2[ch]);x=this.lp2[ch];if(type===1||type===2)x=Math.tanh(x*(type===2?1.3:1.1))/(type===2?1.3:1.1);if(type===7){if(this.counter%4===0)this.hold[ch]=Math.round(x*128)/128;x=this.hold[ch];}if(ch)b=x;else a=x;}}
  const feed=p.enabled?1:0;
  if(type===8){this.l[this.pos]=clamp((l+r)*.5*feed+b*this.fb,-3,3);this.r[this.pos]=clamp(a*this.fb,-3,3);}
  else{this.l[this.pos]=clamp(l*feed+a*this.fb,-3,3);this.r[this.pos]=clamp(r*feed+b*this.fb,-3,3);}
  const peak=Math.max(Math.abs(l),Math.abs(r));this.env+=(peak-this.env)*(peak>this.env?.003:.00012);
  const duck=type===3?1/(1+this.env*22):1;
  const gate=p.enabled||p.buffered?1:0;
  this.wet[0]=a*this.level*duck*gate;this.wet[1]=b*this.level*duck*gate;
  this.pos=(this.pos+1)%this.size;this.reverseAge++;this.grain=(this.grain+1/3840)%1;this.counter++;
  return this.wet;
 }
}
class Looper {
 constructor(){this.max=SR*40;this.l=new Float32Array(this.max);this.r=new Float32Array(this.max);this.backL=new Float32Array(this.max);this.backR=new Float32Array(this.max);this.clear();}
 clear(){this.state='empty';this.length=0;this.pos=0;this.undoable=false;this.once=false;}
 command(c,mono=false){
  if(c==='clear'){this.clear();return;}
  if(c==='rec'){
   if(this.state==='empty'){this.pos=0;this.length=0;this.limit=SR*(mono?40:20);this.state='recording';}
   else if(this.state==='recording'){this.length=Math.max(1,this.pos);this.pos=0;this.state='playing';}
   else if(this.state==='overdub'){this.state='playing';}
   else{this.backL.set(this.l.subarray(0,this.length));this.backR.set(this.r.subarray(0,this.length));this.undoable=true;this.state='overdub';}
  } else if(c==='play'&&this.length){this.state=this.state==='paused'?'playing':'paused';this.pos=0;}
  else if(c==='once'&&this.length){this.once=true;if(this.state==='paused'){this.state='playing';this.pos=0;}}
  else if(c==='undo'&&this.undoable){[this.l,this.backL]=[this.backL,this.l];[this.r,this.backR]=[this.backR,this.r];this.state='playing';}
 }
 next(l,r,level){let a=0,b=0;if(this.state==='recording'){this.l[this.pos]=l;this.r[this.pos]=r;this.pos++;if(this.pos>=this.limit){this.length=this.pos;this.pos=0;this.state='playing';}}
  else if(this.state==='playing'||this.state==='overdub'){a=this.l[this.pos];b=this.r[this.pos];if(this.state==='overdub'){this.l[this.pos]=clamp(a+l,-2,2);this.r[this.pos]=clamp(b+r,-2,2);}this.pos++;if(this.pos>=this.length){this.pos=0;if(this.once){this.once=false;this.state='paused';}}}
  this.outL=a*level;this.outR=b*level;
 }
}
export class Engine {
 constructor(wasm){this.wasm=wasm.exports||wasm;this.wasm.init();this.mem=new Int16Array(this.wasm.memory.buffer);this.p={...defaults};this.delay=new Delay();this.looper=new Looper();this.voices=Array.from({length:8},(_,id)=>({id,note:0,env:new Envelope(),fenv:new Envelope(),s1:0,s2:0,dc:0,last:0,index:24,ptr:0,strike:0,age:0,velocity:0,offAt:Infinity,g:0,k:1,a1:1,a2:0,a3:0}));this.frame=0;this.playing=false;this.demo=0;this.step=0;this.nextStep=0;this.serial=0;this.out=[0,0];this.dry=[0,0];this.mods=new Float64Array(7);this.master=this.p.master;this.meter=0;}
 set(p){const old=this.p.algorithm;this.p={...this.p,...p};if(p.algorithm!==undefined&&p.algorithm!==old)this.delay.clear();if(p.enabled===0&&!this.p.buffered)this.delay.clear();}
 loadDemo(i){this.p=patchFor(i);this.demo=i;this.stop();this.delay.clear();this.step=0;this.nextStep=this.frame;}
 start(){this.playing=true;this.step=0;this.nextStep=this.frame;}
 stop(){this.playing=false;this.voices.forEach(v=>{v.env.off(this.p.release);v.fenv.off(this.p.filterRelease);v.offAt=Infinity;});}
 panic(){this.playing=false;for(const v of this.voices){v.env.stage=0;v.env.value=0;v.fenv.stage=0;v.fenv.value=0;v.s1=v.s2=0;}this.delay.clear();this.looper.state=this.looper.length?'paused':'empty';}
 noteOn(note,velocity=.8,duration=Infinity){let v=this.voices.find(v=>v.env.stage===0);if(!v)v=this.voices.reduce((a,b)=>a.age<b.age?a:b);v.note=note;v.velocity=velocity;v.age=++this.serial;v.offAt=duration===Infinity?Infinity:this.frame+duration*SR;v.env.on();v.fenv.on();v.strike=1;v.index=24;}
 noteOff(note){for(const v of this.voices)if(v.note===note&&v.env.stage>0){v.env.off(this.p.release);v.fenv.off(this.p.filterRelease);v.offAt=Infinity;}}
 lfo(t,rate,shape){const ph=(t*rate)%1;return shape===1?1-4*Math.abs(ph-.5):shape===2?(ph<.5?1:-1):Math.sin(tau*ph);}
 next(inputL=0,inputR=0){const p=this.p,t=this.frame/SR;
  if(this.playing&&this.frame>=this.nextStep){const demo=demos[this.demo],n=demo.notes[this.step%16];if(n!==null){for(const note of Array.isArray(n)?n:[n])this.noteOn(note,.7+(this.step%4===0?.12:0),demo.gate||60/p.bpm*.29);}this.step=(this.step+1)%16;this.nextStep+=SR*30/p.bpm;}
  const control=this.frame%24===0;
  if(control){this.mods.fill(0);const sources=[this.lfo(t,p.lfoRate,p.lfoShape),this.lfo(t,p.lfo2Rate,p.lfo2Shape),p.mash,p.expression];for(let i=1;i<=4;i++){const dest=p['mod'+i+'Dest'];this.mods[dest]+=sources[p['mod'+i+'Source']]*p['mod'+i+'Amount'];}}
  let l=inputL,r=inputR;
  for(const v of this.voices){if(!v.env.stage)continue;if(this.frame>=v.offAt){v.env.off(p.release);v.fenv.off(p.filterRelease);v.offAt=Infinity;}
   const amp=v.env.next(p.attack,p.decay,p.sustain)*v.velocity;
   const fe=v.fenv.next(p.filterAttack,p.filterDecay,p.filterSustain);
   if(v.index>=24){const pitch=clamp(Math.round((v.note+this.mods[3]*12)*128),0,16383);v.ptr=this.wasm.render(v.id,p.shape,pitch,Math.round(clamp(p.timbre+this.mods[1],0,.999)*32767),Math.round(clamp(p.color+this.mods[2],0,.999)*32767),v.strike)/2;v.index=0;v.strike=0;
    const fc=clamp(p.cutoff*Math.pow(2,fe*p.envAmount+this.mods[0]*5),25,16000);v.g=Math.tan(Math.PI*fc/SR);v.k=2-1.78*p.resonance;v.a1=1/(1+v.g*(v.g+v.k));v.a2=v.g*v.a1;v.a3=v.g*v.a2;
   }
   let x=this.mem[v.ptr+v.index++]/32768;
   // Asymmetric CMOS-inspired coloration; deliberately a behavioral model.
   x=(Math.tanh(x*p.drive+.08)-Math.tanh(.08))/Math.sqrt(p.drive);
   const v3=x-v.s2,bp=v.a1*v.s1+v.a2*v3,lp=v.s2+v.a2*v.s1+v.a3*v3,hp=x-v.k*bp-lp;
   v.s1=clamp(2*bp-v.s1,-4,4);v.s2=clamp(2*lp-v.s2,-4,4);
   x=p.filterMode===1?bp:lp*(1-p.filterMix)+hp*p.filterMix;
   v.dc+=.0007*(x-v.dc);x=(x-v.dc)*amp*.18*p.synthGain;
   const pan=clamp((v.id%2?1:-1)*.12+this.mods[4],-1,1);l+=x*Math.sqrt(1-pan);r+=x*Math.sqrt(1+pan);
  }
  if(p.mono)l=r=(l+r)*.5;
  this.dry[0]=l;this.dry[1]=r;
  if(p.loopMode){this.looper.next(l,r,p.level);l+=this.looper.outL;r+=this.looper.outR;}
  else{const wet=this.delay.next(l,r,p,t,this.mods[5]);const dryGain=p.killDry?0:1;l=l*dryGain+wet[0];r=r*dryGain+wet[1];}
  this.master+=(p.master-this.master)*.002;
  l*=this.master;r*=this.master;
  // Transparent below -1 dBFS; a final hard ceiling for extreme user patches.
  this.out[0]=clamp(l,-.89,.89);this.out[1]=clamp(r,-.89,.89);this.meter=Math.max(Math.abs(l),Math.abs(r),this.meter*.9996);this.frame++;return this.out;
 }
}
