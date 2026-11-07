# Tanque enemigo Tan, amarillo/tostado, de juguete de plástico, de
# Army Men: Ataque Aéreo.
#
# Modelo original desde cero, con las proporciones y los colores del
# tanque Tan del VIDEO ORIGINAL (PS1, 1999) — no del tanque que hoy
# dibuja el juego (src/toy-renderer.js), que es más ancho que largo,
# con una cúpula alta, banda rojiza y antena que en el vídeo no se
# ven. En el vídeo el tanque es largo y estrecho (largo/ancho ~1,5),
# bajo, de amarillo paja pálido con orugas marrón oliva, torreta baja
# y pequeña con escotilla plana, cañón largo y fino con bocacha en
# forma de bloque, ruedas claras en el lateral de la oruga y una
# cruceta en X sobre la cubierta trasera. No hay tanque verde del
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


# Amarillo paja pálido del tanque Tan del vídeo original y marrón
# oliva de las orugas. El amarillo vivo del juego (0.95, 0.76, 0.2)
# es más naranja y saturado que el del vídeo, que es un mostaza paja
# claro; el marrón del juego (0.45, 0.32, 0.12) es más claro que el
# oliva oscuro de las orugas del vídeo. El modelo ya no usa la banda
# rojiza del juego: en el vídeo la torreta no lleva banda roja.
AMARILLO = make_material("AmarilloTan", (0.88, 0.74, 0.30), 0.45)
AMARILLO_OSCURO = make_material("AmarilloTanOscuro", (0.66, 0.53, 0.16), 0.5)
MARRON = make_material("MarronOscuro", (0.34, 0.29, 0.12), 0.5)
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
# Orugas y ruedas (a cada lado, x = ±1.55)
# ---------------------------------------------------------------------------
# En el vídeo el tanque es largo y estrecho (largo/ancho ~1,5), no
# casi cuadrado como antes (orugas de 3,7 de largo y 5,2 de ancho
# total): orugas de 5,6 de largo y 3,85 de ancho total. La oruga se
# ve desde arriba como una banda oscura con tacos rectangulares, y
# desde el lado se ven las ruedas de rodaje claras (amarillas) sobre
# la banda oscura. No hay guardabarros amarillos encima: en el vídeo
# la parte superior de la oruga es la banda oscura con los tacos.
for side in (-1, 1):
    tag = "Izq" if side < 0 else "Der"
    add_box("Oruga_" + tag, (side * 1.55, 0, 0.5), (0.75, 5.6, 0.8), MARRON)
    # Tacos rectangulares sobre la oruga, visibles desde arriba.
    for i, y in enumerate((-2.4, -1.8, -1.2, -0.6, 0.0, 0.6, 1.2, 1.8, 2.4)):
        add_box("Taco_%s_%d" % (tag, i), (side * 1.55, y, 0.92),
                (0.78, 0.42, 0.08), AMARILLO_OSCURO)
    # 5 ruedas de rodaje claras en la cara exterior de la oruga.
    for i, y in enumerate((-1.8, -0.9, 0.0, 0.9, 1.8)):
        add_cylinder("Rueda_%s_%d" % (tag, i), (side * 1.96, y, 0.5),
                     0.3, 0.12, AMARILLO, rot=(0, math.radians(90), 0),
                     vertices=12, smooth=False)
    # Rueda motriz trasera y tensora delantera, un poco más grandes.
    add_cylinder("Motriz_" + tag, (side * 1.96, -2.55, 0.55), 0.36, 0.12,
                 AMARILLO_OSCURO, rot=(0, math.radians(90), 0), vertices=12,
                 smooth=False)
    add_cylinder("Tensora_" + tag, (side * 1.96, 2.55, 0.55), 0.36, 0.12,
                 AMARILLO_OSCURO, rot=(0, math.radians(90), 0), vertices=12,
                 smooth=False)

# ---------------------------------------------------------------------------
# Casco
# ---------------------------------------------------------------------------
# Casco bajo y largo (el modelo anterior era alto y cuadrado: el
# casco llegaba a 2,0 de alto y la torreta con cúpula a 3,5; el del
# vídeo es chato, con la torreta baja: altura total ~2,6).
add_box("CascoInferior", (0, 0, 1.15), (2.7, 5.0, 0.75), AMARILLO)
add_box("CascoSuperior", (0, -0.1, 1.6), (2.5, 4.4, 0.3), AMARILLO)
# Placa frontal inclinada (glacis): en el vídeo el morro es amarillo
# tostado, no una plancha marrón oscura.
add_box("PlacaFrontal", (0, 2.42, 1.15), (2.5, 0.1, 0.8), AMARILLO_OSCURO,
        rot=(math.radians(-40), 0, 0))
# Cruceta en X sobre la cubierta trasera, como se ve desde arriba en
# el vídeo (dos tiras cruzadas sobre la cubierta, detrás de la torreta).
for i, ang in enumerate((-0.62, 0.62)):
    add_box("Cruceta_%d" % i, (0, -1.7, 1.78 + 0.03 * i), (0.14, 1.4, 0.05),
            AMARILLO_OSCURO, rot=(0, 0, ang))
# Ganchos de remolque en el glacis.
for side in (-1, 1):
    add_box("Gancho_%s" % ("Izq" if side < 0 else "Der"),
            (side * 0.8, 2.52, 0.95), (0.14, 0.1, 0.22), OSCURO)
# Caja de pertrechos trasera y tubo de escape.
add_box("CajaTrasera", (0, -2.55, 1.15), (1.8, 0.45, 0.35), AMARILLO_OSCURO)
add_cylinder("Escape", (1.0, -2.5, 1.0), 0.11, 0.5, OSCURO,
             rot=(math.radians(90), 0, 0), vertices=10)

# ---------------------------------------------------------------------------
# Torreta (bajo el vacío "Torreta", para poder girarla luego)
# ---------------------------------------------------------------------------
bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0.35, 1.8))
torreta = bpy.context.active_object
torreta.name = "Torreta"
bpy.context.view_layer.update()

# Anillo de la torreta sobre el casco.
anillo = add_cylinder("AnilloTorreta", (0, 0.35, 1.78), 0.88, 0.18, MARRON,
                      vertices=20)
parent_keep(anillo, torreta)
# Cuerpo de la torreta: elipsoide bajo y pequeño. En el vídeo la
# torreta es baja y ocupa poco más de la mitad del ancho del casco
# (antes era una cúpula grande, casi tan ancha como el casco, que lo
# tapaba desde arriba); desde arriba se ve redondeada, más ancha por
# detrás, con el cañón saliendo por el morro.
torre = add_sphere("TorretaCuerpo", (0, 0.35, 2.05), (0.85, 1.05, 0.45),
                   AMARILLO, segments=20, rings=10)
parent_keep(torre, torreta)
# Mantelete en el morro de la torreta, de donde sale el cañón.
mantelete = add_box("Mantelete", (0, 1.5, 2.05), (0.62, 0.3, 0.5),
                    AMARILLO_OSCURO)
parent_keep(mantelete, torreta)
# Cañón largo y FINO hacia el morro (+Y): en el vídeo el cañón es
# delgado y sobresale casi un largo de casco por delante, con una
# bocacha en forma de bloque claro en la punta (antes era grueso,
# radio 0,15, con bocacha cilíndrica oscura y grande).
canon = add_cylinder("Canon", (0, 3.35, 2.1), 0.11, 4.2, AMARILLO,
                     rot=(math.radians(90), 0, 0), vertices=12)
parent_keep(canon, torreta)
bocacha = add_box("Bocacha", (0, 5.3, 2.1), (0.3, 0.5, 0.3), AMARILLO)
parent_keep(bocacha, torreta)
anillo_bocacha = add_cylinder("AnilloBocacha", (0, 5.0, 2.1), 0.145, 0.1,
                              OSCURO, rot=(math.radians(90), 0, 0),
                              vertices=10, smooth=False)
parent_keep(anillo_bocacha, torreta)
# Escotilla del jefe: en el vídeo no hay una cúpula alta con banda
# rojiza ni antena (se quitaron las dos), solo una escotilla baja y
# plana sobre la torreta, con su tapa oscura.
cupula = add_sphere("Cupula", (0, 0.05, 2.48), (0.42, 0.42, 0.14), AMARILLO,
                    segments=12, rings=6)
parent_keep(cupula, torreta)
escotilla = add_cylinder("Escotilla", (0, 0.05, 2.6), 0.28, 0.05, OSCURO,
                         vertices=12)
parent_keep(escotilla, torreta)
# Periscopio bajo delante de la escotilla.
periscopio = add_box("Periscopio", (0, 0.95, 2.32), (0.4, 0.2, 0.12),
                     OSCURO)
parent_keep(periscopio, torreta)

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
