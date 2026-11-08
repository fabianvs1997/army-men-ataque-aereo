/* Cargador glTF 2.0 mínimo, sin dependencias, para los modelos de
   Blender del juego (assets/helicoptero.gltf y assets/tanque-tan.gltf).
   Solo lo que esos modelos usan: JSON con buffer embebido en base64,
   primitivas TRIANGLES indexadas con POSITION/NORMAL, materiales con
   baseColorFactor y jerarquía de nodos TRS (o matriz). Sin texturas,
   skins, animaciones ni extensiones KHR: lo no soportado se ignora
   (la primitiva se salta) sin romper el resto del modelo.
   Funciona en Node (require) y en el navegador (globalThis), como los
   demás módulos clásicos del juego. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToyGltfLoader = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // El morro de AMBOS modelos apunta a -Z en espacio glTF (cabina
  // delantera del helicóptero en z=-2,8; placa frontal y cañón del
  // tanque en z=-2,45/-3,95), mientras que el morro procedural del
  // juego apunta a +Z local. Un modelo con yaw de juego `yaw` necesita
  // por tanto una rotación fija de 180° sobre Y: modelo yaw = yaw + π.
  // (Verificado con test: el punto del morro transformado por
  // Ry(yaw + π) cae en la dirección (sin yaw, cos yaw), la misma que
  // la del morro procedural.)
  var NOSE_YAW_OFFSET = Math.PI;
  // Dirección del morro en espacio del modelo (glTF): -Z.
  var MODEL_NOSE = [0, 0, -1];

  // --- Matrices 4x4 en columna mayor (como uniformMatrix4fv) ---
  function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function multiply(a, b) {
    // Devuelve a * b (b se aplica primero al vector).
    var out = new Float32Array(16);
    for (var c = 0; c < 4; c++)
      for (var r = 0; r < 4; r++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        out[c * 4 + r] = s;
      }
    return out;
  }
  function translation(x, y, z) {
    var m = identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  }
  function rotationX(angle) {
    var c = Math.cos(angle),
      s = Math.sin(angle);
    return new Float32Array([
      1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1,
    ]);
  }
  function rotationY(angle) {
    var c = Math.cos(angle),
      s = Math.sin(angle);
    return new Float32Array([
      c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1,
    ]);
  }
  function rotationZ(angle) {
    var c = Math.cos(angle),
      s = Math.sin(angle);
    return new Float32Array([
      c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
  }
  function quatToMat4(q) {
    var x = q[0],
      y = q[1],
      z = q[2],
      w = q[3],
      x2 = x + x,
      y2 = y + y,
      z2 = z + z,
      xx = x * x2,
      xy = x * y2,
      xz = x * z2,
      yy = y * y2,
      yz = y * z2,
      zz = z * z2,
      wx = w * x2,
      wy = w * y2,
      wz = w * z2;
    return new Float32Array([
      1 - (yy + zz), xy + wz, xz - wy, 0,
      xy - wz, 1 - (xx + zz), yz + wx, 0,
      xz + wy, yz - wx, 1 - (xx + yy), 0,
      0, 0, 0, 1,
    ]);
  }
  function quatMultiply(a, b) {
    // a * b (b se aplica primero). Conmuta cuando ambas son giros Y.
    var ax = a[0],
      ay = a[1],
      az = a[2],
      aw = a[3],
      bx = b[0],
      by = b[1],
      bz = b[2],
      bw = b[3];
    return [
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz,
    ];
  }
  function quatFromAxisY(angle) {
    return [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
  }
  function composeTRS(t, q, s) {
    var r = q ? quatToMat4(q) : identity(),
      m = identity();
    // M = T * R * S.
    for (var c = 0; c < 3; c++)
      for (var rr = 0; rr < 3; rr++)
        m[c * 4 + rr] = r[c * 4 + rr] * (s ? s[c] : 1);
    m[12] = t ? t[0] : 0;
    m[13] = t ? t[1] : 0;
    m[14] = t ? t[2] : 0;
    return m;
  }
  function transformPoint(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
  }
  function transformDirection(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
    ];
  }

  // --- Lectura del buffer ---
  function decodeBase64(b64) {
    if (typeof Buffer !== 'undefined')
      return new Uint8Array(Buffer.from(b64, 'base64'));
    var bin = root.atob(b64),
      out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  var COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  var TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

  function readAccessor(gltf, buffers, index) {
    var acc = gltf.accessors[index];
    if (!acc) throw new Error('accessor ' + index + ' no existe');
    var view = gltf.bufferViews[acc.bufferView];
    if (!view) throw new Error('bufferView de accessor ' + index + ' no existe');
    var bytes = buffers[view.buffer];
    if (!bytes) throw new Error('buffer ' + view.buffer + ' no decodificado');
    var compBytes = COMPONENT_BYTES[acc.componentType];
    if (!compBytes) throw new Error('componentType ' + acc.componentType + ' no soportado');
    var numComp = TYPE_COMPONENTS[acc.type];
    if (!numComp) throw new Error('tipo de accessor ' + acc.type + ' no soportado');
    var stride = view.byteStride || compBytes * numComp,
      base = (view.byteOffset || 0) + (acc.byteOffset || 0),
      count = acc.count,
      out = new Float32Array(count * numComp),
      dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (var i = 0; i < count; i++)
      for (var c = 0; c < numComp; c++) {
        var off = base + i * stride + c * compBytes,
          v;
        switch (acc.componentType) {
          case 5126:
            v = dv.getFloat32(off, true);
            break;
          case 5123:
            v = dv.getUint16(off, true);
            break;
          case 5125:
            v = dv.getUint32(off, true);
            break;
          case 5121:
            v = dv.getUint8(off);
            break;
          case 5122:
            v = dv.getInt16(off, true);
            break;
          case 5120:
            v = dv.getInt8(off);
            break;
          default:
            v = 0;
        }
        if (acc.normalized) {
          if (acc.componentType === 5121) v /= 255;
          else if (acc.componentType === 5123) v /= 65535;
          else if (acc.componentType === 5120) v = Math.max(v / 127, -1);
          else if (acc.componentType === 5122) v = Math.max(v / 32767, -1);
        }
        out[i * numComp + c] = v;
      }
    return { data: out, count: count, numComponents: numComp, componentType: acc.componentType };
  }
  function readIndices(gltf, buffers, index) {
    var raw = readAccessor(gltf, buffers, index),
      n = raw.count,
      out;
    var max = 0;
    for (var i = 0; i < n; i++) if (raw.data[i] > max) max = raw.data[i];
    // WebGL 1 dibuja índices Uint16 sin extensiones; los modelos del
    // juego tienen < 65.536 vértices por primitiva, así que cabe.
    out = max < 65536 ? new Uint16Array(n) : new Uint32Array(n);
    for (var j = 0; j < n; j++) out[j] = raw.data[j];
    return out;
  }

  function parse(input) {
    var gltf = typeof input === 'string' ? JSON.parse(input) : input;
    if (!gltf || typeof gltf !== 'object') throw new Error('glTF inválido: no es un objeto');
    if (!gltf.asset || String(gltf.asset.version || '').indexOf('2.') !== 0)
      throw new Error('glTF inválido: se esperaba asset.version 2.x');
    if (!Array.isArray(gltf.buffers) || gltf.buffers.length === 0)
      throw new Error('glTF inválido: sin buffers');
    var buffers = gltf.buffers.map(function (b, i) {
      if (typeof b.uri !== 'string' || b.uri.indexOf('data:') !== 0)
        throw new Error('buffer ' + i + ' externo, no embebido: no soportado sin fetch');
      var comma = b.uri.indexOf(',');
      if (comma < 0) throw new Error('buffer ' + i + ' con data URI inválida');
      var bytes = decodeBase64(b.uri.slice(comma + 1));
      if (b.byteLength !== undefined && bytes.length !== b.byteLength)
        throw new Error('buffer ' + i + ' incompleto');
      return bytes;
    });

    var materials = (gltf.materials || []).map(function (m) {
      var pbr = (m && m.pbrMetallicRoughness) || {},
        base = pbr.baseColorFactor || [1, 1, 1, 1];
      return {
        name: (m && m.name) || '',
        color: [base[0], base[1], base[2]],
        alpha: base.length > 3 ? base[3] : 1,
        alphaMode: (m && m.alphaMode) || 'OPAQUE',
      };
    });
    var defaultMaterial = { name: '', color: [1, 1, 1], alpha: 1, alphaMode: 'OPAQUE' };

    var nodes = (gltf.nodes || []).map(function (n, index) {
      var local, translation = n.translation || null,
        rotation = n.rotation || null,
        scale = n.scale || null;
      if (Array.isArray(n.matrix) && n.matrix.length === 16)
        local = new Float32Array(n.matrix);
      else local = composeTRS(translation, rotation, scale);
      return {
        index: index,
        name: n.name || '',
        mesh: typeof n.mesh === 'number' ? n.mesh : null,
        children: Array.isArray(n.children) ? n.children.slice() : [],
        translation: translation ? translation.slice() : null,
        rotation: rotation ? rotation.slice() : null,
        scale: scale ? scale.slice() : null,
        hasMatrix: Array.isArray(n.matrix) && n.matrix.length === 16,
        local: local,
      };
    });
    var hasParent = {};
    nodes.forEach(function (n) {
      n.children.forEach(function (c) {
        hasParent[c] = true;
      });
    });
    var roots;
    if (gltf.scenes && gltf.scenes.length && Array.isArray(gltf.scenes[0].nodes))
      roots = gltf.scenes[0].nodes.filter(function (i) { return nodes[i]; });
    else
      roots = nodes.filter(function (n) { return !hasParent[n.index]; }).map(function (n) { return n.index; });

    // Una entrada por primitiva y por nodo que la instancia: el
    // renderer las fusiona en un solo buffer GPU por modelo.
    var drawList = [];
    nodes.forEach(function (node) {
      if (node.mesh === null) return;
      var mesh = (gltf.meshes || [])[node.mesh];
      if (!mesh) return;
      (mesh.primitives || []).forEach(function (prim) {
        try {
          if (prim.mode !== undefined && prim.mode !== 4) return; // solo TRIANGLES
          var attrs = prim.attributes || {};
          if (attrs.POSITION === undefined) return;
          var pos = readAccessor(gltf, buffers, attrs.POSITION);
          if (pos.numComponents !== 3) return;
          var positions = pos.data,
            normals;
          if (attrs.NORMAL !== undefined) {
            var nrm = readAccessor(gltf, buffers, attrs.NORMAL);
            normals = nrm.numComponents === 3 ? nrm.data : null;
          }
          if (!normals) {
            normals = new Float32Array(positions.length);
            for (var i = 1; i < normals.length; i += 3) normals[i] = 1;
          }
          var indices;
          if (prim.indices !== undefined) indices = readIndices(gltf, buffers, prim.indices);
          else {
            indices = new Uint16Array(positions.length / 3);
            for (var j = 0; j < indices.length; j++) indices[j] = j;
          }
          drawList.push({
            nodeIndex: node.index,
            positions: positions,
            normals: normals,
            indices: indices,
            materialIndex: typeof prim.material === 'number' ? prim.material : -1,
          });
        } catch (e) {
          // Primitiva no soportada (accessor raro, buffer roto...):
          // se salta sin romper el resto del modelo.
        }
      });
    });

    return {
      nodes: nodes,
      roots: roots,
      materials: materials,
      defaultMaterial: defaultMaterial,
      drawList: drawList,
      triangles: drawList.reduce(function (sum, p) {
        return sum + p.indices.length / 3;
      }, 0),
    };
  }

  function countTris(model) {
    if (!model || !Array.isArray(model.drawList)) return 0;
    return model.drawList.reduce(function (sum, p) {
      return sum + p.indices.length / 3;
    }, 0);
  }
  function findNode(model, name) {
    if (!model || !Array.isArray(model.nodes)) return null;
    for (var i = 0; i < model.nodes.length; i++)
      if (model.nodes[i].name === name) return model.nodes[i];
    return null;
  }
  // Matriz local de un nodo con un giro extra sobre su propio eje Y
  // (rotor / torreta). El giro conmuta con la rotación base cuando
  // esta también es sobre Y, que es el caso de `Rotor` (45° sobre Y).
  function localWithSpin(node, angle) {
    if (!angle) return node.local;
    if (node.hasMatrix) return multiply(node.local, rotationY(angle));
    var q = node.rotation
      ? quatMultiply(node.rotation, quatFromAxisY(angle))
      : quatFromAxisY(angle);
    return composeTRS(node.translation, q, node.scale);
  }
  function nodeWorldMatrices(model, opts) {
    var options = opts || {},
      rotorAngle = options.rotorAngle || 0,
      turretAngle = options.turretAngle || 0,
      out = new Array(model.nodes.length),
      rotor = rotorAngle ? findNode(model, 'Rotor') : null,
      turret = turretAngle ? findNode(model, 'Torreta') : null;
    function visit(index, parent) {
      var node = model.nodes[index],
        angle = 0;
      if (rotor && index === rotor.index) angle = rotorAngle;
      else if (turret && index === turret.index) angle = turretAngle;
      var local = angle ? localWithSpin(node, angle) : node.local,
        world = parent ? multiply(parent, local) : local;
      out[index] = world;
      node.children.forEach(function (c) {
        if (model.nodes[c]) visit(c, world);
      });
    }
    model.roots.forEach(function (r) {
      visit(r, null);
    });
    // Nodos fuera de la escena (no deberían existir): identidad local.
    for (var i = 0; i < out.length; i++)
      if (!out[i]) out[i] = model.nodes[i].local;
    return out;
  }
  function modelExtents(model, opts) {
    var mats = nodeWorldMatrices(model, opts),
      min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity],
      found = false;
    model.drawList.forEach(function (prim) {
      var m = mats[prim.nodeIndex];
      for (var i = 0; i < prim.positions.length; i += 3) {
        var p = transformPoint(m, [
          prim.positions[i],
          prim.positions[i + 1],
          prim.positions[i + 2],
        ]);
        found = true;
        for (var c = 0; c < 3; c++) {
          if (p[c] < min[c]) min[c] = p[c];
          if (p[c] > max[c]) max[c] = p[c];
        }
      }
    });
    if (!found) return null;
    return {
      min: min,
      max: max,
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
      center: [
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        (min[2] + max[2]) / 2,
      ],
    };
  }

  return {
    NOSE_YAW_OFFSET: NOSE_YAW_OFFSET,
    MODEL_NOSE: MODEL_NOSE,
    parse: parse,
    countTris: countTris,
    findNode: findNode,
    nodeWorldMatrices: nodeWorldMatrices,
    modelExtents: modelExtents,
    mat4Identity: identity,
    mat4Multiply: multiply,
    mat4Translation: translation,
    mat4RotationX: rotationX,
    mat4RotationY: rotationY,
    mat4RotationZ: rotationZ,
    mat4FromQuat: quatToMat4,
    mat4FromTRS: composeTRS,
    quatMultiply: quatMultiply,
    transformPoint: transformPoint,
    transformDirection: transformDirection,
  };
});
