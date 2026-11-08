/* Dependency-free WebGL 1 renderer. World units and camera match the game. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(
      require('./toy-world.js'),
      root,
      require('./toy-helicopter.js'),
      require('./gltf-loader.js'),
    );
  else
    root.ToyRenderer = factory(
      root.ToyWorld,
      root,
      root.ToyHelicopter,
      root.ToyGltfLoader,
    );
})(globalThis, function (ToyWorld, root, PlayerModel, Loader) {
  'use strict';
  // Cargador glTF (src/gltf-loader.js): puede faltar si el bootstrap
  // no lo cargó; en ese caso todo sigue procedural.
  const GltfLoader = Loader || (root && root.ToyGltfLoader) || null;
  const VS = `
attribute vec3 position; attribute vec3 normal;
uniform vec3 origin, size; uniform float yaw;
uniform vec3 tiltPivot; uniform float tiltAngle, tiltYaw;
uniform vec2 camera, viewport; uniform float cameraYaw, pitch, scale, centerY;
varying mediump vec3 surfaceNormal;
varying mediump vec3 worldPosition;
vec3 tiltVector(vec3 v){
 vec2 forward=vec2(sin(tiltYaw),cos(tiltYaw));
 float along=dot(v.xz,forward),c=cos(tiltAngle),s=sin(tiltAngle);
 float shifted=along*c+v.y*s;
 return vec3(v.x+forward.x*(shifted-along),v.y*c-along*s,v.z+forward.y*(shifted-along));
}
void main(){
 float s=sin(yaw),c=cos(yaw); vec3 p=position*size;
 p=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c)+origin;
 p=tiltPivot+tiltVector(p-tiltPivot);
 worldPosition=p;
 vec3 n=normal/size; surfaceNormal=normalize(tiltVector(vec3(n.x*c+n.z*s,n.y,-n.x*s+n.z*c)));
 vec2 d=p.xz-camera;float f=d.x*sin(cameraYaw)+d.y*cos(cameraYaw);
 float r=-d.x*cos(cameraYaw)+d.y*sin(cameraYaw);
 float u=p.y*cos(pitch)+f*sin(pitch);
 float depth=f*cos(pitch)-p.y*sin(pitch);
 gl_Position=vec4(r*scale*2.0/viewport.x,(viewport.y/2.0-centerY+u*scale)*2.0/viewport.y,depth/600.0,1.0);
}`;
  const FS = `
precision mediump float;
uniform vec3 color;uniform float gloss;uniform vec3 eyeDirection;
uniform float alpha;
varying mediump vec3 surfaceNormal;
varying mediump vec3 worldPosition;
void main(){
 vec3 n=normalize(surfaceNormal),light=normalize(vec3(-0.6,1.0,-0.4));
 float diffuse=max(dot(n,light),0.0);
 float highlight=max(dot(n,normalize(light+eyeDirection)),0.0);
 float shine=(pow(highlight,56.0)*0.75+pow(highlight,14.0)*0.12)*max(gloss,0.0);
 float rim=pow(1.0-max(dot(n,eyeDirection),0.0),3.0)*0.045*gloss;
 vec3 base=color;
 if(gloss<0.0){float grain=fract(sin(dot(floor(worldPosition.xz*0.5),vec2(12.9,7.7)))*97.1);float patch=sin(worldPosition.x*.047+sin(worldPosition.z*.031))*cos(worldPosition.z*.061);if(gloss < -2.5){float hill=smoothstep(1.0,18.0,worldPosition.y);base=mix(vec3(.30,.60,.16),vec3(.16,.38,.12),hill);float dirt=smoothstep(.55,.85,sin(worldPosition.x*.055+sin(worldPosition.z*.035))*cos(worldPosition.z*.045+worldPosition.x*.025));base=mix(base,vec3(.50,.38,.21),dirt*.6);float mottle=smoothstep(.25,.75,sin(worldPosition.x*.021+2.0)*cos(worldPosition.z*.017+1.0));base=mix(base,vec3(.36,.62,.19),mottle*.28);float rock2=smoothstep(12.0,22.0,worldPosition.y);base=mix(base,vec3(.48,.45,.38),rock2*.6);float snow=smoothstep(20.0,30.0,worldPosition.y);base=mix(base,vec3(.93,.94,.96),snow*.8);float cliff=1.0-smoothstep(.55,.92,n.y);base=mix(base,vec3(.45,.42,.36),cliff*.4);}else if(gloss < -1.5){float hill=smoothstep(1.0,18.0,worldPosition.y);base=mix(vec3(.39,.49,.24),vec3(.15,.23,.12),hill);float cliff=1.0-smoothstep(.55,.92,n.y);base=mix(base,vec3(.34,.32,.24),cliff*.65);}base*=.95+grain*.05+patch*.16;}
 float amb=gloss < -2.5 ? 0.68 : 0.48;
 gl_FragColor=vec4(base*(amb+(1.0-amb)*diffuse)+vec3(shine+rim),alpha);
}`;
  // Segundo programa para los modelos de Blender: comparte el fragment
  // shader (misma luz y niebla) pero recibe la matriz modelo completa
  // (posición + yaw + tilt + jerarquía del nodo) en vez de
  // origin/size/yaw. La normal se transforma con la matriz modelo y se
  // normaliza, como el shader principal hace con normal/size.
  const VS_MODEL = `
attribute vec3 position; attribute vec3 normal;
uniform mat4 uModel;
uniform vec2 camera, viewport; uniform float cameraYaw, pitch, scale, centerY;
varying mediump vec3 surfaceNormal;
varying mediump vec3 worldPosition;
void main(){
 vec4 wp=uModel*vec4(position,1.0);
 worldPosition=wp.xyz;
 surfaceNormal=normalize(mat3(uModel)*normal);
 vec3 p=wp.xyz;
 vec2 d=p.xz-camera;float f=d.x*sin(cameraYaw)+d.y*cos(cameraYaw);
 float r=-d.x*cos(cameraYaw)+d.y*sin(cameraYaw);
 float u=p.y*cos(pitch)+f*sin(pitch);
 float depth=f*cos(pitch)-p.y*sin(pitch);
 gl_Position=vec4(r*scale*2.0/viewport.x,(viewport.y/2.0-centerY+u*scale)*2.0/viewport.y,depth/600.0,1.0);
}`;
  // Tanque Tan: amarillo vivo/tostado, distinto del verde del jugador
  // y del caqui de la infantería Tan ([0.77, 0.62, 0.36]). Las orugas
  // son marrón tostado oscuro y la banda de la torreta, rojiza.
  const TAN_TANK_BODY = [0.95, 0.76, 0.2],
    TAN_TANK_DARK = [0.45, 0.32, 0.12],
    TAN_TANK_STRIPE = [0.55, 0.25, 0.1];
  function geometry(kind) {
    const data = [];
    const vertex = (p, n) => data.push(...p, ...n);
    if (kind === 'rounded') {
      // Project a subdivided cube onto a box with a rounded 0.16-unit edge.
      const rounded = (p) => {
        const q = p.map((v) => Math.max(-0.84, Math.min(0.84, v))),
          delta = p.map((v, i) => v - q[i]),
          len = Math.hypot(...delta),
          n = delta.map((v) => v / len);
        return [q.map((v, i) => v + n[i] * 0.16), n];
      };
      for (let axis = 0; axis < 3; axis++)
        for (const side of [-1, 1])
          for (let i = 0; i < 6; i++)
            for (let j = 0; j < 6; j++) {
              const point = (u, v) => {
                const p = [0, 0, 0];
                p[axis] = side;
                p[(axis + 1) % 3] = -1 + u / 3;
                p[(axis + 2) % 3] = -1 + v / 3;
                return rounded(p);
              };
              for (const [p, n] of [
                point(i, j),
                point(i + 1, j),
                point(i + 1, j + 1),
                point(i, j),
                point(i + 1, j + 1),
                point(i, j + 1),
              ])
                vertex(p, n);
            }
    } else if (kind === 'box') {
      for (const [n, a, b, c, d] of [
        [
          [0, 1, 0],
          [-1, 1, -1],
          [-1, 1, 1],
          [1, 1, 1],
          [1, 1, -1],
        ],
        [
          [0, -1, 0],
          [-1, -1, 1],
          [-1, -1, -1],
          [1, -1, -1],
          [1, -1, 1],
        ],
        [
          [1, 0, 0],
          [1, -1, -1],
          [1, 1, -1],
          [1, 1, 1],
          [1, -1, 1],
        ],
        [
          [-1, 0, 0],
          [-1, -1, 1],
          [-1, 1, 1],
          [-1, 1, -1],
          [-1, -1, -1],
        ],
        [
          [0, 0, 1],
          [-1, -1, 1],
          [1, -1, 1],
          [1, 1, 1],
          [-1, 1, 1],
        ],
        [
          [0, 0, -1],
          [1, -1, -1],
          [-1, -1, -1],
          [-1, 1, -1],
          [1, 1, -1],
        ],
      ])
        for (const p of [a, b, c, a, c, d]) vertex(p, n);
    } else {
      const point = (i, j) => {
        const a = (i * Math.PI) / 10,
          b = (j * Math.PI * 2) / 16;
        return [
          Math.sin(a) * Math.cos(b),
          Math.cos(a),
          Math.sin(a) * Math.sin(b),
        ];
      };
      for (let i = 0; i < 10; i++)
        for (let j = 0; j < 16; j++)
          for (const p of [
            point(i, j),
            point(i + 1, j),
            point(i + 1, j + 1),
            point(i, j),
            point(i + 1, j + 1),
            point(i, j + 1),
          ])
            vertex(p, p);
    }
    return new Float32Array(data);
  }
  class ToyRenderer {
    constructor(canvas, onLost, onRestored) {
      this.canvas = canvas;
      this.world = ToyWorld;
      this.gl =
        canvas.getContext('webgl', { alpha: false, antialias: true }) ||
        canvas.getContext('experimental-webgl', {
          alpha: false,
          antialias: false,
        });
      if (!this.gl) throw new Error('WebGL no disponible');
      this.lost = false;
      this.loader = GltfLoader;
      this.modelHeli = null;
      this.modelTank = null;
      this._fetchTried = false;
      this.drawCalls = 0;
      this.init();
      this.initModels();
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.lost = true;
        onLost();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        try {
          this.init();
          this.lost = false;
          onRestored();
        } catch (e) {
          onLost();
        }
      });
    }
    init() {
      const gl = this.gl;
      const shader = (type, source) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, source);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(sh);
          gl.deleteShader(sh);
          throw Error(error);
        }
        return sh;
      };
      const vs = shader(gl.VERTEX_SHADER, VS),
        fs = shader(gl.FRAGMENT_SHADER, FS),
        vsModel = shader(gl.VERTEX_SHADER, VS_MODEL),
        program = gl.createProgram(),
        modelProgram = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      // El mismo fragment shader sirve para los dos programas (misma
      // luz y niebla): se enlaza en ambos antes de borrarlo.
      gl.attachShader(modelProgram, vsModel);
      gl.attachShader(modelProgram, fs);
      gl.linkProgram(modelProgram);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteShader(vsModel);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(program));
      if (!gl.getProgramParameter(modelProgram, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(modelProgram));
      this.program = program;
      this.modelProgram = modelProgram;
      this.modelLoc = {};
      for (const name of [
        'uModel',
        'camera',
        'viewport',
        'cameraYaw',
        'pitch',
        'scale',
        'centerY',
        'color',
        'gloss',
        'eyeDirection',
        'alpha',
      ])
        this.modelLoc[name] = gl.getUniformLocation(modelProgram, name);
      this.modelPosition = gl.getAttribLocation(modelProgram, 'position');
      this.modelNormal = gl.getAttribLocation(modelProgram, 'normal');
      this.loc = {};
      for (const name of [
        'tiltPivot',
        'tiltAngle',
        'tiltYaw',
        'origin',
        'size',
        'yaw',
        'camera',
        'viewport',
        'cameraYaw',
        'pitch',
        'scale',
        'centerY',
        'color',
        'gloss',
        'eyeDirection',
        'alpha',
      ])
        this.loc[name] = gl.getUniformLocation(program, name);
      this.position = gl.getAttribLocation(program, 'position');
      this.normal = gl.getAttribLocation(program, 'normal');
      this.meshes = {};
      for (const kind of ['box', 'sphere', 'rounded']) {
        const data = geometry(kind),
          buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        this.meshes[kind] = { buffer, count: data.length / 6 };
      }
      this.setWorld(this.world, true);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      // Transparencia para explosiones, humo y portal: sin esto toda
      // esfera era opaca por construcción (la grabación mostraba
      // globos sólidos). Las piezas translúcidas no escriben en el
      // búfer de profundidad (ver part()), para no tapar lo que va detrás.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.27, 0.36, 0.23, 1);
      this.boundMesh = null;
      // Al perder el contexto los buffers GPU del modelo quedan
      // inválidos: se recrean (una sola vez por modelo) al volver a
      // dibujar. Los modelos parseados (CPU) se conservan.
      this.modelGpu = new WeakMap();
      this._modelBound = null;
      if (!this._view)
        this._view = {
          camera: [0, 0],
          viewport: [390, 844],
          cameraYaw: 0,
          pitch: Math.PI / 3,
          scale: 1,
          centerY: 0,
          eyeDirection: [0, 0, -1],
        };
    }
    // Modelos de Blender desde los datos embebidos
    // (src/modelo-helicoptero.js / src/modelo-tanque.js, generados con
    // `node scripts/embed-gltf.cjs`): sin red y funcionando desde
    // `file://`. Si faltan o el parseo falla, el modelo queda en null
    // y el juego sigue con el procedural de antes (ver drawModel y
    // _fetchModels).
    initModels() {
      this.modelHeli = null;
      this.modelTank = null;
      if (!this.loader) return;
      try {
        if (root.ToyModeloHelicoptero)
          this.modelHeli = this.loader.parse(root.ToyModeloHelicoptero);
      } catch (e) {
        this.modelHeli = null;
      }
      try {
        if (root.ToyModeloTanque)
          this.modelTank = this.loader.parse(root.ToyModeloTanque);
      } catch (e) {
        this.modelTank = null;
      }
    }
    // Respaldo por red (GitHub Pages): solo si falta algún modelo y
    // hay fetch disponible; se intenta una sola vez por sesión y los
    // fallos se tragan: el juego nunca se rompe por esto.
    _fetchModels() {
      if (this._fetchTried || (this.modelHeli && this.modelTank)) return;
      this._fetchTried = true;
      const fetchFn = root && root.fetch;
      if (!this.loader || typeof fetchFn !== 'function') return;
      const self = this;
      const jobs = [
        ['assets/helicoptero.gltf', 'modelHeli'],
        ['assets/tanque-tan.gltf', 'modelTank'],
      ];
      for (const [url, key] of jobs) {
        if (self[key]) continue;
        fetchFn(url)
          .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then((g) => {
            try {
              self[key] = self.loader.parse(g);
            } catch (e) {
              self[key] = null;
            }
          })
          .catch(() => {});
      }
    }
    // Fusiona todas las primitivas del modelo en UN solo buffer de
    // posiciones, UNO de normales y UNO de índices por modelo (con
    // desplazamiento por primitiva). Se crea una sola vez por modelo
    // y se comparte entre todas las instancias: los 9 tanques dibujan
    // los mismos 3 buffers, sin crear ni enlazar nada por tanque.
    _prepareModel(model) {
      if (!model || !model.drawList || !model.drawList.length) return null;
      const cached = this.modelGpu.get(model);
      if (cached) return cached;
      const gl = this.gl;
      let totalVerts = 0,
        totalIdx = 0;
      for (const p of model.drawList) {
        totalVerts += p.positions.length / 3;
        totalIdx += p.indices.length;
      }
      const positions = new Float32Array(totalVerts * 3),
        normals = new Float32Array(totalVerts * 3),
        IndexArray = totalVerts < 65536 ? Uint16Array : Uint32Array,
        indices = new IndexArray(totalIdx),
        prims = [];
      let vBase = 0,
        iBase = 0;
      for (const p of model.drawList) {
        const n = p.positions.length / 3;
        positions.set(p.positions, vBase * 3);
        normals.set(p.normals, vBase * 3);
        for (let i = 0; i < p.indices.length; i++)
          indices[iBase + i] = p.indices[i] + vBase;
        prims.push({
          nodeIndex: p.nodeIndex,
          materialIndex: p.materialIndex,
          indexOffset: iBase,
          indexCount: p.indices.length,
        });
        vBase += n;
        iBase += p.indices.length;
      }
      const makeBuffer = (target, data) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return buffer;
      };
      const gpu = {
        posBuf: makeBuffer(gl.ARRAY_BUFFER, positions),
        nrmBuf: makeBuffer(gl.ARRAY_BUFFER, normals),
        idxBuf: makeBuffer(gl.ELEMENT_ARRAY_BUFFER, indices),
        indexType:
          IndexArray === Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT,
        indexBytes: IndexArray.BYTES_PER_ELEMENT,
        prims,
        tris: totalIdx / 3,
      };
      this.modelGpu.set(model, gpu);
      return gpu;
    }
    // Dibuja un modelo glTF parseado con su matriz raíz (posición +
    // yaw + tilt + jerarquía). Devuelve false si no hay modelo o
    // cargador: el llamador usa entonces el procedural de antes.
    // `flash` pinta todo de blanco, como el destello de daño
    // procedural. Al salir restaura el programa principal y marca la
    // caché de malla como inválida (los punteros ahora apuntan a los
    // buffers del modelo).
    drawModel(model, rootMatrix, opts) {
      const options = opts || {};
      if (!model || !this.loader || !this.modelProgram) return false;
      const gpu = this._prepareModel(model);
      if (!gpu) return false;
      const gl = this.gl,
        L = this.loader,
        mats = L.nodeWorldMatrices(model, {
          rotorAngle: options.rotorAngle || 0,
          turretAngle: options.turretAngle || 0,
        }),
        v = this._view,
        u = this.modelLoc;
      gl.useProgram(this.modelProgram);
      gl.uniform2f(u.camera, v.camera[0], v.camera[1]);
      gl.uniform2f(u.viewport, v.viewport[0], v.viewport[1]);
      gl.uniform1f(u.cameraYaw, v.cameraYaw);
      gl.uniform1f(u.pitch, v.pitch);
      gl.uniform1f(u.scale, v.scale);
      gl.uniform1f(u.centerY, v.centerY);
      gl.uniform3f(u.eyeDirection, v.eyeDirection[0], v.eyeDirection[1], v.eyeDirection[2]);
      // Los 3 buffers del modelo se enlazan una sola vez mientras no
      // cambien: ni por primitiva ni por instancia (9 tanques seguidos
      // reutilizan los mismos punteros). part() invalida esta caché
      // al enlazar sus propios buffers.
      if (this._modelBound !== gpu) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.posBuf);
        gl.enableVertexAttribArray(this.modelPosition);
        gl.enableVertexAttribArray(this.modelNormal);
        gl.vertexAttribPointer(this.modelPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.nrmBuf);
        gl.vertexAttribPointer(this.modelNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.idxBuf);
        this._modelBound = gpu;
      }
      for (const prim of gpu.prims) {
        const world = L.mat4Multiply(rootMatrix, mats[prim.nodeIndex]);
        gl.uniformMatrix4fv(u.uModel, false, world);
        const mat =
          prim.materialIndex >= 0
            ? model.materials[prim.materialIndex]
            : model.defaultMaterial;
        gl.uniform3fv(u.color, options.flash ? [1, 1, 1] : mat.color);
        gl.uniform1f(u.gloss, 0.6);
        gl.uniform1f(u.alpha, mat.alpha === undefined ? 1 : mat.alpha);
        gl.drawElements(
          gl.TRIANGLES,
          prim.indexCount,
          gpu.indexType,
          prim.indexOffset * gpu.indexBytes,
        );
        this.drawCalls = (this.drawCalls || 0) + 1;
      }
      gl.useProgram(this.program);
      this.boundMesh = null;
      return true;
    }
    // Matriz raíz del helicóptero del jugador: traslación + tilt
    // (rotación `pitch` alrededor del eje de `yaw`, con pivote en el
    // centro, igual que el shader principal) + yaw del juego + π
    // (el morro del modelo apunta a -Z, el procedural a +Z).
    _heliRootMatrix(x, y, z, yaw, pitch) {
      const L = this.loader,
        tilt = L.mat4Multiply(
          L.mat4RotationY(yaw),
          L.mat4Multiply(L.mat4RotationX(pitch), L.mat4RotationY(-yaw)),
        );
      return L.mat4Multiply(
        L.mat4Translation(x, y, z),
        L.mat4Multiply(tilt, L.mat4RotationY(yaw + L.NOSE_YAW_OFFSET)),
      );
    }
    tryDrawHeliModel(x, y, z, yaw, rot, pitch, flash) {
      if (!this.loader || !this.modelHeli) return false;
      return this.drawModel(
        this.modelHeli,
        this._heliRootMatrix(x, y, z, yaw, pitch || 0),
        { rotorAngle: rot, flash: !!flash },
      );
    }
    // Matriz raíz del tanque Tan: posición sobre el suelo, yaw del
    // tanque + π (morro del modelo a -Z). La torreta gira 0 respecto
    // al casco porque el `yaw` del tanque ya es la dirección de
    // puntería (hacia el jugador); el mecanismo de giro existe igual
    // (turretAngle) para probarlo y usarlo luego.
    tryDrawTankModel(e, yaw) {
      if (!this.loader || !this.modelTank) return false;
      const ground = this.world ? this.world.height(e.x, e.z) : 0,
        L = this.loader,
        rootMat = L.mat4Multiply(
          L.mat4Translation(e.x, ground, e.z),
          L.mat4RotationY(yaw + L.NOSE_YAW_OFFSET),
        );
      return this.drawModel(this.modelTank, rootMat, {
        turretAngle: 0,
        flash: e.fl > 0,
      });
    }
    setWorld(world, restoring = false) {
      this.world = world;
      if (!world || (this.lost && !restoring)) return;
      const gl = this.gl,
        data = world.mesh();
      if (this.meshes.terrain && gl.deleteBuffer)
        gl.deleteBuffer(this.meshes.terrain.buffer);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      this.meshes.terrain = { buffer, count: data.length / 6 };
      // setWorld cambia el buffer enlazado: la caché de malla queda inválida.
      this.boundMesh = null;
    }
    part(kind, x, y, z, sx, sy, sz, color, yaw = 0, gloss = 0.6, alpha = 1) {
      const gl = this.gl,
        m = this.meshes[kind],
        u = this.loc;
      // Las piezas consecutivas del mismo tipo (escombros, humo, trazadoras)
      // reutilizan el buffer y los punteros ya enlazados: en una escena con
      // ~900 dibujos por frame eso ahorra varias llamadas GL por pieza.
      if (this.boundMesh !== kind) {
        gl.bindBuffer(gl.ARRAY_BUFFER, m.buffer);
        gl.enableVertexAttribArray(this.position);
        gl.enableVertexAttribArray(this.normal);
        gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(this.normal, 3, gl.FLOAT, false, 24, 12);
        this.boundMesh = kind;
        // Los punteros ya no apuntan a los buffers del modelo.
        this._modelBound = null;
      }
      gl.uniform3f(u.origin, x, y + (this.groundOffset || 0), z);
      gl.uniform3f(u.size, sx, sy, sz);
      gl.uniform1f(u.yaw, yaw);
      gl.uniform3fv(u.color, color);
      gl.uniform1f(u.gloss, gloss);
      gl.uniform1f(u.alpha, alpha);
      // Una pieza translúcida que escribiera profundidad taparía
      // como un sólido lo que se dibuja después detrás de ella.
      if (alpha < 1) gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
      if (alpha < 1) gl.depthMask(true);
      this.drawCalls++;
    }
    // Altura de la superficie visible bajo (x, z): el terreno, o la
    // parte superior de un camino (0,14) o de un helipuerto (0,23 fuera,
    // 0,31 dentro) cuando el punto cae sobre ellos. La sombra del
    // helicóptero debe apoyarse sobre esa superficie, no sobre el
    // terreno: antes usaba solo la altura del terreno y quedaba
    // enterrada bajo el camino, así que solo asomaba su borde fuera
    // de él y parecía desplazada por debajo del camino.
    surfaceTop(x, z) {
      const world = this.world;
      let top = world ? world.height(x, z) : 0;
      if (!world) return top;
      for (const r of world.roads || []) {
        const dx = x - r.x,
          dz = z - r.z,
          c = Math.cos(r.yaw),
          s = Math.sin(r.yaw),
          // Coordenadas locales del camino (medio ancho r.halfWidth,
          // 15 en el mundo; 5 en mundos viejos sin ese campo).
          lx = dx * c - dz * s,
          lz = dx * s + dz * c;
        if (Math.abs(lx) <= (r.halfWidth || 5) && Math.abs(lz) <= r.length) {
          top = Math.max(top, r.y + 0.04);
          break;
        }
      }
      for (const site of world.pads || []) {
        const dx = Math.abs(x - site.x),
          dz = Math.abs(z - site.z);
        if (dx <= 7 && dz <= 7) top = Math.max(top, 0.31);
        else if (dx <= 8 && dz <= 8) top = Math.max(top, 0.23);
      }
      return top;
    }
    helicopter(
      x,
      y,
      z,
      yaw,
      rot,
      tan = false,
      flash = false,
      detached = false,
      pitch = 0,
    ) {
      const col = flash
          ? [1, 1, 1]
          : tan
            ? [0.76, 0.6, 0.32]
            : [0.22, 0.59, 0.13],
        dark = tan ? [0.35, 0.27, 0.12] : [0.1, 0.29, 0.07];
      const p = (kind, lx, ly, lz, sx, sy, sz, c = col, angle = 0) =>
        this.part(
          kind,
          x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
          y + ly,
          z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
          sx,
          sy,
          sz,
          c,
          yaw + angle,
        );
      // Sombra de contacto sobre la superficie visible justo debajo del
      // helicóptero (camino, helipuerto o terreno), centrada en su (x, z):
      // con la cámara oblicua, un punto del suelo bajo el helicóptero se
      // proyecta desplazado en pantalla, pero la sombra en sí no se
      // desplaza en el mundo. Se encoge con la altitud (más alto, más
      // pequeña) y queda 0,01–0,09 u por encima de la superficie para
      // que el búfer de profundidad no la tape el camino.
      const ground = this.surfaceTop(x, z),
        altitude = Math.max(0, y - ground),
        shadowScale = Math.max(0.7, 1 - altitude * 0.02);
      this.groundOffset = 0;
      this.part(
        'sphere',
        x,
        ground + 0.05,
        z,
        3.4 * shadowScale,
        0.04,
        2.5 * shadowScale,
        [0.23, 0.3, 0.18],
        yaw,
        0,
      );
      // Rotate the entire model around its center; its ground shadow stays flat.
      this.gl.uniform3f(this.loc.tiltPivot, x, y, z);
      this.gl.uniform1f(this.loc.tiltYaw, yaw);
      this.gl.uniform1f(this.loc.tiltAngle, pitch);
      if (!tan) {
        // Helicóptero del jugador: modelo de Blender (rev. 3) con el
        // rotor girando (`rot`). Si no hay modelo (sin datos
        // embebidos, parseo roto o sin red), el procedural de antes.
        // El helicóptero enemigo Tan sigue procedural: no hay modelo
        // Tan del helicóptero enemigo.
        if (this.tryDrawHeliModel(x, y, z, yaw, rot, pitch, flash)) {
          this.gl.uniform1f(this.loc.tiltAngle, 0);
          return;
        }
        for (const a of PlayerModel.parts(rot, flash))
          p(a.kind, a.x, a.y, a.z, a.sx, a.sy, a.sz, a.color, a.yaw);
        this.gl.uniform1f(this.loc.tiltAngle, 0);
        return;
      }
      p('sphere', 0, 0, 0, 1.7, 1.35, 2.6);
      // Raised center seam, engine vents and recessed screw caps read as molded toys.
      p('rounded', 0, 1.32, 0.35, 0.045, 0.035, 1.4, dark);
      for (const side of [-1, 1]) {
        p('sphere', side * 1.62, 0.1, -0.4, 0.055, 0.16, 0.16, dark);
        p('box', side * 1.68, 0.1, -0.4, 0.018, 0.025, 0.095, col);
        for (let i = 0; i < 3; i++)
          p(
            'rounded',
            side * 0.48,
            1.65,
            -1.05 + i * 0.32,
            0.26,
            0.05,
            0.06,
            dark,
          );
      }
      if (!detached)
        p('sphere', 0, 0.25, 1.7, 1.43, 0.95, 1.15, [0.08, 0.23, 0.25]);
      p('box', 0, 0.5, 2.25, 0.09, 0.8, 0.2);
      p('rounded', 0, 0.15, -3.6, 0.23, 0.25, 2.2);
      p('box', 0, 0.7, -5.2, 1.25, 0.12, 0.45);
      p('rounded', 0, 1.1, -5.5, 0.15, 0.9, 0.45);
      p('sphere', 0, 1.1, -0.7, 0.8, 0.7, 1.3);
      for (const side of [-1, 1]) {
        p('box', side * 1.8, -1.4, 0, 0.16, 0.14, 2.5, dark);
        p('box', side * 1.4, -0.8, 0.8, 0.13, 0.7, 0.13, dark);
        p('box', side * 1.4, -0.8, -1.1, 0.13, 0.7, 0.13, dark);
        p('rounded', side * 1.9, -0.2, 0.8, 0.22, 0.25, 1.4, dark);
      }
      p('box', 0, 2, 0, 0.15, 0.6, 0.15, dark);
      p('box', 0, 2.6, 0, 5.6, 0.055, 0.17, dark, rot);
      p('box', 0, 2.6, 0, 0.17, 0.055, 5.6, dark, rot);
      this.gl.uniform1f(this.loc.tiltAngle, 0);
    }
    soldier(x, y, z, friendly, yaw = 0, waiting = false) {
      const col = friendly ? [0.24, 0.65, 0.16] : [0.77, 0.62, 0.36],
        dark = friendly ? [0.1, 0.32, 0.07] : [0.42, 0.34, 0.18];
      this.part('sphere', x, y + 0.12, z, 1.2, 0.13, 0.9, col, yaw);
      for (const side of [-1, 1])
        this.part(
          'rounded',
          x + side * 0.38,
          y + 0.65,
          z,
          0.23,
          0.6,
          0.3,
          col,
          yaw,
        );
      this.part('rounded', x, y + 1.8, z, 0.65, 0.65, 0.4, col, yaw);
      this.part('sphere', x, y + 2.8, z, 0.51, 0.5, 0.5, col);
      this.part('sphere', x, y + 3.05, z, 0.65, 0.32, 0.6, col);
      this.part('rounded', x + 0.85, y + 1.9, z, 0.2, 0.6, 0.2, col);
      this.part('box', x - 0.8, y + 1.6, z + 0.3, 0.12, 0.65, 0.12, dark);
      if (waiting) {
        this.part(
          'box',
          x,
          y + 4.3,
          z,
          0.7,
          0.13,
          0.13,
          [0.95, 0.89, 0.36],
          0,
          0,
        );
        this.part(
          'box',
          x,
          y + 4.3,
          z,
          0.13,
          0.7,
          0.13,
          [0.95, 0.89, 0.36],
          0,
          0,
        );
      }
    }
    // Tren Prego (Misión 3): locomotora verde con chimenea, ténder
    // con carbón, vagón plano con el tanque de batalla verde y vagón
    // cerrado; ~21,5 u de largo (morro a +12, cola a −9,5), sobre la
    // vía. El `yaw` es la dirección de marcha (el de la vía).
    train(x, z, yaw = 0) {
      const green = [0.24, 0.65, 0.16],
        darkGreen = [0.18, 0.5, 0.12],
        dark = [0.15, 0.15, 0.13];
      this.groundOffset = this.world ? this.world.height(x, z) : 0;
      const p = (kind, lx, ly, lz, sx, sy, sz, color, gloss = 0.6) =>
        this.part(
          kind,
          x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
          ly,
          z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
          sx,
          sy,
          sz,
          color,
          yaw,
          gloss,
        );
      // Sombra alargada bajo todo el tren.
      p('sphere', 0, 0.13, 1, 3, 0.16, 11, [0.25, 0.22, 0.18], 0);
      // Locomotora: cuerpo, cabina y chimenea negra.
      p('box', 0, 1.8, 8, 1.6, 1.8, 4, green);
      p('box', 0, 2.2, 4.5, 1.8, 2.2, 2.5, darkGreen);
      p('box', 0, 4.2, 11, 0.4, 1.2, 0.4, dark);
      // Ténder con carbón.
      p('box', 0, 1.2, 1, 1.6, 1.2, 3, darkGreen);
      p('sphere', 0, 2, 1, 1.2, 0.5, 1.2, dark, 0);
      // Vagón plano con el tanque de batalla verde encima.
      p('box', 0, 0.5, -3.5, 1.7, 0.5, 4, [0.5, 0.38, 0.2]);
      p('rounded', 0, 1.5, -3.5, 1.2, 0.8, 2, green);
      p('sphere', 0, 2.4, -3.5, 0.7, 0.5, 0.7, green, 0);
      p('box', 0, 2.4, -1.8, 0.15, 0.15, 1.2, dark);
      // Vagón cerrado con techo.
      p('box', 0, 1.8, -7.5, 1.7, 1.8, 3.5, [0.2, 0.55, 0.14]);
      p('box', 0, 2.8, -7.5, 1.8, 0.3, 3.6, darkGreen);
      // Ruedas a ambos lados.
      for (const wz of [10, 6, 2, -1, -5, -8])
        for (const side of [-1.5, 1.5])
          p('box', side, 0.4, wz, 0.3, 0.4, 0.8, dark);
    }
    landmark(prop, y) {
      const { x, z, yaw, kind } = prop,
        p = (mesh, lx, ly, lz, sx, sy, sz, color, gloss = 0.2) =>
          this.part(
            mesh,
            x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
            y + ly,
            z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
            sx,
            sy,
            sz,
            color,
            yaw,
            gloss,
          );
      if (kind === 'pencil') {
        p('rounded', 0, 1.3, 0, 1.25, 1.25, 15, [0.85, 0.62, 0.15]);
        p('rounded', 0, 1.3, -16, 1.3, 1.3, 1.5, [0.68, 0.32, 0.32]);
        p('box', 0, 1.3, -14.5, 1.3, 1.3, 0.4, [0.65, 0.66, 0.58]);
        p('sphere', 0, 1.3, 16, 1.1, 1.1, 2.7, [0.76, 0.61, 0.37], 0);
        p('sphere', 0, 1.3, 18.4, 0.35, 0.35, 0.6, [0.13, 0.15, 0.13], 0);
        for (let i = -10; i <= 8; i += 3)
          p('box', -0.55, 2.55, i, 0.12, 0.02, 0.65, [0.32, 0.3, 0.14], 0);
      } else if (kind === 'spool') {
        p('sphere', 0, 1, 0, 7, 0.8, 7, [0.72, 0.59, 0.36], 0);
        p('sphere', 0, 4, 0, 4, 3.3, 4, [0.34, 0.54, 0.61], 0);
        for (let i = 0; i < 5; i++)
          p(
            'sphere',
            0,
            2 + i * 0.85,
            0,
            4.2,
            0.15,
            4.2,
            [0.46, 0.64, 0.66],
            0,
          );
        p('sphere', 0, 7.3, 0, 7, 0.8, 7, [0.72, 0.59, 0.36], 0);
        p('sphere', 0, 8, 0, 1, 0.08, 1, [0.24, 0.22, 0.16], 0);
      } else {
        p('rounded', 0, 0.9, 0, 4, 0.9, 8, [0.83, 0.79, 0.64]);
        p('box', 0, 1.82, 0, 3.7, 0.025, 0.08, [0.18, 0.22, 0.19], 0);
        for (const [dx, dz] of [
          [-2, -5],
          [0, -3],
          [2, -1],
          [-2, 3],
          [2, 3],
          [-2, 6],
          [2, 6],
        ])
          p('sphere', dx, 1.84, dz, 0.5, 0.045, 0.5, [0.15, 0.19, 0.17], 0);
      }
    }
    render(scene) {
      if (this.lost) return false;
      // Si falta algún modelo, se intenta la descarga por red (una
      // sola vez); sin ella, el juego sigue procedural.
      this._fetchModels();
      const { W, H, F, HY, cam, PITCH, P, E, DC, BL, EB, MS, FX, SM = [], PK, rot } =
          scene,
        gl = this.gl,
        u = this.loc;
      // Nivel de degradado 2: se dibuja la mitad de escombros y de humo.
      const stride = (scene.perfLevel || 0) >= 2 ? 2 : 1;
      const d = Math.min(
          root.devicePixelRatio || 1,
          scene.pixelRatio || 1.75,
        ),
        width = Math.round(W * d),
        height = Math.round(H * d);
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      this.drawCalls = 0;
      gl.uniform2f(u.camera, cam.x, cam.z);
      gl.uniform2f(u.viewport, W, H);
      gl.uniform1f(u.cameraYaw, cam.yaw);
      gl.uniform1f(u.pitch, PITCH);
      gl.uniform1f(u.scale, F);
      gl.uniform1f(u.centerY, HY);
      gl.uniform3f(
        u.eyeDirection,
        -Math.sin(cam.yaw) * Math.cos(PITCH),
        Math.sin(PITCH),
        -Math.cos(cam.yaw) * Math.cos(PITCH),
      );
      // La misma cámara para el programa de modelos (drawModel).
      this._view = {
        camera: [cam.x, cam.z],
        viewport: [W, H],
        cameraYaw: cam.yaw,
        pitch: PITCH,
        scale: F,
        centerY: HY,
        eyeDirection: [
          -Math.sin(cam.yaw) * Math.cos(PITCH),
          Math.sin(PITCH),
          -Math.cos(cam.yaw) * Math.cos(PITCH),
        ],
      };
      const world = this.world;
      this.groundOffset = 0;
      // The lower viewing angle and off-center framing expose more distant ground.
      const radius =
          Math.hypot(W / 2, Math.max(HY, H - HY) / Math.sin(PITCH)) / F + 48,
        visible = (o) => Math.hypot(o.x - cam.x, o.z - cam.z) < radius;
      if (world)
        // Prado alpino (Misión 1): verde vivo y saturado, con luz de
        // día soleada (gloss -3, rama propia en el shader). Los demás
        // mapas conservan su verde de siempre (gloss -2).
        this.part(
          'terrain',
          0,
          0,
          0,
          1,
          1,
          1,
          world.alpine ? [0.42, 0.58, 0.22] : [0.39, 0.5, 0.24],
          0,
          world.alpine ? -3 : -2,
        );
      else this.part('box', 0, -1, 0, 200, 1, 200, [0.39, 0.49, 0.25], 0, 0.02);
      // A compact practice clearing, roads and helipad on a cleared central area.
      // Las carreteras cubren todo el mapa: solo se dibujan las cercanas.
      // El camino de tierra se lee como tierra pisada, no como una
      // alfombra lisa ni como un tablero: un solo tono en toda su
      // longitud y una franja central apenas más oscura que marca el
      // desgaste del paso. Antes el tono alternaba cada dos tramos
      // y la franja invertía el contraste, y en la grabación se
      // veía un damero marrón.
      if (world)
        for (let ri = 0; ri < world.roads.length; ri++) {
          const r = world.roads[ri];
          if (Math.hypot(r.x - cam.x, r.z - cam.z) >= radius + r.length)
            continue;
          this.part(
            'box',
            r.x,
            r.y,
            r.z,
            r.halfWidth || 5,
            0.04,
            r.length,
            [0.6, 0.48, 0.3],
            r.yaw,
            -1,
          );
          this.part(
            'box',
            r.x,
            r.y + 0.01,
            r.z,
            (r.halfWidth || 5) * 0.55,
            0.04,
            r.length,
            [0.57, 0.45, 0.28],
            r.yaw,
            -1,
          );
        }
      for (const site of world ? world.pads : [{ x: 0, z: 0, final: false }]) {
        this.part(
          'box',
          site.x,
          0.18,
          site.z,
          8,
          0.05,
          8,
          site.rescue
            ? [0.96, 0.68, 0.25]
            : site.final
              ? [0.57, 0.88, 0.61]
              : [0.84, 0.8, 0.58],
          0,
          0,
        );
        this.part(
          'box',
          site.x,
          0.26,
          site.z,
          7,
          0.05,
          7,
          site.final ? [0.16, 0.4, 0.28] : [0.34, 0.39, 0.29],
          0,
          0.04,
        );
      }
      // Letra del helipuerto (A, B o C): los cubitos sueltos de 5×5
      // se leían como una H pixelada desde la cámara cenital, así
      // que cada fila de píxeles contiguos se dibuja como una sola
      // barra continua: la letra queda con trazos enteros.
      for (const run of padLetterRuns(world?.padMarks || []))
        this.part(
          'box',
          run.x,
          0.36,
          run.z,
          run.sx,
          0.04,
          0.55,
          [0.84, 0.8, 0.58],
          0,
          0,
        );

      // Rocas y objetos del patio cercanos.
      if (world) {
        // Montañas del valle alpino (solo la Misión 1): roca grande
        // gris-marrón clara con cima nevada grande y blanca, como
        // borde del mapa. Cada una varía en altura, anchura y tono,
        // con un pico rocoso encima de la base: no son bolas idénticas.
        for (const m of world.mountains || [])
          if (visible(m)) {
            const y = world.height(m.x, m.z),
              hv =
                Math.abs(
                  Math.sin(m.x * 12.9898 + m.z * 78.233) * 43758.5453,
                ) % 1,
              hFac = 0.5 + hv * 0.25,
              rock = [0.5 + hv * 0.08, 0.47 + hv * 0.07, 0.4 + hv * 0.06];
            this.part(
              'sphere',
              m.x,
              y + m.s * 0.3,
              m.z,
              m.s,
              m.s * hFac,
              m.s * 0.8,
              rock,
              m.x,
              0,
            );
            this.part(
              'sphere',
              m.x + m.s * 0.15,
              y + m.s * (0.3 + hFac * 0.75),
              m.z,
              m.s * 0.55,
              m.s * 0.35,
              m.s * 0.5,
              rock,
              0,
              0,
            );
            this.part(
              'sphere',
              m.x + m.s * 0.15,
              y + m.s * (0.3 + hFac * 0.95),
              m.z,
              m.s * (0.4 + hv * 0.15),
              m.s * 0.22,
              m.s * 0.36,
              [0.96, 0.97, 1.0],
              0,
              0,
            );
          }
        for (const r of world.rocks)
          if (visible(r)) {
            const y = world.height(r.x, r.z);
            this.part(
              'sphere',
              r.x,
              y + r.s * 0.45,
              r.z,
              r.s,
              r.s * 0.65,
              r.s * 0.85,
              [0.38, 0.4, 0.32],
              r.x,
              0,
            );
            this.part(
              'sphere',
              r.x + 2,
              y + 0.45,
              r.z + 1,
              1.3,
              0.6,
              1,
              [0.28, 0.42, 0.17],
              0,
              0,
            );
          }
        for (const p of world.yard || [])
          if (
            Math.hypot(p.x - cam.x, p.z - cam.z) <
            radius + Math.max(p.sx, p.sz)
          )
            this.part(
              p.kind,
              p.x,
              p.y,
              p.z,
              p.sx,
              p.sy,
              p.sz,
              p.color,
              p.yaw,
              0,
              // El portal lleva alfa en sus piezas (halo y columna
              // translúcidos); el resto del patio es opaco (alfa 1).
              p.alpha == null ? 1 : p.alpha,
            );
      }
      // Vías del tren (Misión 3): traviesas y raíles, sin colisión.
      // Las piezas ya traen su altura absoluta (suelo + 0,12/0,3).
      if (world) {
        this.groundOffset = 0;
        for (const p of world.rails || [])
          if (
            Math.hypot(p.x - cam.x, p.z - cam.z) <
            radius + Math.max(p.sx, p.sz)
          )
            this.part(
              p.kind,
              p.x,
              p.y,
              p.z,
              p.sx,
              p.sy,
              p.sz,
              p.color,
              p.yaw,
              0,
            );
      }
      // Tren Prego (Misión 3): en su base, en camino o en C, según
      // la misión (`scene.train` viene de `mission.trainView()`).
      if (scene.train && visible(scene.train)) this.train(scene.train.x, scene.train.z, scene.train.yaw);
      // Carga en el suelo (ver src/toy-world.js): la caja verde de la
      // Misión 1 o la batería de la Misión 3, en el suelo mientras
      // espera el winch o mientras el cable la engancha; cuando
      // cuelga del helicóptero o ya se entregó, no se dibuja aquí: va
      // colgando bajo el helicóptero. La batería está escondida
      // (`hidden`) hasta que cae el helicóptero Tan.
      const cargo = scene.cargo || null;
      const cargoSpot = cargo
        ? { x: cargo.x, z: cargo.z }
        : world.cargoCrate;
      if (
        cargoSpot &&
        visible(cargoSpot) &&
        (!cargo || cargo.state === 'waiting')
      ) {
        this.groundOffset = 0;
        const cx = cargoSpot.x,
          cz = cargoSpot.z,
          cy = world.height(cx, cz);
        if (cargo && cargo.kind === 'battery') {
          // Batería robada: caja oscura con placa y dos bornes
          // amarillos, para que se distinga de la caja verde.
          this.part('box', cx, cy + 0.5, cz, 1.8, 1, 1.8, [0.25, 0.28, 0.35], 0, 0);
          this.part('box', cx, cy + 1.05, cz, 1.9, 0.1, 1.9, [0.35, 0.38, 0.45], 0, 0);
          this.part('box', cx - 0.6, cy + 1.3, cz, 0.3, 0.5, 0.3, [0.95, 0.8, 0.2], 0, 0);
          this.part('box', cx + 0.6, cy + 1.3, cz, 0.3, 0.5, 0.3, [0.95, 0.8, 0.2], 0, 0);
        } else {
          this.part('box', cx, cy + 1.8, cz, 6, 3.6, 6, [0.13, 0.42, 0.14], 0, 0);
          this.part('box', cx, cy + 3.9, cz, 6.5, 0.7, 6.5, [0.18, 0.52, 0.18], 0, 0);
          this.part('box', cx, cy + 4.3, cz, 0.7, 0.3, 6.5, [0.1, 0.1, 0.1], 0, 0);
          this.part('box', cx, cy + 4.3, cz, 6.5, 0.3, 0.7, [0.1, 0.1, 0.1], 0, 0);
        }
        // Marcador flotante sobre la carga que hay que levantar con
        // el winch: en la grabación la caja no se distinguía de los
        // cubos verdes y los escombros del punto B. Flota y sube y
        // baja despacio para llamar la atención sin tapar nada.
        this.part(
          'sphere',
          cx,
          cy + 9 + Math.sin((scene.t || 0) * 2) * 0.6,
          cz,
          0.8,
          0.8,
          0.8,
          [1, 0.85, 0.2],
          0,
          0,
        );
      }
      // Aliados activos una sola vez por frame: la comprobación por arbusto
      // antes creaba un cierre y recorría los aliados en cada arbusto.
      const allies = scene.allies || [];
      for (const d of DC) {
        if (!visible(d)) continue;
        let nearAlly = false;
        for (const a of allies)
          if (
            a.state !== 'rescued' &&
            Math.hypot(a.x - d.x, a.z - d.z) < 7
          ) {
            nearAlly = true;
            break;
          }
        if (
          nearAlly ||
          (world && !world.clearOfLandmarks(d.x, d.z, 3))
        )
          continue;
        this.groundOffset = world ? world.height(d.x, d.z) : 0;
        if (d.t === 'pine') {
          // Pino alpino alto: tronco y cuatro copas cónicas cada vez
          // más estrechas, verde oscuro con variación por árbol, como
          // en el original. Altura total ~3,4× la escala (hasta ~21 u,
          // varias veces el helicóptero).
          const v =
              Math.abs(Math.sin(d.x * 12.9898 + d.z * 78.233) * 43758.5453) %
              1,
            tint = 0.85 + 0.3 * v,
            shade = (g) => [g[0] * tint, g[1] * tint, g[2] * tint];
          this.part(
            'box',
            d.x,
            d.s * 0.7,
            d.z,
            0.55,
            d.s * 1.4,
            0.55,
            [0.33, 0.28, 0.12],
            0,
            0,
          );
          this.part(
            'sphere',
            d.x,
            d.s * 1.45,
            d.z,
            d.s * 1.05,
            d.s * 0.85,
            d.s * 1.0,
            shade([0.13, 0.29, 0.09]),
            0,
            0,
          );
          this.part(
            'sphere',
            d.x,
            d.s * 2.05,
            d.z,
            d.s * 0.78,
            d.s * 0.75,
            d.s * 0.72,
            shade([0.17, 0.35, 0.11]),
            0,
            0,
          );
          this.part(
            'sphere',
            d.x,
            d.s * 2.55,
            d.z,
            d.s * 0.52,
            d.s * 0.6,
            d.s * 0.48,
            shade([0.21, 0.41, 0.13]),
            0,
            0,
          );
          this.part(
            'sphere',
            d.x,
            d.s * 2.95,
            d.z,
            d.s * 0.3,
            d.s * 0.45,
            d.s * 0.28,
            shade([0.25, 0.46, 0.15]),
            0,
            0,
          );
        } else if (d.t === 'shrub') {
          this.part(
            'sphere',
            d.x,
            d.s * 0.65,
            d.z,
            d.s,
            d.s * 0.8,
            d.s * 0.85,
            [0.24, 0.37, 0.12],
            0,
            0,
          );
          this.part(
            'sphere',
            d.x - d.s * 0.4,
            d.s * 1.2,
            d.z,
            d.s * 0.65,
            d.s * 0.65,
            d.s * 0.6,
            [0.32, 0.44, 0.15],
            0,
            0,
          );
        } else if (d.t === 't') {
          this.part('sphere', d.x, 0.12, d.z, 3, 0.12, 3, [0.2, 0.36, 0.12]);
          this.part('box', d.x, 2, d.z, 0.5, 2, 0.5, [0.33, 0.28, 0.12]);
          this.part('sphere', d.x, 5, d.z, 2.7, 3.7, 2.7, [0.18, 0.42, 0.12]);
          this.part(
            'sphere',
            d.x - 0.4,
            7.5,
            d.z,
            1.9,
            2.8,
            1.9,
            [0.26, 0.49, 0.15],
          );
        } else {
          const color =
            d.c === '#d9473f'
              ? [0.73, 0.24, 0.16]
              : d.c === '#3f7fd9'
                ? [0.2, 0.4, 0.65]
                : [0.78, 0.62, 0.2];
          this.part(
            'rounded',
            d.x,
            d.s / 2,
            d.z,
            d.s / 2,
            d.s / 2,
            d.s / 2,
            color,
          );
          for (const side of [-1, 1])
            this.part(
              'sphere',
              d.x + side * d.s * 0.22,
              d.s,
              d.z,
              d.s * 0.16,
              0.3,
              d.s * 0.16,
              color,
            );
        }
      }
      this.groundOffset = 0;
      for (let di = 0; di < (scene.DB || []).length; di += stride) {
        const d = scene.DB[di];
        if (visible(d)) {
          this.part(
            d.kind,
            d.x,
            d.y,
            d.z,
            d.sx,
            d.sy,
            d.sz,
            d.color,
            d.yaw,
            0.85,
          );
        }
      }
      for (const e of E) {
        if (!visible(e)) continue;
        this.groundOffset = 0;
        for (let i = 0; i < (e.chips || 0); i++) {
          const y =
            e.y +
            (e.k === 'heli'
              ? 1.3
              : e.k === 'base'
                ? 5.82
                : e.k === 'inf'
                  ? 2.5
                  : 3.3);
          this.part(
            'box',
            e.x + ((i % 3) - 1) * 0.55,
            y,
            e.z + (i % 2) * 0.5,
            0.38,
            0.04,
            0.24,
            [0.91, 0.77, 0.5],
            i * 0.9,
          );
          this.part(
            'box',
            e.x + ((i % 3) - 1) * 0.55,
            y + 0.045,
            e.z + (i % 2) * 0.5,
            0.26,
            0.025,
            0.17,
            [0.35, 0.27, 0.13],
            i * 0.9,
          );
        }
        // Color propio por tipo: el tanque Tan es amarillo vivo /
        // tostado (TAN_TANK), bien distinto del verde del jugador y
        // del caqui de la infantería y las torretas Tan. Su vida y
        // su daño no cambian: solo el color y la silueta.
        const isTank = e.k === 'tank',
          col = e.fl > 0
            ? [1, 1, 1]
            : isTank
              ? TAN_TANK_BODY
              : [0.76, 0.61, 0.36],
          dark = isTank ? TAN_TANK_DARK : [0.39, 0.31, 0.17],
          // Los coches y los garajes traen su propio `yaw` (el coche,
          // hacia dónde avanza; el garaje, hacia el circuito); los
          // demás miran al jugador, como siempre.
          yaw = e.yaw ?? (P ? Math.atan2(P.x - e.x, P.z - e.z) : 0);
        if (e.k === 'inf') {
          this.groundOffset = 0;
          this.soldier(e.x, e.y, e.z, false, yaw);
          continue;
        }
        if (e.k === 'heli') {
          this.groundOffset = 0;
          this.helicopter(e.x, e.y, e.z, yaw, rot, true, e.fl > 0, e.detached);
          continue;
        }
        if (e.k === 'garage') {
          // Garaje Tan (Misión 2): nave grande color ladrillo con
          // puerta oscura hacia el circuito y dintel amarillo, para
          // que se lea como garaje y no como base. El `yaw` apunta al
          // vértice del circuito al que se incorporan sus coches.
          this.groundOffset = world ? world.height(e.x, e.z) : 0;
          this.part('sphere', e.x, 0.13, e.z, 7, 0.16, 5.5, [0.25, 0.22, 0.18], yaw);
          const gp = (lx, lz) => ({
            x: e.x + Math.sin(yaw) * lz + Math.cos(yaw) * lx,
            z: e.z + Math.cos(yaw) * lz - Math.sin(yaw) * lx,
          });
          this.part('box', e.x, 3, e.z, 6, 3, 4, [0.62, 0.48, 0.25], yaw);
          this.part('box', e.x, 6.4, e.z, 6.2, 0.4, 4.2, [0.45, 0.35, 0.18], yaw);
          const door = gp(0, 4);
          this.part('box', door.x, 2, door.z, 2, 2, 0.15, [0.2, 0.18, 0.12], yaw);
          this.part('box', door.x, 4.5, door.z, 2.2, 0.4, 0.15, [0.85, 0.7, 0.3], yaw);
          for (const side of [-3.5, 3.5]) {
            const w = gp(side, 4);
            this.part('box', w.x, 4, w.z, 0.8, 0.8, 0.15, [0.3, 0.35, 0.4], yaw);
          }
          continue;
        }
        if (e.k === 'car') {
          // Coche de suministros Tan (Misión 2): carrocería amarilla
          // Tan, cabina caqui y caja de suministros marrón; avanza
          // por el circuito hacia el portal. Su `yaw` es la dirección
          // de marcha.
          this.groundOffset = world ? world.height(e.x, e.z) : 0;
          this.part('sphere', e.x, 0.13, e.z, 2.6, 0.16, 1.9, [0.25, 0.22, 0.18], yaw);
          this.part('rounded', e.x, 0.6, e.z, 1.1, 0.6, 2.2, [0.95, 0.76, 0.2], yaw);
          const cab = {
              x: e.x + Math.sin(yaw) * -0.3,
              z: e.z + Math.cos(yaw) * -0.3,
            },
            box = {
              x: e.x + Math.sin(yaw) * 0.9,
              z: e.z + Math.cos(yaw) * 0.9,
            };
          this.part('box', cab.x, 1.4, cab.z, 0.9, 0.5, 1.0, [0.76, 0.61, 0.36], yaw);
          this.part('box', box.x, 1.3, box.z, 1.0, 0.5, 1.0, [0.62, 0.48, 0.25], yaw);
          for (const [lx, lz] of [
            [-1.0, -1.2],
            [1.0, -1.2],
            [-1.0, 1.2],
            [1.0, 1.2],
          ])
            this.part(
              'box',
              e.x + Math.sin(yaw) * lz + Math.cos(yaw) * lx,
              0.3,
              e.z + Math.cos(yaw) * lz - Math.sin(yaw) * lx,
              0.25,
              0.25,
              0.4,
              [0.15, 0.15, 0.13],
              yaw,
            );
          continue;
        }
        this.groundOffset = world ? world.height(e.x, e.z) : 0;
        if (e.k !== 'heli')
          this.part(
            'sphere',
            e.x,
            0.13,
            e.z,
            e.k === 'base' ? 6.4 : 3.6,
            0.16,
            e.k === 'base' ? 5.6 : 4.1,
            // La base del tanque es su oruga oscura, no un charco amarillo.
            isTank ? dark : col,
          );
        // Tanque Tan: modelo de Blender (rev. 3) en vez del procedural.
        // La elipse oscura del suelo de arriba se conserva; si no hay
        // modelo, cae al dibujado procedural de abajo. Los pecios de
        // tanque destruido siguen siendo los de src/debris.js.
        if (isTank && this.tryDrawTankModel(e, yaw)) continue;
        if (e.k === 'base') {
          this.part('rounded', e.x, 2.5, e.z, 5, 2.5, 4, col);
          if (!e.detached) this.part('box', e.x, 5.4, e.z, 5.5, 0.4, 4.5, col);
          this.part('box', e.x, 1.4, e.z + 4.02, 1.1, 1.4, 0.08, dark);
          this.part('box', e.x + 4, 10, e.z, 0.13, 5, 0.13, col);
          this.part('box', e.x + 5, 14, e.z, 1, 0.65, 0.1, [0.75, 0.22, 0.12]);
        } else {
          this.part(
            'rounded',
            e.x,
            1,
            e.z,
            e.k === 'tank' ? 2.5 : 1.7,
            1,
            3,
            col,
            yaw,
          );
          this.part('sphere', e.x, 2.5, e.z, 1.4, 0.9, 1.6, col, yaw);
          // Cañón del tanque: más largo y grueso que el de la torreta,
          // con bocacha oscura en la punta. La torreta conserva el
          // cañón corto de antes.
          this.part(
            'box',
            e.x + Math.sin(yaw) * (isTank ? 2.4 : 2),
            2.7,
            e.z + Math.cos(yaw) * (isTank ? 2.4 : 2),
            isTank ? 0.3 : 0.22,
            isTank ? 0.3 : 0.22,
            isTank ? 3.2 : 2,
            col,
            yaw,
          );
          if (isTank) {
            // Silueta propia del tanque Tan: cúpula del jefe sobre la
            // torreta con banda rojiza, placa frontal inclinada y
            // bocacha del cañón. Solo visual: el radio de colisión
            // (e.r) y la vida no cambian.
            this.part(
              'sphere',
              e.x,
              3.15,
              e.z,
              0.85,
              0.35,
              0.85,
              TAN_TANK_STRIPE,
              yaw,
            );
            this.part(
              'sphere',
              e.x - Math.sin(yaw) * 0.4,
              3.35,
              e.z - Math.cos(yaw) * 0.4,
              0.45,
              0.3,
              0.45,
              dark,
              yaw,
            );
            this.part(
              'rounded',
              e.x + Math.sin(yaw) * 2.9,
              0.9,
              e.z + Math.cos(yaw) * 2.9,
              2.2,
              0.75,
              0.5,
              dark,
              yaw,
            );
            this.part(
              'box',
              e.x + Math.sin(yaw) * 4,
              2.7,
              e.z + Math.cos(yaw) * 4,
              0.42,
              0.42,
              0.35,
              dark,
              yaw,
            );
          }
          if (e.k === 'tank')
            for (const side of [-1, 1]) {
              this.part(
                'rounded',
                e.x + side * 2.4 * Math.cos(yaw),
                0.65,
                e.z - side * 2.4 * Math.sin(yaw),
                0.4,
                0.65,
                3.1,
                dark,
                yaw,
              );
              for (let tread = -2; tread <= 2; tread++)
                this.part(
                  'rounded',
                  e.x + side * 2.4 * Math.cos(yaw) + tread * Math.sin(yaw),
                  1.28,
                  e.z - side * 2.4 * Math.sin(yaw) + tread * Math.cos(yaw),
                  0.42,
                  0.06,
                  0.12,
                  col,
                  yaw,
                );
            }
        }
      }
      this.groundOffset = 0;
      for (const a of scene.allies || [])
        if (!['rescued', 'A_BORDO', 'CAIDO'].includes(a.state) && visible(a))
          this.soldier(
            a.x,
            world ? world.height(a.x, a.z) : 0,
            a.z,
            true,
            a.yaw || 0,
            a.wounded || a.state === 'waiting',
          );
      for (const q of PK)
        if (visible(q))
          this.part(
            'box',
            q.x,
            (world ? world.height(q.x, q.z) : 0) + 1.2,
            q.z,
            0.9,
            0.9,
            0.9,
            q.ty === 'a' ? [0.3, 0.8, 0.3] : [0.8, 0.25, 0.15],
            0,
            0.4,
          );
      // Humo de misil. Ahora se desvanece con alfa además de
      // encogerse al final (antes, sin canal alfa, solo crecía y
      // se oscurecía, y se quedaba como una bola sólida).
      for (let si = 0; si < SM.length; si += stride) {
        const s = SM[si];
        if (visible(s)) {
          const max = s.max || 0.9,
            age = Math.min(1, Math.max(0, 1 - s.l / max));
          let grow = s.s * (0.55 + age * 0.9);
          if (age > 0.75) grow *= 1 - ((age - 0.75) / 0.25) * 0.55;
          const shade = s.dark
            ? [0.16 + age * 0.16, 0.15 + age * 0.16, 0.14 + age * 0.15]
            : [0.96 - age * 0.34, 0.96 - age * 0.32, 0.93 - age * 0.35];
          this.part(
            'sphere',
            s.x,
            s.y + age * 1.5,
            s.z,
            grow,
            grow * 0.9,
            grow,
            shade,
            0,
            0,
            Math.max(0, 1 - age) * 0.7,
          );
        }
      }
      // Trazadoras finas en forma de destello: punta brillante, halo que se
      // estrecha y cola apagada. Sin canal alfa, el desvanecimiento se
      // simula oscureciendo el color hacia la cola, como con el humo.
      // El tamaño es proporcional al arma que dispara (b.kind):
      // soldado = arma ligera, helicóptero = referencia media,
      // tanque = cañón pesado. Las torretas se dibujan como tanque.
      const STREAK_3D = {
        soldier: {
          length: 3.5,
          outer: [1, 0.85, 0.45],
          core: [1, 1, 0.85],
          outerSize: 0.14,
          coreSize: 0.07,
        },
        heli: {
          length: 6,
          outer: [1, 0.45, 0.08],
          core: [1, 0.95, 0.75],
          outerSize: 0.24,
          coreSize: 0.13,
        },
        tank: {
          length: 8,
          outer: [1, 0.35, 0.05],
          core: [1, 0.85, 0.5],
          outerSize: 0.46,
          coreSize: 0.25,
        },
      };
      const STREAK_3D_ENEMY = {
        soldier: {
          length: 3.5,
          outer: [1, 0.6, 0.2],
          core: [1, 0.85, 0.55],
          outerSize: 0.14,
          coreSize: 0.07,
        },
        heli: {
          length: 4.5,
          outer: [1, 0.25, 0.05],
          core: [1, 0.62, 0.25],
          outerSize: 0.26,
          coreSize: 0.14,
        },
        tank: {
          length: 8,
          outer: [1, 0.3, 0.05],
          core: [1, 0.8, 0.45],
          outerSize: 0.48,
          coreSize: 0.26,
        },
      };
      const streak = (b, style) => {
        const { length, outer, core, outerSize, coreSize } = style;
        const hv = Math.hypot(b.vx || 0, b.vz || 0);
        if (hv < 1) {
          this.part('sphere', b.x, b.y, b.z, coreSize, coreSize, coreSize, core, 0, 0);
          return;
        }
        const dx = (b.vx || 0) / hv,
          dz = (b.vz || 0) / hv,
          yaw = Math.atan2(b.vx || 0, b.vz || 0),
          fade = outer.map((v) => v * 0.4);
        // Cola apagada y estrecha.
        this.part(
          'rounded',
          b.x - dx * length * 0.72,
          b.y,
          b.z - dz * length * 0.72,
          outerSize * 0.5,
          outerSize * 0.5,
          length * 0.28,
          fade,
          yaw,
          0,
        );
        // Halo medio.
        this.part(
          'rounded',
          b.x - dx * length * 0.4,
          b.y,
          b.z - dz * length * 0.4,
          outerSize * 0.75,
          outerSize * 0.75,
          length * 0.32,
          outer,
          yaw,
          0,
        );
        // Núcleo brillante y corto en la punta.
        this.part(
          'rounded',
          b.x - dx * length * 0.15,
          b.y,
          b.z - dz * length * 0.15,
          coreSize,
          coreSize,
          length * 0.2,
          core,
          yaw,
          0,
        );
        // Punto caliente en la punta.
        this.part(
          'sphere',
          b.x,
          b.y,
          b.z,
          coreSize * 1.1,
          coreSize * 1.1,
          coreSize * 1.1,
          core,
          0,
          0,
        );
      };
      for (const b of BL)
        if (visible(b)) streak(b, STREAK_3D[b.kind] || STREAK_3D.heli);
      for (const b of EB)
        if (visible(b)) streak(b, STREAK_3D_ENEMY[b.kind] || STREAK_3D_ENEMY.heli);
      // Misil: cuerpo oscuro, punta roja y llama naranja parpadeante atrás.
      for (const o of MS)
        if (visible(o)) {
          const hv = Math.hypot(o.vx || 0, o.vz || 0) || 1,
            dx = (o.vx || 0) / hv,
            dz = (o.vz || 0) / hv,
            yaw = Math.atan2(o.vx || 0, o.vz || 0),
            flick =
              1 + 0.12 * Math.sin((scene.t || 0) * 37 + o.x * 1.7 + o.z);
          this.part(
            'sphere',
            o.x - dx * 1.6,
            o.y,
            o.z - dz * 1.6,
            0.7 * flick,
            0.7 * flick,
            1.1 * flick,
            [1, 0.55, 0.1],
            yaw,
            0,
          );
          this.part(
            'sphere',
            o.x - dx * 2,
            o.y,
            o.z - dz * 2,
            0.4 * flick,
            0.4 * flick,
            0.7 * flick,
            [1, 0.9, 0.5],
            yaw,
            0,
          );
          this.part(
            'rounded',
            o.x,
            o.y,
            o.z,
            0.55,
            0.55,
            1.3,
            [0.25, 0.28, 0.22],
            yaw,
            0.4,
          );
          this.part(
            'sphere',
            o.x + dx * 1.2,
            o.y,
            o.z + dz * 1.2,
            0.5,
            0.5,
            0.6,
            [0.85, 0.2, 0.1],
            yaw,
            0.4,
          );
        }
      // Explosión del original: bola de fuego que se encoge y se
      // apaga con la edad —naranja, rosa, morado— con núcleo
      // amarillo y humo gris al final. En la grabación la bola
      // crecía un 60 % y era opaca (un tanque: 22 u de diámetro),
      // así que ahora empieza en su tamaño y se encoge a la mitad
      // mientras su alfa cae a 0. La vida la pone combat
      // (EXPLOSION_LIFE, 0,55 s); escenas sin `max` usan 0,55.
      // El tamaño es solo visual: el daño no depende de aquí.
      for (const f of FX)
        if (visible(f)) {
          const life = f.max || 0.55,
            age = Math.min(1, Math.max(0, 1 - f.l / life)),
            sz = f.s * (1.0 - age * 0.55),
            fade = Math.max(0, 1 - age);
          this.part(
            'sphere',
            f.x,
            f.y + age * 1,
            f.z,
            sz,
            sz,
            sz,
            age > 0.65
              ? [0.36, 0.37, 0.29]
              : age > 0.4
                ? [0.62, 0.3, 0.75]
                : age > 0.2
                  ? [0.95, 0.3, 0.45]
                  : [1, 0.45, 0.08],
            0,
            0,
            fade,
          );
          if (age < 0.5) {
            this.part(
              'sphere',
              f.x,
              f.y + sz * 0.4,
              f.z,
              sz * 0.68,
              sz * 0.68,
              sz * 0.68,
              [1, 0.35, 0.55],
              0,
              0,
              fade,
            );
            this.part(
              'sphere',
              f.x,
              f.y + sz * 0.5,
              f.z,
              sz * 0.42,
              sz * 0.42,
              sz * 0.42,
              [1, 0.85, 0.3],
              0,
              0,
              fade,
            );
          }
        }
      if (P) {
        this.helicopter(
          P.x,
          P.y,
          P.z,
          P.yaw,
          rot,
          false,
          P.inv > 0 && Math.floor(scene.t * 20) % 2 === 0,
          false,
          P.pitch || 0,
        );
        // Winch de la carga (Misión 1: la caja; Misión 3: la
        // batería): cable colgando del helicóptero. Mientras engancha
        // la carga (`waiting` con progreso), el cable baja vertical
        // hasta el suelo bajo el helicóptero; con la carga levantada
        // (`carried`), el cable baja 2,5 u y la carga va colgando
        // bajo la panza, como en el original. La carga en el suelo se
        // dibuja arriba (no aquí) y desaparece al levantarla.
        if (cargo && P) {
          const ground = world ? world.height(P.x, P.z) : 0;
          if (cargo.state === 'waiting' && cargo.progress > 0) {
            const len = Math.max(0.5, P.y - 1 - ground);
            this.part(
              'box',
              P.x,
              P.y - 1 - len / 2,
              P.z,
              0.12,
              len / 2,
              0.12,
              [0.12, 0.12, 0.1],
              0,
              0,
            );
          } else if (cargo.state === 'carried') {
            // Cable corto (2,5 u) y carga pegada a la panza: el
            // helicóptero vuela a 8 u y una caja a 8,3 u rozaría el
            // suelo; así queda a ~1,6 u del suelo en llano. La
            // batería es más pequeña y oscura que la caja verde.
            this.part(
              'box',
              P.x,
              P.y - 2.25,
              P.z,
              0.12,
              1.25,
              0.12,
              [0.12, 0.12, 0.1],
              0,
              0,
            );
            if (cargo.kind === 'battery') {
              this.part(
                'box',
                P.x,
                P.y - 4.2,
                P.z,
                1.8,
                1,
                1.8,
                [0.25, 0.28, 0.35],
                0,
                0,
              );
              this.part(
                'box',
                P.x,
                P.y - 3.2,
                P.z,
                1.9,
                0.1,
                1.9,
                [0.35, 0.38, 0.45],
                0,
                0,
              );
            } else {
              this.part(
                'box',
                P.x,
                P.y - 4.6,
                P.z,
                3,
                1.8,
                3,
                [0.13, 0.42, 0.14],
                0,
                0,
              );
              this.part(
                'box',
                P.x,
                P.y - 2.6,
                P.z,
                3.25,
                0.35,
                3.25,
                [0.18, 0.52, 0.18],
                0,
                0,
              );
            }
          }
        }
      }
      return true;
    }
  }
  // Agrupa los píxeles 5×5 de la letra del helipuerto en barras
  // horizontales continuas por fila: píxeles contiguos (paso 1,2 u)
  // en la misma z forman una sola barra centrada en su punto medio.
  function padLetterRuns(marks) {
    const rows = new Map();
    for (const p of marks || []) {
      const key = Math.round(p.z * 10);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(p.x);
    }
    const runs = [];
    for (const [key, xs] of rows) {
      xs.sort((a, b) => a - b);
      let start = xs[0],
        prev = xs[0];
      for (let i = 1; i <= xs.length; i++) {
        if (i < xs.length && Math.abs(xs[i] - prev - 1.2) < 0.01) {
          prev = xs[i];
          continue;
        }
        const n = Math.round((prev - start) / 1.2) + 1;
        runs.push({
          x: (start + prev) / 2,
          z: key / 10,
          sx: 0.55 + (n - 1) * 1.2,
        });
        if (i < xs.length) {
          start = xs[i];
          prev = xs[i];
        }
      }
    }
    return runs;
  }
  ToyRenderer.geometry = geometry;
  ToyRenderer.padLetterRuns = padLetterRuns;
  // Paleta de las explosiones (ver el bucle FX en render): naranja,
  // rosa y morado del original, núcleo amarillo y humo gris final.
  ToyRenderer.EXPLOSION_COLORS = Object.freeze({
    orange: [1, 0.45, 0.08],
    pink: [0.95, 0.3, 0.45],
    purple: [0.62, 0.3, 0.75],
    core: [1, 0.85, 0.3],
    smoke: [0.36, 0.37, 0.29],
  });
  ToyRenderer.EXPLOSION_LIFE = 0.55;
  // Tanque Tan: amarillo vivo/tostado, distinto del verde del jugador
  // y del caqui de la infantería Tan ([0.77, 0.62, 0.36]). Las
  // orugas son marrón tostado oscuro.
  ToyRenderer.TAN_TANK = Object.freeze({
    body: TAN_TANK_BODY,
    dark: TAN_TANK_DARK,
    stripe: TAN_TANK_STRIPE,
  });
  // Los modelos de Blender llevan el morro a -Z (glTF) y el juego lo
  // lleva a +Z: cada modelo se gira yaw + π (ver src/gltf-loader.js).
  ToyRenderer.MODEL_NOSE_YAW_OFFSET = Math.PI;
  ToyRenderer.GltfLoader = GltfLoader;
  return ToyRenderer;
});
