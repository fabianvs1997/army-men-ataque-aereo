// Binary formats from the Windows AMVP disc. No game data is bundled.
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AirAttackPak = factory();
})(globalThis, function() {
  'use strict';
  const text = new TextDecoder('ascii');
  function requireData(ok, message) { if (!ok) throw new Error(message); }
  function directory(bytes) {
    const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = d.getUint32(0,true);
    requireData(count > 0 && count <= 2048 && 4+52*count <= bytes.length, 'Directorio PAK incompatible.');
    let offset = bytes.length;
    const files = new Map();
    for (let i=0;i<count;i++) {
      const pos=4+52*i;
      const name=text.decode(bytes.subarray(pos,pos+16)).split('\0')[0];
      const size=d.getUint32(pos+16,true);
      requireData(name && !files.has(name) && size%2048===0,'Directorio PAK no válido.');
      files.set(name,size); offset-=size;
    }
    requireData(offset>=4+52*count,'Archivo PAK incompleto.');
    for (const [name,size] of files) {
      files.set(name,new DataView(bytes.buffer,bytes.byteOffset+offset,size)); offset+=size;
    }
    return files;
  }
  function paletteImage(d,w,h,pixels,palette) {
    requireData(w>0 && h>0 && pixels+w*h<=d.byteLength && palette+512<=d.byteLength,'Textura incompleta.');
    const rgba=new Uint8Array(w*h*4);
    for (let i=0;i<w*h;i++) {
      const color=d.getUint16(palette+2*d.getUint8(pixels+i),true);
      for(let c=0;c<3;c++) rgba[4*i+c]=Math.round(((color>>(5*c))&31)*255/31);
      rgba[4*i+3]=255;
    }
    return {w,h,rgba};
  }
  function terrain(hi) {
    const side=129, vertices=[], indices=[], heights=[];
    for(let z=0;z<side;z++) for(let x=0;x<side;x++) {
      const i=z*side+x, y=-hi.getInt16(2*i,true)/1024;
      heights.push(y); vertices.push(x*4,y,z*4,x/128,z/128);
      if (x<128 && z<128) indices.push(i,i+1,i+side,i+1,i+side+1,i+side);
    }
    return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices),heights};
  }
  function fuselage(d) {
    const u32=i=>d.getUint32(i,true), p=u32(40), count=u32(p+8), end=p+u32(p+20);
    requireData(u32(p)===0x4c444d33 && count>0 && end<=d.byteLength && p+24+count*8<end,'Fuselaje 3MDL incompatible.');
    const points=[],verts=[],slot=[0,0,0,0],uv=[[0,0],[0,0],[0,0],[0,0]];
    for(let i=0;i<count;i++) {
      const o=p+24+8*i;
      points.push([d.getInt16(o,true)/512,-d.getInt16(o+2,true)/512,-d.getInt16(o+4,true)/512]);
    }
    let faces=0;
    for(let o=p+24+8*count;o<end;o+=4) {
      const op=d.getUint8(o), j=(op>>2)&3, group=op&240;
      if(group===48 || group===64) slot[j]=d.getUint8(o+1);
      if(group===64 && j<3) slot[j+1]=d.getUint16(o+2,true)>>4;
      if(group===32) uv[j]=[d.getUint8(o+1)/64,d.getUint8(o+2)/64];
      if(op&3) {
        for(const k of ((op&3)===1?[0,1,2,2,1,3]:[0,1,2])) {
          requireData(slot[k]<points.length,'Índice de vértice incompatible.');
          verts.push(...points[slot[k]],...uv[k]);
        }
        faces++;
      }
    }
    requireData(faces===u32(p+12),'Comandos de caras incompatibles.');
    const tex=u32(48), pal=u32(52);
    requireData(u32(tex)===64 && u32(tex+4)===64 && u32(tex+8)===1 && u32(pal)===256,'Atlas incompatible.');
    return {vertices:new Float32Array(verts),faces,texture:paletteImage(d,64,64,tex+12,pal+4)};
  }
  function decode(bytes) {
    requireData(bytes.length>=56 && bytes.length<=64000000,'Tamaño de archivo incompatible.');
    const files=directory(bytes);
    for(const n of ['ALPINE1.SCD','TERRAIN.TER','TERRAIN.HI','SHARED.MBL','RADARMAP.TIM']) requireData(files.has(n),'Selecciona ALPINE1.PAK de la edición para Windows.');
    const t=files.get('TERRAIN.TER'), r=files.get('RADARMAP.TIM');
    requireData(t.getUint16(0,true)===64 && t.getUint16(2,true)===64 && r.getUint32(0,true)===16 && r.getUint32(4,true)===9,'Edición incompatible.');
    const p=8+r.getUint32(8,true);
    const ground=terrain(files.get('TERRAIN.HI'));
    ground.texture=paletteImage(r,2*r.getUint16(p+8,true),r.getUint16(p+10,true),p+12,20);
    return {ground,ship:fuselage(files.get('SHARED.MBL'))};
  }
  return {decode};
});
