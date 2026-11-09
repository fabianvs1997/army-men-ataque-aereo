// Build the browser scene from the decoded render data only.
const fs = require('node:fs');
const { decode } = require('../original/pak');
const { ground, ship } = decode(fs.readFileSync(process.argv[2]));
function encode(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');
}
function texture(t) {
  // Palette-index the final RGB values to keep the static download small.
  const palette = [], lookup = new Map(), pixels = new Uint8Array(t.w*t.h);
  for (let i=0;i<pixels.length;i++) {
    const rgb=t.rgba.slice(i*4,i*4+3), key=rgb.join(',');
    if(!lookup.has(key)){lookup.set(key,lookup.size);palette.push(...rgb);}
    pixels[i]=lookup.get(key);
  }
  if(lookup.size>256)throw Error('Palette overflow');
  return {w:t.w,h:t.h,palette:encode(Uint8Array.from(palette)),pixels:encode(pixels)};
}
const scene={heights:encode(Int16Array.from(ground.heights,h=>-h*1024)),terrain:texture(ground.texture),
  vertices:encode(ship.vertices),faces:ship.faces,hull:texture(ship.texture)};
fs.writeFileSync('original/alpine-scene.js','globalThis.AlpineScene = '+JSON.stringify(scene)+';\n');
