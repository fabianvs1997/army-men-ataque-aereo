# Jeep/camión ligero enemigo Tan, amarillo mostaza, de juguete de
# plástico, de Army Men: Ataque Aéreo.
#
# Modelo original desde cero, con las proporciones y los colores del
# vehículo Tan del VÍDEO ORIGINAL (montaje, 125,5 s, Misión 1
# «Plastic Pandemonium»): en el catálogo fotograma a fotograma
# (~/workspace/departamento-videojuegos/catalogo-mision-video-m1.md)
# aparece al menos un vehículo amarillo Tan en la zona norte del
# valle. No hay plano claro del vehículo en el montaje, así que se
# modela el jeep/camión ligero clásico de los Army Men: chasis bajo
# y largo, capó delantero, cabina abierta con parabrisas, caja
# trasera con lona, cuatro ruedas grandes con bujes claros y rueda
# de repuesto detrás. Amarillo mostaza vivo como el tanque Tan
# (muestreado de los fotogramas del vídeo), ruedas de oliva casi
# negro con bujes amarillos, sin insignias ni nada rojo.
#
# Uso (Blender 4.2, headless):
#   blender --background --python assets/blender/jeep.py
#
# Regenera: assets/jeep-tan.glb, assets/jeep-tan.gltf (embebido,
# el que se sube al repo porque la API de GitHub no admite binarios) y
# las 4 vistas previas en assets/blender/previews/.
#
# Coordenadas en Blender: morro hacia +Y, arriba +Z, metros. Al exportar
# a glTF el morro queda hacia +Z (adelante en glTF) y arriba es +Y.
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
GLB_PATH = os.path.join(ASSETS_DIR, "jeep-tan.glb")
GLTF_PATH = os.path.join(ASSETS_DIR, "jeep-tan.gltf")
STATS_PATH = os.path.join(SCRIPT_DIR, "jeep-stats.json")

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


# Amarillo mostaza vivo del tanque Tan de los vídeos (muestreado de
# fotogramas: sRGB #F4E34B en la zona iluminada, lineal
# (0.90, 0.77, 0.07)); el modelo usa el mismo amarillo para que el
# jeep se lea como Tan junto a los tanques. Ruedas de oliva casi
# negro, lona caqui oscuro y cristal ahumado.
AMARILLO = make_material("AmarilloTan", (0.85, 0.72, 0.06), 0.45)
AMARILLO_OSCURO = make_material("AmarilloTanOscuro", (0.45, 0.40, 0.05), 0.5)
OSCURO = make_material("MetalOscuro", (0.15, 0.15, 0.13), 0.55, 0.4)
RUEDA = make_material("RuedaOscura", (0.10, 0.09, 0.05), 0.6)
LONA = make_material("LonaCaqui", (0.42, 0.38, 0.18), 0.6)
CRISTAL = make_material("CristalAhumado", (0.12, 0.16, 0.18), 0.25, 0.1)
FARO = make_material("FaroClaro", (0.95, 0.92, 0.75), 0.3, 0.1,
                     emission=(0.9, 0.85, 0.6))

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
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


# ---------------------------------------------------------------------------
# Limpieza de escena
# ---------------------------------------------------------------------------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------------------
# Chasis y carrocería (morro hacia +Y; largo total ~4,4 m)
# ---------------------------------------------------------------------------
# Chasis bajo, capó delantero estrecho y caja trasera ancha: la
# silueta de un jeep/camión ligero de juguete, no de un turismo.
add_box("Chasis", (0, 0, 0.55), (1.7, 4.4, 0.35), OSCURO)
add_box("Capo", (0, 1.55, 1.05), (1.5, 1.3, 0.55), AMARILLO)
add_box("Parrilla", (0, 2.22, 0.95), (1.4, 0.12, 0.45), OSCURO)
# Faros redondos en el frontal.
for side in (-1, 1):
    add_cylinder("Faro_" + ("Izq" if side < 0 else "Der"),
                 (side * 0.55, 2.28, 1.05), 0.16, 0.08, FARO,
                 rot=(math.radians(90), 0, 0), vertices=12, smooth=False)
# Cabina abierta: suelo, laterales bajos, asientos y parabrisas.
add_box("CabinaSuelo", (0, 0.35, 0.95), (1.6, 1.5, 0.3), AMARILLO)
for side in (-1, 1):
    add_box("CabinaLateral_" + ("Izq" if side < 0 else "Der"),
            (side * 0.78, 0.35, 1.15), (0.12, 1.5, 0.5), AMARILLO)
    add_box("Asiento_" + ("Izq" if side < 0 else "Der"),
            (side * 0.4, 0.15, 1.25), (0.6, 0.45, 0.35), LONA)
    add_box("Respaldo_" + ("Izq" if side < 0 else "Der"),
            (side * 0.4, -0.15, 1.45), (0.6, 0.18, 0.55), LONA)
# Parabrisas: marco amarillo y cristal ahumado inclinado.
add_box("ParabrisasMarco", (0, 1.12, 1.55), (1.5, 0.1, 0.7), AMARILLO)
add_box("Parabrisas", (0, 1.13, 1.55), (1.3, 0.04, 0.5), CRISTAL)
# Arco antivuelco detrás de la cabina.
add_box("ArcoIzq", (-0.72, -0.45, 1.6), (0.1, 0.1, 0.8), OSCURO)
add_box("ArcoDer", (0.72, -0.45, 1.6), (0.1, 0.1, 0.8), OSCURO)
add_box("ArcoSup", (0, -0.45, 2.0), (1.54, 0.1, 0.1), OSCURO)
# Caja trasera con lona: laterales, fondo y lona abombada.
add_box("CajaSuelo", (0, -1.45, 0.95), (1.7, 1.9, 0.3), AMARILLO)
for side in (-1, 1):
    add_box("CajaLateral_" + ("Izq" if side < 0 else "Der"),
            (side * 0.8, -1.45, 1.25), (0.12, 1.9, 0.6), AMARILLO)
add_box("CajaTrasera", (0, -2.38, 1.25), (1.7, 0.12, 0.6), AMARILLO)
add_sphere("Lona", (0, -1.45, 1.55), (0.85, 0.95, 0.35), LONA,
           segments=16, rings=8)
# Parachoques delantero y trasero.
add_box("ParachoquesDel", (0, 2.3, 0.6), (1.7, 0.15, 0.25), OSCURO)
add_box("ParachoquesTras", (0, -2.3, 0.6), (1.7, 0.15, 0.25), OSCURO)
# Rueda de repuesto vertical detrás de la caja.
add_cylinder("Repuesto", (0, -2.45, 1.25), 0.42, 0.18, RUEDA,
             rot=(math.radians(90), 0, 0), vertices=16, smooth=False)
add_cylinder("RepuestoBuje", (0, -2.45, 1.25), 0.2, 0.22, AMARILLO,
             rot=(math.radians(90), 0, 0), vertices=12, smooth=False)

# ---------------------------------------------------------------------------
# Ruedas (4, con buje amarillo claro)
# ---------------------------------------------------------------------------
for side in (-1, 1):
    for y in (1.45, -1.45):
        tag = ("Del_" if y > 0 else "Tras_") + ("Izq" if side < 0 else "Der")
        add_cylinder("Rueda_" + tag, (side * 0.88, y, 0.42), 0.42, 0.22,
                     RUEDA, rot=(0, math.radians(90), 0), vertices=16,
                     smooth=False)
        add_cylinder("Buje_" + tag, (side * 1.0, y, 0.42), 0.2, 0.24,
                     AMARILLO, rot=(0, math.radians(90), 0), vertices=12,
                     smooth=False)

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


CENTER = (0, 0, 1.0)
VIEWS = {
    "frontal": (0, 12, 2.0),
    "lateral": (12, 0, 1.5),
    "cenital": (0, 0, 16),
    "tres-cuartos": (9, 9, 5),
}
for name, loc in VIEWS.items():
    look_at(cam, CENTER, loc)
    scene.render.filepath = os.path.join(PREVIEWS_DIR, "jeep_%s.png" % name)
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
