# Tanque enemigo Tan, amarillo/tostado, de juguete de plástico, de
# Army Men: Ataque Aéreo.
#
# Modelo original desde cero, con las proporciones y los colores del
# tanque Tan que hoy dibuja el juego (src/toy-renderer.js y
# src/debris.js): casco con orugas oscuras a los lados, torreta
# giratoria con cañón largo y grueso con bocacha, cúpula del jefe con
# banda rojiza y placa frontal inclinada. No hay tanque verde del
# jugador en el juego (el jugador es el helicóptero), así que solo se
# modela la variante Tan.
#
# Uso (Blender 4.2, headless):
#   blender --background --python assets/blender/tanque.py
#
# Regenera: assets/tanque-tan.glb, assets/tanque-tan.gltf (embebido,
# el que se sube al repo porque la API de GitHub no admite binarios) y
# las 4 vistas previas en assets/blender/previews/.
#
# Coordenadas en Blender: morro hacia +Y, arriba +Z, metros. Al exportar
# a glTF el morro queda hacia +Z (adelante en glTF) y arriba es +Y.
# La torreta queda como objetos bajo el vacío "Torreta", para poder
# girarla luego en el juego.
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
GLB_PATH = os.path.join(ASSETS_DIR, "tanque-tan.glb")
GLTF_PATH = os.path.join(ASSETS_DIR, "tanque-tan.gltf")
STATS_PATH = os.path.join(SCRIPT_DIR, "tanque-stats.json")

# Límite de polígonos para que el modelo corra bien en un iPhone.
MAX_TRIS = 3000

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


# Amarillo vivo/tostado del tanque Tan, orugas marrón tostado oscuro y
# banda rojiza de la torreta (TAN_TANK_BODY, TAN_TANK_DARK y
# TAN_TANK_STRIPE en src/toy-renderer.js).
AMARILLO = make_material("AmarilloTan", (0.95, 0.76, 0.2), 0.45)
AMARILLO_OSCURO = make_material("AmarilloTanOscuro", (0.78, 0.58, 0.14), 0.5)
MARRON = make_material("MarronOscuro", (0.45, 0.32, 0.12), 0.5)
BANDA = make_material("BandaRojiza", (0.55, 0.25, 0.1), 0.45)
MARFIL = make_material("Marfil", (0.9, 0.92, 0.73), 0.5)
OSCURO = make_material("MetalOscuro", (0.15, 0.15, 0.13), 0.55, 0.4)

# ---------------------------------------------------------------------------
# Ayudas de construcción
# ---------------------------------------------------------------------------
def add_sphere(name, loc, scale, mat, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=loc
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def add_box(name, loc, size, mat, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = size
    obj.data.materials.append(mat)
    return obj


def add_cylinder(name, loc, radius, depth, mat, rot=(0.0, 0.0, 0.0), vertices=16,
                 radius2=None, smooth=True):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius,
        radius2=radius if radius2 is None else radius2,
        depth=depth, location=loc, rotation=rot,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    # Las tapas planas de un cilindro con sombreado suave salen con un
    # punto oscuro en el centro (las ruedas parecían donuts); las piezas
    # con tapas visibles van sin suavizado.
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def parent_keep(obj, parent):
    """Emparenta sin mover el objeto: al asignar `parent` a secas, la
    posición pasa a ser relativa al padre y la pieza salta (la torreta
    quedaba flotando 2,1 u sobre el casco)."""
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()


# ---------------------------------------------------------------------------
# Limpieza de escena
# ---------------------------------------------------------------------------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------------------
# Orugas y ruedas (a cada lado, x = ±2.15)
# ---------------------------------------------------------------------------
# El juego dibuja cada oruga como una pieza redondeada de 0,4 de ancho,
# 0,65 de alto y 3,1 de largo a ±2,4; aquí la oruga es una caja más
# ancha con ruedas visibles en la cara exterior, como un tanque de
# juguete.
for side in (-1, 1):
    tag = "Izq" if side < 0 else "Der"
    add_box("Oruga_" + tag, (side * 2.15, 0, 0.55), (0.85, 3.7, 0.95), MARRON)
    # Guardabarros sobre la oruga, amarillo.
    add_box("Guardabarros_" + tag, (side * 2.15, 0, 1.12),
            (0.95, 3.9, 0.1), AMARILLO)
    # 5 ruedas de rodaje en la cara exterior de la oruga.
    for i, y in enumerate((-1.45, -0.72, 0.0, 0.72, 1.45)):
        add_cylinder("Rueda_%s_%d" % (tag, i), (side * 2.6, y, 0.55),
                     0.34, 0.12, MARRON, rot=(0, math.radians(90), 0),
                     vertices=12, smooth=False)
    # Rueda motriz trasera y tensora delantera, un poco más grandes.
    add_cylinder("Motriz_" + tag, (side * 2.6, -1.85, 0.62), 0.4, 0.12,
                 MARRON, rot=(0, math.radians(90), 0), vertices=12,
                 smooth=False)
    add_cylinder("Tensora_" + tag, (side * 2.6, 1.85, 0.62), 0.4, 0.12,
                 MARRON, rot=(0, math.radians(90), 0), vertices=12,
                 smooth=False)

# ---------------------------------------------------------------------------
# Casco
# ---------------------------------------------------------------------------
# Casco inferior y superior (el juego: caja redondeada de 2,5 de ancho,
# 1 de alto y 3 de largo; aquí el casco es más ancho porque las orugas
# van por fuera).
add_box("CascoInferior", (0, 0, 1.05), (3.5, 3.3, 0.9), AMARILLO)
add_box("CascoSuperior", (0, 0, 1.72), (3.1, 2.9, 0.55), AMARILLO)
# Placa frontal inclinada (glacis), marrón oscuro como en el juego.
add_box("PlacaFrontal", (0, 1.82, 1.32), (3.0, 0.1, 0.9), MARRON,
        rot=(math.radians(-45), 0, 0))
# Faros de marfil sobre los guardabarros delanteros.
for side in (-1, 1):
    add_sphere("Faro_%s" % ("Izq" if side < 0 else "Der"),
               (side * 1.55, 1.85, 1.25), (0.16, 0.16, 0.16), MARFIL,
               segments=8, rings=6)
# Ganchos de remolque en el glacis.
for side in (-1, 1):
    add_box("Gancho_%s" % ("Izq" if side < 0 else "Der"),
            (side * 0.9, 1.95, 1.05), (0.14, 0.1, 0.22), OSCURO)
# Caja de pertrechos trasera y tubo de escape.
add_box("CajaTrasera", (0, -1.85, 1.75), (2.3, 0.45, 0.5), AMARILLO_OSCURO)
add_cylinder("Escape", (1.2, -1.75, 1.15), 0.14, 0.7, OSCURO,
             rot=(math.radians(90), 0, 0), vertices=10)

# ---------------------------------------------------------------------------
# Torreta (bajo el vacío "Torreta", para poder girarla luego)
# ---------------------------------------------------------------------------
bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, -0.3, 2.1))
torreta = bpy.context.active_object
torreta.name = "Torreta"
bpy.context.view_layer.update()

# Anillo de la torreta sobre el casco.
anillo = add_cylinder("AnilloTorreta", (0, -0.3, 2.05), 1.35, 0.25, MARRON,
                      vertices=20)
parent_keep(anillo, torreta)
# Cuerpo de la torreta: esfera achatada (el juego: esfera de 1,4 x 0,9
# x 1,6 a 2,5 de alto).
torre = add_sphere("TorretaCuerpo", (0, -0.3, 2.5), (1.5, 1.7, 0.85),
                   AMARILLO, segments=20, rings=10)
parent_keep(torre, torreta)
# Cañón largo y grueso hacia el morro (+Y), con bocacha oscura en la
# punta (el juego: caja de 0,3 x 0,3 x 3,2 a 2,4 del centro y bocacha
# de 0,42 a 4,0).
canon = add_cylinder("Canon", (0, 2.6, 2.55), 0.15, 3.6, AMARILLO,
                     rot=(math.radians(90), 0, 0), vertices=16)
parent_keep(canon, torreta)
bocacha = add_cylinder("Bocacha", (0, 4.25, 2.55), 0.22, 0.4, OSCURO,
                       rot=(math.radians(90), 0, 0), vertices=12,
                       smooth=False)
parent_keep(bocacha, torreta)
# Cúpula del jefe sobre la torreta con banda rojiza y escotilla oscura
# (el juego: esfera de 0,85 con banda a 3,15 y escotilla a 3,35).
cupula = add_sphere("Cupula", (0, -0.9, 3.2), (0.55, 0.55, 0.32), AMARILLO,
                    segments=12, rings=8)
parent_keep(cupula, torreta)
banda = add_cylinder("BandaCupula", (0, -0.9, 3.08), 0.56, 0.12, BANDA,
                     vertices=16)
parent_keep(banda, torreta)
escotilla = add_cylinder("Escotilla", (0, -0.9, 3.38), 0.38, 0.06, OSCURO,
                         vertices=12)
parent_keep(escotilla, torreta)
# Periscopio delante de la cúpula, antena trasera y caja lateral.
periscopio = add_box("Periscopio", (0, 0.15, 3.15), (0.5, 0.25, 0.18),
                     OSCURO)
parent_keep(periscopio, torreta)
antena = add_cylinder("Antena", (1.05, -1.5, 3.4), 0.03, 1.2, OSCURO,
                      rot=(math.radians(-8), 0, 0), vertices=8)
parent_keep(antena, torreta)
caja_torreta = add_box("CajaTorreta", (-1.35, -1.15, 2.6), (0.35, 0.9, 0.5),
                       AMARILLO_OSCURO)
parent_keep(caja_torreta, torreta)

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
# Cycles por CPU: EEVEE necesita EGL/GPU y este entorno no tiene
# librerías EGL reales (solo las de Chromium, incompletas). Con 32
# muestras las 4 vistas tardan segundos y se ven bien.
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


CENTER = (0, 1.0, 1.5)
VIEWS = {
    "frontal": (0, 14, 2.5),
    "lateral": (14, 1.0, 2.0),
    "cenital": (0, 1.0, 20),
    "tres-cuartos": (10, 11, 6),
}
for name, loc in VIEWS.items():
    look_at(cam, CENTER, loc)
    scene.render.filepath = os.path.join(PREVIEWS_DIR, "tanque_%s.png" % name)
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
