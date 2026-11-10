// Generates the rotor sprite and a small detail layer; the original terrain tile placement is not decoded.
const fs = require('node:fs');
const pak = fs.readFileSync(process.argv[2]);
const count = pak.readUInt32LE(0);
const entries = Array.from({length:count}, (_,i) => {
  const p=4+i*52;
  return [pak.toString('ascii',p,p+16).split('\0')[0],pak.readUInt32LE(p+16)];
});
let p=pak.length-entries.reduce((sum,e)=>sum+e[1],0);
const files = new Map(entries.map(([name,size])=>{const b=pak.subarray(p,p+size);p+=size;return [name,b];}));
const tim=files.get('ROTOR0.TIM'), start=8+tim.readUInt32LE(8);
if(tim.readUInt32LE(4)!==9 || tim.readUInt16LE(start+8)*2!==32 || tim.readUInt16LE(start+10)!==32) throw Error('Unsupported rotor sprite');
const rotor=Buffer.alloc(32*32*4);
for(let i=0;i<1024;i++){
  const value=tim.readUInt16LE(20+2*tim[start+12+i]);
  for(let c=0;c<3;c++) rotor[i*4+c]=Math.round(((value>>(5*c))&31)*255/31);
  rotor[i*4+3]=(value&32767)?255:0;
}
const terrain=files.get('TERRAIN.MAP'), detail=Buffer.alloc(64*64);
for(let i=0;i<detail.length;i++){
  const index=(terrain[6144+(i>>1)]>>(4*(i&1)))&15;
  const color=terrain.readUInt16LE(index*2);
  detail[i]=((color&31)*2+((color>>5)&31)*4+(color>>10&31))*255/(31*7);
}
const mean=detail.reduce((s,n)=>s+n,0)/detail.length;
for(let i=0;i<detail.length;i++)detail[i]=Math.max(0,Math.min(255,128+3*(detail[i]-mean)));
fs.writeFileSync('original/materials.js','globalThis.AlpineMaterials='+JSON.stringify({rotor:rotor.toString('base64'),detail:detail.toString('base64')})+';\n');
