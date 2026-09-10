import {Engine,SR} from './dsp.js';

// Plain HTTP on a LAN IP does not expose AudioWorklet. Keep the same DSP
// and message interface, using a larger main-thread buffer on those origins.
export function createFallbackNode(context,module){
  if(typeof context.createScriptProcessor!=='function'){
    throw new Error('This browser needs HTTPS for live audio. Open the offline instrument locally instead.');
  }
  const engine=new Engine(new WebAssembly.Instance(module,{}));
  const node=context.createScriptProcessor(2048,2,2);
  let phase=0,aL=0,aR=0,bL=0,bR=0;
  node.backend='compatibility';
  node.port={onmessage:null,postMessage(m){
    if(m.type==='set')engine.set(m.patch);
    if(m.type==='clearDelay')engine.delay.clear();
    if(m.type==='demo')engine.loadDemo(m.index);
    if(m.type==='start')engine.start();
    if(m.type==='stop')engine.stop();
    if(m.type==='panic')engine.panic();
    if(m.type==='on')engine.noteOn(m.note,m.velocity);
    if(m.type==='off')engine.noteOff(m.note);
    if(m.type==='loop')engine.looper.command(m.command,engine.p.mono);
  }};
  node.onaudioprocess=event=>{
    const left=event.outputBuffer.getChannelData(0);
    const right=event.outputBuffer.getChannelData(1);
    const inL=event.inputBuffer.getChannelData(0);
    const inR=event.inputBuffer.numberOfChannels>1?event.inputBuffer.getChannelData(1):inL;
    for(let i=0;i<left.length;i++){
      if(context.sampleRate===SR){
        const sample=engine.next(inL[i],inR[i]);left[i]=sample[0];right[i]=sample[1];
      }else{
        phase+=SR/context.sampleRate;
        while(phase>=1){
          aL=bL;aR=bR;
          const sample=engine.next(inL[i],inR[i]);bL=sample[0];bR=sample[1];
          phase--;
        }
        left[i]=aL*(1-phase)+bL*phase;right[i]=aR*(1-phase)+bR*phase;
      }
    }
    node.port.onmessage?.({data:{type:'status',step:engine.step,playing:engine.playing,
      peak:engine.meter,loop:engine.looper.state,loopTime:engine.looper.pos/SR,
      loopLength:engine.looper.length/SR}});
  };
  return node;
}
