from pathlib import Path
import base64, json, zipfile, re

root=Path(__file__).resolve().parent.parent
pub=root/'public'
def data(path,mime): return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
mit='''MIT License

Copyright (c) 2026 Flashback Lab contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
'''
(root/'LICENSE').write_text(mit)
upstream=(root/'vendor/eurorack/braids/macro_oscillator.h').read_text().split('// -----------------------------------------------------------------------------')[0]
(pub/'LICENSES.txt').write_text('FLASHBACK LAB\n\n'+mit+'\nMUTABLE INSTRUMENTS BRAIDS AND STMLIB\nOriginal authorship: Emilie Gillet; names retained as in the original source.\n\n'+upstream+'\nUpstream revisions:\neurorack 08460a69a7e1f7a81c5a2abcc7189c9a6b7208d4\nstmlib d18def816c51d1da0c108236928b2bbd25c17481\n\nTC Electronic, Flashback, TonePrint and MASH are product names of their respective owner. No TC software is included. The Wasp schematic remains copyright its author and is referenced by URL, not licensed under this project MIT license.\n')
wasm=data(pub/'braids.wasm','application/wasm')
modules={n:(pub/n).read_text() for n in ['presets.js','dsp.js','audio-utils.js','worklet.js','render-worker.js','fallback.js','app.js']}
# Inline worklet/worker dependencies: opaque file origins reject nested worklet imports.
def plain(s):
 return re.sub(r'^import .*?;\n', '', s, flags=re.MULTILINE).replace('export ', '')
core=plain(modules['presets.js'])+'\n'+plain(modules['dsp.js'])
modules['worklet.js']=core+'\n'+plain(modules['worklet.js'])
modules['render-worker.js']=core+'\n'+plain(modules['audio-utils.js'])+'\n'+plain(modules['render-worker.js'])
# Build Blob module URLs in dependency order. No file:// fetches are required.
bootstrap='const source='+json.dumps(modules)+'; const urls={};\n'
bootstrap+='const wasm='+json.dumps(wasm)+';\n'
bootstrap+='''for(const name of ['presets.js','dsp.js','audio-utils.js','worklet.js','render-worker.js','fallback.js','app.js']) {
 let s=source[name];
 for(const [file,url] of Object.entries(urls)) s=s.replaceAll("'./"+file+"'",JSON.stringify(url));
 s=s.replaceAll("fetch('braids.wasm')","fetch("+JSON.stringify(wasm)+")");
 if(name==='app.js') {s=s.replace("addModule('worklet.js')","addModule("+JSON.stringify(urls['worklet.js'])+")");s=s.replace("new Worker('render-worker.js',{type:'module'})","new Worker("+JSON.stringify(urls['render-worker.js'])+")");}
 urls[name]=name==='worklet.js'?'data:text/javascript;charset=utf-8,'+encodeURIComponent(s):URL.createObjectURL(new Blob([s],{type:'text/javascript'}));
}
await import(urls['app.js']);
'''
html=(pub/'index.html').read_text().replace('<link rel="stylesheet" href="style.css">','<style>'+(pub/'style.css').read_text()+'</style>').replace('<script type="module" src="app.js?v=lan-audio-1"></script>','<script type="module">'+bootstrap+'</script>')
html=html.replace('href="research.html"','href="research-offline.html"').replace('href="listening.html"','href="listening-offline.html"')
(pub/'standalone.html').write_text(html)

manifest=json.loads((pub/'demos/manifest.json').read_text())
report=(pub/'research.html').read_text().replace('<link rel="stylesheet" href="report.css">','<style>'+(pub/'report.css').read_text()+'</style>')
report=report.replace("await(await fetch('demos/manifest.json')).json()",json.dumps(manifest)).replace('href="index.html"','href="standalone.html"').replace('href="listening.html"','href="listening-offline.html"')
(pub/'research-offline.html').write_text(report)

listen=(pub/'listening.html').read_text().replace('<link rel="stylesheet" href="report.css">','<style>'+(pub/'report.css').read_text()+'</style>')
listen=listen.replace("import {demos} from './presets.js';",modules['presets.js']+'\nconst audioData='+json.dumps({p.stem:data(p,'audio/wav') for p in (pub/'demos').glob('*.wav')})+';')
listen=listen.replace("await(await fetch('demos/manifest.json')).json()",json.dumps(manifest)).replace('fetch(`demos/${slug}.wav`)','fetch(audioData[slug])').replace('href="demos/${m.slug}.wav"','href="${audioData[m.slug]}"').replace('href="demos/${m.slug}-dry.wav"','href="${audioData[m.slug+\'-dry\']}"').replace('href="index.html"','href="standalone.html"').replace('href="research.html"','href="research-offline.html"')
(pub/'listening-offline.html').write_text(listen)

dist=root/'dist';dist.mkdir(exist_ok=True)
with zipfile.ZipFile(dist/'Flashback-Lab.zip','w',zipfile.ZIP_DEFLATED,6) as z:
 for p in pub.rglob('*'):
  if p.is_file():z.write(p,Path('Flashback-Lab/public')/p.relative_to(pub))
 for name in ['README.md','LICENSE','package.json','package-lock.json']:
  if (root/name).exists():z.write(root/name,Path('Flashback-Lab')/name)
 for folder in ['src']:
  for p in (root/folder).rglob('*'):
   if p.is_file():z.write(p,Path('Flashback-Lab')/p.relative_to(root))
 for p in (root/'tools').iterdir():
  if p.is_file() and p.name in ['package.py','build.sh','test.mjs','render.mjs','browser-test.mjs','offline-test.mjs']:z.write(p,Path('Flashback-Lab/tools')/p.name)
 # Only the MIT DSP sources needed for this build; no hardware drawings or GPL test program.
 base=root/'vendor/eurorack'
 for folder in [base/'braids',base/'stmlib',base/'stmlib/utils']:
  for p in folder.iterdir():
   if p.is_file() and (p.suffix=='.h' or p.name in ['analog_oscillator.cc','digital_oscillator.cc','macro_oscillator.cc','resources.cc','random.cc']):z.write(p,Path('Flashback-Lab')/p.relative_to(root))
print('Packaged',dist/'Flashback-Lab.zip',(dist/'Flashback-Lab.zip').stat().st_size,'bytes')
