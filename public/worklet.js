import {Engine,SR} from './dsp.js';
class LabProcessor extends AudioWorkletProcessor {
 constructor(options){super();const instance=new WebAssembly.Instance(options.processorOptions.module,{});this.engine=new Engine(instance);this.phase=0;this.a=[0,0];this.b=[0,0];this.ready=false;this.count=0;this.port.onmessage=e=>{const m=e.data,E=this.engine;if(m.type==='set')E.set(m.patch);if(m.type==='clearDelay')E.delay.clear();if(m.type==='demo')E.loadDemo(m.index);if(m.type==='start')E.start();if(m.type==='stop')E.stop();if(m.type==='panic')E.panic();if(m.type==='on')E.noteOn(m.note,m.velocity);if(m.type==='off')E.noteOff(m.note);if(m.type==='loop')E.looper.command(m.command,E.p.mono);};}
 process(inputs,outputs){const out=outputs[0],input=inputs[0],E=this.engine;
  for(let i=0;i<out[0].length;i++){let result;if(sampleRate===SR){result=E.next(input[0]?.[i]||0,input[1]?.[i]||input[0]?.[i]||0);}else{this.phase+=SR/sampleRate;while(this.phase>=1){this.a[0]=this.b[0];this.a[1]=this.b[1];const v=E.next(input[0]?.[i]||0,input[1]?.[i]||input[0]?.[i]||0);this.b[0]=v[0];this.b[1]=v[1];this.phase--;}result=[this.a[0]*(1-this.phase)+this.b[0]*this.phase,this.a[1]*(1-this.phase)+this.b[1]*this.phase];}out[0][i]=result[0];if(out[1])out[1][i]=result[1];}
  if(++this.count%20===0)this.port.postMessage({type:'status',step:E.step,playing:E.playing,peak:E.meter,loop:E.looper.state,loopTime:E.looper.pos/SR,loopLength:E.looper.length/SR});return true;
 }
}
registerProcessor('flashback-lab',LabProcessor);
