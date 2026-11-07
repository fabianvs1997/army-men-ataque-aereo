# Tanque enemigo Tan, amarillo/tostado, de juguete de plástico, de
# Army Men: Ataque Aéreo.
#
# Modelo original desde cero, con las proporciones y los colores del
# tanque Tan del VIDEO ORIGINAL (PS1, 1999) — no del tanque que hoy
# dibuja el juego (src/toy-renderer.js), que es más ancho que largo,
# con una cúpula alta, banda rojiza y antena que en el vídeo no se
# ven. Se estudiaron LOS DOS vídeos que compartió Fabian: el gameplay
# de Betão Play (61,9 s) y el montaje (125,5 s). Los dos muestran el
# MISMO tanque (no hay conflicto entre vídeos): largo y estrecho
# (largo/ancho ~1,5), bajo, de amarillo mostaza vivo con un toque
# verde (no paja pálido), orugas de un oliva muy oscuro con ruedas
# claras, torreta GRANDE en cúpula redondeada con escotilla plana y
# circular, cañón largo y fino con bocacha cilíndrica, glacis
# amarillo sin ganchos negros, sin cruceta en X en la cubierta (no
# se ve en ningún fotograma claro) y con dos faros redondos en la
# cubierta delantera y una rejilla oscura en la trasera. No hay
# tanque verde del jugador en el juego (el jugador es el
# helicóptero), así que solo se modela la variante Tan.
#
# Referencias (fotogramas mirados antes de tocar el modelo):
# - Vídeo 1 (Betão Play), ~50-52 s: vista lateral 3/4 nítida del
#   tanque junto al camino — amarillo vivo, banda de oruga muy
#   oscura con ruedas claras, cúpula grande, cañón fino.
# - Vídeo 2 (montaje), ~63-67 s: vista cenital y lateral con el
#   cañón apuntando — cúpula grande con escotilla circular, tacos
#   de la oruga, dos círculos claros en la cubierta delantera,
#   panel verdoso en la trasera, cañón que sobresale ~30% del casco.
# - Vídeo 2, ~111 s: vista cenital más clara — casco 1,5:1, torreta
#   ~57% del ancho del casco, cubierta sin X, faldones con tacos.
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


# Amarillo mostaza vivo del tanque Tan de los vídeos y oliva muy
# oscuro de las orugas. Colores muestreados con herramientas de los
# fotogramas claros (no a ojo): la zona iluminada de la torreta en
# el vídeo 1 (~51 s) es sRGB #F4E34B, lineal (0.90, 0.77, 0.07), y
# el costado iluminado en el vídeo 2 (~66 s) es sRGB #E1D921,
# lineal (0.75, 0.69, 0.02). El amarillo paja pálido de la revisión
# anterior (0.88, 0.74, 0.30) tiene demasiado azul: en el render
# salía crema/beige, no el mostaza vivo con toque verde del vídeo.
# La banda de la oruga en el vídeo 1 (~51 s) es sRGB #2A2803 en la
# cara en sombra: un oliva casi negro, mucho más oscuro que el
# marrón (0.34, 0.29, 0.12) de antes. El amarillo vivo del juego
# (0.95, 0.76, 0.2) es más naranja que el del vídeo. El modelo ya
# no usa la banda rojiza del juego: en el vídeo la torreta no lleva
# banda roja.
AMARILLO = make_material("AmarilloTan", (0.85, 0.72, 0.06), 0.45)
AMARILLO_OSCURO = make_material("AmarilloTanOscuro", (0.45, 0.40, 0.05), 0.5)
MARRON = make_material("MarronOscuro", (0.18, 0.16, 0.04), 0.5)
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
# En los vídeos el tanque es largo y estrecho (largo/ancho ~1,5),
# confirmado por la vista cenital del vídeo 2 (~63 s y ~111 s):
# orugas de 5,6 de largo y 3,85 de ancho total. La oruga se ve
# desde arriba como una banda oscura con tacos rectangulares, y
# desde el lado se ven las ruedas de rodaje claras (amarillas) sobre
# la banda MUY oscura (vídeo 1, ~51 s). Los tacos son de un
# amarillo oliva oscuro y van casi a ras de la banda (en el vídeo
# se leen como parte de la oruga, no como una escalera pálida).
# No hay guardabarros amarillos encima.
for side in (-1, 1):
    tag = "Izq" if side < 0 else "Der"
    add_box("Oruga_" + tag, (side * 1.55, 0, 0.45), (0.75, 5.6, 0.8), MARRON)
    # Tacos rectangulares sobre la oruga, visibles desde arriba.
    for i, y in enumerate((-2.4, -1.8, -1.2, -0.6, 0.0, 0.6, 1.2, 1.8, 2.4)):
        add_box("Taco_%s_%d" % (tag, i), (side * 1.55, y, 0.86),
                (0.78, 0.42, 0.06), AMARILLO_OSCURO)
    # 5 ruedas de rodaje claras en la cara exterior de la oruga.
    for i, y in enumerate((-1.8, -0.9, 0.0, 0.9, 1.8)):
        add_cylinder("Rueda_%s_%d" % (tag, i), (side * 1.94, y, 0.45),
                     0.28, 0.12, AMARILLO, rot=(0, math.radians(90), 0),
                     vertices=12, smooth=False)
    # Rueda motriz trasera y tensora delantera, un poco más grandes;
    # en el vídeo son amarillas claras como las de rodaje, no oscuras.
    add_cylinder("Motriz_" + tag, (side * 1.94, -2.55, 0.5), 0.32, 0.12,
                 AMARILLO, rot=(0, math.radians(90), 0), vertices=12,
                 smooth=False)
    add_cylinder("Tensora_" + tag, (side * 1.94, 2.55, 0.5), 0.32, 0.12,
                 AMARILLO, rot=(0, math.radians(90), 0), vertices=12,
                 smooth=False)

# ---------------------------------------------------------------------------
# Casco
# ---------------------------------------------------------------------------
# Casco bajo y largo. En la vista lateral del vídeo 2 (~66 s) la
# altura total (hasta la torreta) es ~0,4 veces el largo del casco,
# así que el modelo anterior (2,6 m de alto) era demasiado alto:
# ahora la altura total es ~2,4 m. La cubierta superior es más
# estrecha que antes (2,3 en vez de 2,5) para que desde arriba no se
# vea una gran losa pálida vacía: en el vídeo la cubierta la tapan
# casi entera la torreta y las orugas.
add_box("CascoInferior", (0, 0, 1.0), (2.6, 5.0, 0.6), AMARILLO)
add_box("CascoSuperior", (0, -0.1, 1.4), (2.3, 4.2, 0.25), AMARILLO)
# Placa frontal inclinada (glacis): en los vídeos el morro es
# amarillo, igual que el casco (vídeo 1, ~51 s; vídeo 2, ~66 s),
# sin plancha oscura ni ganchos negros a la vista.
add_box("PlacaFrontal", (0, 2.45, 1.0), (2.3, 0.1, 0.85), AMARILLO,
        rot=(math.radians(-45), 0, 0))
# Rejilla oscura y plana sobre la cubierta trasera: en la vista
# cenital del vídeo 2 (~63 s) detrás de la torreta se ve un panel
# rectangular verdoso más oscuro, discreto (no una losa negra que
# domine la cubierta). Sin cruceta en X: en ningún fotograma claro
# (vídeo 2, ~63 s y ~111 s) se ve una X en la cubierta, así que se
# quitó.
add_box("RejillaTrasera", (0, -1.7, 1.54), (1.0, 0.7, 0.04),
        AMARILLO_OSCURO)
# Dos faros redondos y planos en la cubierta delantera: en la vista
# cenital del vídeo 2 (~63 s) se ven dos círculos claros delante de
# la torreta, sobre el morro.
for side in (-1, 1):
    add_cylinder("Faro_%s" % ("Izq" if side < 0 else "Der"),
                 (side * 0.7, 1.9, 1.54), 0.16, 0.06, AMARILLO,
                 vertices=10, smooth=False)
# Caja de pertrechos trasera (amarilla: en la vista trasera del
# vídeo 1, ~50 s, la trasera es amarilla con una ranura oscura) y
# tubo de escape pequeño y oscuro.
add_box("CajaTrasera", (0, -2.5, 1.0), (1.6, 0.4, 0.3), AMARILLO)
add_cylinder("Escape", (0.9, -2.55, 0.95), 0.09, 0.4, OSCURO,
             rot=(math.radians(90), 0, 0), vertices=10)

# ---------------------------------------------------------------------------
# Torreta (bajo el vacío "Torreta", para poder girarla luego)
# ---------------------------------------------------------------------------
bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0.2, 1.55))
torreta = bpy.context.active_object
torreta.name = "Torreta"
bpy.context.view_layer.update()

# Anillo de la torreta sobre el casco (en el vídeo 1, ~51 s, se ve
# una línea oscura entre la torreta y el casco).
anillo = add_cylinder("AnilloTorreta", (0, 0.2, 1.55), 1.0, 0.16, MARRON,
                      vertices=20)
parent_keep(anillo, torreta)
# Cuerpo de la torreta: una cúpula redondeada GRANDE. La revisión
# anterior la hizo pequeña y achatada (1,7 de ancho, 44% del casco)
# y era el fallo más visible desde arriba: en los vídeos la cúpula
# ocupa ~57% del ancho del casco (vídeo 2, ~111 s: ~2,1-2,2 m de
# ancho) y casi la mitad del largo del casco, y es lo que más se ve
# desde arriba. Es una semiesfera achatada, no un elipsoide bajo.
torre = add_sphere("TorretaCuerpo", (0, 0.2, 1.85), (1.05, 1.2, 0.5),
                   AMARILLO, segments=20, rings=10)
parent_keep(torre, torreta)
# Mantelete en el morro de la torreta, de donde sale el cañón: un
# collar cilíndrico pequeño y redondeado, no la caja grande de
# antes (en el vídeo 2, ~66 s, el cañón sale directo de la cúpula).
mantelete = add_cylinder("Mantelete", (0, 1.35, 1.9), 0.3, 0.35, AMARILLO,
                         rot=(math.radians(90), 0, 0), vertices=12)
parent_keep(mantelete, torreta)
# Cañón largo y FINO hacia el morro (+Y). En el vídeo 2 (~66 s) el
# cañón sobresale por delante del casco ~30% del largo del casco
# (~1,7 m), no casi 3 m como antes; y la bocacha es un cilindro un
# poco más ancho y más oscuro en la punta, no un bloque pálido con
# anillo negro.
canon = add_cylinder("Canon", (0, 2.7, 1.9), 0.13, 3.2, AMARILLO,
                     rot=(math.radians(90), 0, 0), vertices=12)
parent_keep(canon, torreta)
bocacha = add_cylinder("Bocacha", (0, 4.15, 1.9), 0.17, 0.4,
                       AMARILLO_OSCURO, rot=(math.radians(90), 0, 0),
                       vertices=12, smooth=False)
parent_keep(bocacha, torreta)
# Escotilla del jefe: en los vídeos (vídeo 2, ~63 s y ~111 s) es
# un círculo plano sobre la cúpula, amarillo con un aro fino más
# oscuro alrededor — no el disco negro grande de antes, que desde
# arriba se leía como un agujero. Sin periscopio: en ningún
# fotograma claro se ve una caja oscura sobre la torreta.
aro = add_cylinder("AroEscotilla", (0, 0.2, 2.36), 0.38, 0.03, OSCURO,
                   vertices=12, smooth=False)
parent_keep(aro, torreta)
escotilla = add_cylinder("Escotilla", (0, 0.2, 2.38), 0.3, 0.05, AMARILLO,
                         vertices=12, smooth=False)
parent_keep(escotilla, torreta)

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
