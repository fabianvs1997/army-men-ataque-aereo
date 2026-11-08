# Caja de suministros verde brillante con flecha blanca, de juguete
# de plástico, de Army Men: Ataque Aéreo.
#
# Modelo original desde cero, con el aspecto de la caja del VÍDEO
# ORIGINAL (montaje, 125,5 s, Misión 1 «Plastic Pandemonium»): en el
# catálogo fotograma a fotograma
# (~/workspace/departamento-videojuegos/catalogo-mision-video-m1.md)
# la caja es VERDE BRILLANTE con una FLECHA BLANCA hacia arriba y el
# helicóptero la lleva colgando del winch (se ve bajo el helicóptero
# en varios fotogramas, p. ej. ~s99-s104, s115). La caja del juego
# hasta ahora era verde oscuro sin flecha; este modelo es la caja del
# vídeo: cuerpo verde brillante, tapa más clara, flecha blanca en la
# cara superior (apuntando al morro, +Y) y flecha blanca también en
# las cuatro caras laterales, con refuerzos oscuros en las esquinas.
#
# Uso (Blender 4.2, headless):
#   blender --background --python assets/blender/caja.py
#
# Regenera: assets/caja-suministros.glb, assets/caja-suministros.gltf
# (embebido, el que se sube al repo porque la API de GitHub no admite
# binarios) y las 4 vistas previas en assets/blender/previews/.
#
# Coordenadas en Blender: morro hacia +Y, arriba +Z, metros. La caja
# del juego mide 6 x 3,6 x 6 u, así que el modelo se construye a esa
# escala 1:1. Al exportar a glTF el morro queda hacia +Z y arriba +Y.
import base64
import json
import math
import mathutils
import os
import struct

import bpy

# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
ASSETS_DIR = os.path.join(REPO_ROOT, "assets")
PREVIEWS_DIR = os.path.join(SCRIPT_DIR, "previews")
GLB_PATH = os.path.join(ASSETS_DIR, "caja-suministros.glb")
GLTF_PATH = os.path.join(ASSETS_DIR, "caja-suministros.gltf")
STATS_PATH = os.path.join(SCRIPT_DIR, "caja-stats.json")

# Límite de polígonos para que el modelo corra bien en un iPhone.
MAX_TRIS = 1000

# ---------------------------------------------------------------------------
# Materiales (colores lineales del juego, src/toy-renderer.js)
# ---------------------------------------------------------------------------
def make_material(name, color, roughness=0.45, metallic=0.0, emission=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.6
    return mat


# Verde brillante del vídeo (no el verde oscuro 0.13, 0.42, 0.14 de
# la caja vieja): verde plástico vivo, tapa un poco más clara y
# flecha blanca pura, bien visible desde la cámara cenital.
VERDE = make_material("VerdeBrillante", (0.05, 0.75, 0.10), 0.4)
VERDE_CLARO = make_material("VerdeClaro", (0.10, 0.88, 0.16), 0.4)
BLANCO = make_material("BlancoFlecha", (0.95, 0.95, 0.92), 0.4)
OSCURO = make_material("RefuerzoOscuro", (0.08, 0.20, 0.08), 0.5)

# ---------------------------------------------------------------------------
# Ayudas de construcción
# ---------------------------------------------------------------------------
def add_box(name, loc, size, mat, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = size
    obj.data.materials.append(mat)
    return obj


def add_prism(name, loc, size, mat, rot=(0.0, 0.0, 0.0)):
    """Prisma triangular (cilindro de 3 vértices): la cabeza de la flecha."""
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=3, radius=1.0, depth=size[2], location=loc, rotation=rot,
    )
    obj = bpy.context.active_object
    obj.name = name
    # El cilindro de 3 vértices tiene radio 1: se escala para que el
    # triángulo mida `size` (ancho x alto) en el plano XY.
    obj.scale = (size[0] / 2.0, size[1] / 2.0, 1.0)
    obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Limpieza de escena
# ---------------------------------------------------------------------------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------------------
# Cuerpo y tapa (6 x 3,6 x 6, base en z = 0)
# ---------------------------------------------------------------------------
add_box("Cuerpo", (0, 0, 1.8), (6, 6, 3.6), VERDE)
add_box("Tapa", (0, 0, 3.9), (6.5, 6.5, 0.7), VERDE_CLARO)
# Refuerzos oscuros en las cuatro aristas verticales.
for sx in (-1, 1):
    for sy in (-1, 1):
        add_box("Refuerzo_%d_%d" % (sx, sy),
                (sx * 2.9, sy * 2.9, 1.8), (0.25, 0.25, 3.6), OSCURO)

# ---------------------------------------------------------------------------
# Flecha blanca en la cara superior (apunta al morro, +Y)
# ---------------------------------------------------------------------------
# Mástil de la flecha y cabeza triangular, un poco por encima de la
# tapa para que no haga z-fighting con ella.
add_box("FlechaMastil", (0, -0.9, 4.32), (1.0, 2.6, 0.08), BLANCO)
add_prism("FlechaCabeza", (0, 1.5, 4.32), (2.6, 1.8, 0.08), BLANCO)

# ---------------------------------------------------------------------------
# Flechas blancas en las caras laterales (apuntan hacia arriba, +Z)
# ---------------------------------------------------------------------------
# Cara +Y (morro) y cara -Y (trasera): mástil vertical y cabeza.
for sy, tag in ((1, "Morro"), (-1, "Trasera")):
    add_box("Flecha%sMastil" % tag, (0, sy * 3.04, 1.3),
            (0.8, 0.08, 1.6), BLANCO)
    add_prism("Flecha%sCabeza" % tag, (0, sy * 3.04, 2.6),
              (2.0, 1.2, 0.08), BLANCO,
              rot=(0, 0, 0) if sy > 0 else (0, math.radians(180), 0))
# Caras laterales ±X: mismo motivo, girado 90°.
for sx, tag in ((1, "Der"), (-1, "Izq")):
    add_box("Flecha%sMastil" % tag, (sx * 3.04, 0, 1.3),
            (0.08, 0.8, 1.6), BLANCO)
    add_prism("Flecha%sCabeza" % tag, (sx * 3.04, 0, 2.6),
              (2.0, 1.2, 0.08), BLANCO,
              rot=(0, 0, math.radians(90) if sx > 0 else math.radians(-90)))

# ---------------------------------------------------------------------------
# Conteo de triángulos
# ---------------------------------------------------------------------------
deps = bpy.context.evaluated_depsgraph_get()
total_tris = 0
per_object = {}
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    ev = obj.evaluated_get(deps)
    mesh = ev.to_mesh()
    tris = sum(len(p.vertices) - 2 for p in mesh.polygons)
    per_object[obj.name] = tris
    total_tris += tris
    ev.to_mesh_clear()

print("TRIANGULOS TOTALES: %d (limite %d)" % (total_tris, MAX_TRIS))
if total_tris > MAX_TRIS:
    print("AVISO: el modelo supera el limite de triangulos")

with open(STATS_PATH, "w", encoding="utf-8") as fh:
    json.dump({"tris": total_tris, "limite": MAX_TRIS,
               "por_objeto": per_object}, fh, indent=2, sort_keys=True)

# ---------------------------------------------------------------------------
# Luces, cámara y vistas previas
# ---------------------------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = 800
scene.render.resolution_y = 600
scene.render.film_transparent = False
world = bpy.data.worlds["World"]
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.88, 0.91, 0.93, 1.0)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.85
scene.view_settings.view_transform = "Standard"

sun_data = bpy.data.lights.new("Sol", type="SUN")
sun_data.energy = 2.0
sun = bpy.data.objects.new("Sol", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))

cam_data = bpy.data.cameras.new("CamaraPrevia")
cam = bpy.data.objects.new("CamaraPrevia", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def look_at(obj, target, location):
    obj.location = location
    direction = (mathutils.Vector(target) - mathutils.Vector(location))
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


CENTER = (0, 0, 2.0)
VIEWS = {
    "frontal": (0, 14, 3.0),
    "lateral": (14, 0, 3.0),
    "cenital": (0, 0, 18),
    "tres-cuartos": (10, 10, 7),
}
for name, loc in VIEWS.items():
    look_at(cam, CENTER, loc)
    scene.render.filepath = os.path.join(PREVIEWS_DIR, "caja_%s.png" % name)
    bpy.ops.render.render(write_still=True)
    print("Vista previa: %s" % scene.render.filepath)

# ---------------------------------------------------------------------------
# Exportación glTF
# ---------------------------------------------------------------------------
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH, export_format="GLB", export_apply=True,
    export_yup=True,
)
print("Exportado: %s" % GLB_PATH)


def glb_a_gltf_embebido(glb_path, gltf_path):
    """Convierte el .glb a .gltf con el buffer embebido en base64.

    Blender 4.2 no ofrece GLTF_EMBEDDED en el operador de exportación
    (solo GLB y GLTF_SEPARATE), así que se hace a mano: es el mismo
    JSON del .glb con el buffer como data URI. El .gltf resultante es
    texto UTF-8 y es el archivo que se sube al repo, porque la API de
    GitHub no admite binarios.
    """
    with open(glb_path, "rb") as fh:
        data = fh.read()
    magic, version, length = struct.unpack("<III", data[:12])
    assert magic == 0x46546C67, "no es un GLB valido"
    chunk_len, chunk_type = struct.unpack("<II", data[12:20])
    assert chunk_type == 0x4E4F534A, "primer chunk no es JSON"
    gltf = json.loads(data[20:20 + chunk_len])
    offset = 20 + chunk_len
    bin_len, bin_type = struct.unpack("<II", data[offset:offset + 8])
    assert bin_type == 0x004E4942, "segundo chunk no es BIN"
    bin_data = data[offset + 8:offset + 8 + bin_len]
    gltf["buffers"] = [{
        "byteLength": len(bin_data),
        "uri": "data:application/octet-stream;base64,"
               + base64.b64encode(bin_data).decode("ascii"),
    }]
    with open(gltf_path, "w", encoding="utf-8") as fh:
        json.dump(gltf, fh, ensure_ascii=False, separators=(",", ":"))
    return len(bin_data)


glb_a_gltf_embebido(GLB_PATH, GLTF_PATH)
print("Exportado: %s" % GLTF_PATH)
print("LISTO: %d triangulos, %d objetos" % (total_tris, len(per_object)))
