# Helicóptero de juguete verde (estilo Huey) de Army Men: Ataque Aéreo.
#
# Modelo original desde cero, con las proporciones y los colores del
# helicóptero del juego (src/toy-helicopter.js): fuselaje verde alargado,
# cabina de cristal oscuro, cola con estabilizador y rotor de cola, rotor
# principal de 2 palas, alas cortas con lanzacohetes y patines.
#
# Uso (Blender 4.2, headless):
#   blender --background --python assets/blender/helicoptero.py
#
# Regenera: assets/helicoptero.glb, assets/helicoptero.gltf (embebido,
# el que se sube al repo porque la API de GitHub no admite binarios) y
# las 4 vistas previas en assets/blender/previews/.
#
# Coordenadas en Blender: morro hacia +Y, arriba +Z, metros. Al exportar
# a glTF el morro queda hacia +Z (adelante en glTF) y arriba es +Y.
# El rotor principal queda como objetos RotorBlade_L/R bajo el vacío
# "Rotor", para poder girarlo luego en el juego.
import base64
import json
import math
import os
import struct
import sys

import bpy

# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
ASSETS_DIR = os.path.join(REPO_ROOT, "assets")
PREVIEWS_DIR = os.path.join(SCRIPT_DIR, "previews")
GLB_PATH = os.path.join(ASSETS_DIR, "helicoptero.glb")
GLTF_PATH = os.path.join(ASSETS_DIR, "helicoptero.gltf")
STATS_PATH = os.path.join(SCRIPT_DIR, "helicoptero-stats.json")

# Límite de polígonos para que el modelo corra bien en un iPhone.
MAX_TRIS = 5000

# ---------------------------------------------------------------------------
# Materiales (colores lineales del juego, src/toy-helicopter.js)
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


VERDE = make_material("VerdePlastico", (0.17, 0.53, 0.035), 0.42)
VERDE_CLARO = make_material("VerdeClaro", (0.30, 0.66, 0.055), 0.42)
VERDE_OSCURO = make_material("VerdeOscuro", (0.065, 0.24, 0.025), 0.5)
CRISTAL = make_material("Cristal", (0.025, 0.045, 0.035), 0.12, 0.25)
MARFIL = make_material("Marfil", (0.9, 0.92, 0.73), 0.5)
ROJO = make_material("Rojo", (0.9, 0.12, 0.035), 0.4, 0.0, emission=(0.9, 0.12, 0.035))
OSCURO = make_material("MetalOscuro", (0.15, 0.15, 0.13), 0.55, 0.4)

# ---------------------------------------------------------------------------
# Ayudas de construcción
# ---------------------------------------------------------------------------
def add_sphere(name, loc, scale, mat, segments=32, rings=16):
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


def add_cylinder(name, loc, radius, depth, mat, rot=(0.0, 0.0, 0.0), vertices=24,
                 radius2=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius,
        radius2=radius if radius2 is None else radius2,
        depth=depth, location=loc, rotation=rot,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def add_disc(name, loc, radius, mat, rot=(0.0, 0.0, 0.0), vertices=12):
    """Disco plano (cilindro muy bajo) para insignias y luces."""
    return add_cylinder(name, loc, radius, 0.05, mat, rot=rot, vertices=vertices)


# ---------------------------------------------------------------------------
# Limpieza de escena
# ---------------------------------------------------------------------------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
    pass  # los materiales se reutilizan por nombre

# ---------------------------------------------------------------------------
# Fuselaje y cabina
# ---------------------------------------------------------------------------
# Casco alargado, morro hacia +Y (el juego lo dibuja con z +3,7 al morro).
add_sphere("Fuselaje", (0, 0.65, 0), (1.35, 3.7, 1.15), VERDE, 20, 10)
# Parabrisas delantero: casco oscuro que asoma por delante y por arriba.
add_sphere("CabinaDelantera", (0, 2.75, 0.50), (1.02, 1.35, 0.62), CRISTAL, 16, 10)
# Cabina trasera: segunda sección de cristal sobre el lomo.
add_sphere("CabinaTrasera", (0, 0.55, 0.88), (1.05, 0.95, 0.55), CRISTAL, 16, 10)
# Marco claro del parabrisas y franja oscura del lomo.
add_box("MarcoParabrisas", (0, 2.05, 1.0), (1.0, 0.14, 0.08), VERDE_CLARO)
add_box("FranjaLomo", (0, -0.75, 1.18), (0.53, 0.50, 0.14), VERDE_OSCURO)
add_box("FranjaLomoClara", (0, -0.75, 1.32), (0.41, 0.37, 0.06), VERDE_CLARO)

# Motores a los lados, con escapes oscuros hacia atrás.
for side in (-1, 1):
    add_sphere("Motor_%s" % ("Izq" if side < 0 else "Der"),
               (side * 1.14, -1.55, 0.64), (0.59, 1.55, 0.72), VERDE, 12, 8)
    add_cylinder("Escape_%s" % ("Izq" if side < 0 else "Der"),
                 (side * 1.14, -2.84, 0.65), 0.41, 0.12, OSCURO,
                 rot=(math.radians(90), 0, 0), vertices=12)

# Insignia redonda de marfil con centro verde a cada lado del fuselaje.
for side in (-1, 1):
    add_disc("Insignia_%s" % ("Izq" if side < 0 else "Der"),
             (side * 1.36, 0.5, 0.2), 0.5, MARFIL,
             rot=(0, math.radians(90) * side, 0), vertices=12)
    add_disc("InsigniaCentro_%s" % ("Izq" if side < 0 else "Der"),
             (side * 1.39, 0.5, 0.2), 0.33, VERDE,
             rot=(0, math.radians(90) * side, 0), vertices=12)

# Cañones del morro y sensor oscuro bajo el morro.
for side in (-1, 1):
    add_cylinder("Canon_%s" % ("Izq" if side < 0 else "Der"),
                 (side * 0.85, 3.9, -0.8), 0.10, 0.65, OSCURO,
                 rot=(math.radians(90), 0, 0), vertices=12)
add_sphere("SensorMorro", (0, 2.4, -1.35), (0.22, 0.32, 0.32), CRISTAL,
           segments=10, rings=6)

# ---------------------------------------------------------------------------
# Cola: botalón, estabilizador, deriva y rotor de cola
# ---------------------------------------------------------------------------
# Botalón cónico desde el fuselaje hasta la deriva.
add_cylinder("BotalonCola", (0, -4.55, 0.18), 0.30, 3.6, VERDE,
             rot=(math.radians(90), 0, 0), vertices=12, radius2=0.15)
add_sphere("UnionCola", (0, -2.9, 0.18), (0.32, 0.5, 0.32), VERDE,
           segments=10, rings=6)
# Estabilizador horizontal.
add_box("Estabilizador", (0, -6.2, 0.35), (1.35, 0.45, 0.12), VERDE)
# Deriva vertical clara con luz roja en la punta y mástil.
add_box("Deriva", (0, -6.6, 1.2), (0.15, 0.44, 1.1), VERDE_CLARO)
add_cylinder("MastilBaliza", (0, -6.6, 2.0), 0.06, 0.5, OSCURO,
             vertices=8)
add_sphere("BalizaCola", (0, -6.6, 2.28), (0.15, 0.17, 0.18), ROJO,
           segments=10, rings=6)
# Luces rojas de navegación en los extremos del estabilizador.
for side in (-1, 1):
    add_sphere("LuzCola_%s" % ("Izq" if side < 0 else "Der"),
               (side * 1.5, -6.3, 0.43), (0.14, 0.18, 0.17), ROJO,
               segments=8, rings=6)
# Rotor de cola: buje y 2 palas en el lado izquierdo de la deriva.
add_cylinder("BujeRotorCola", (-0.18, -6.6, 1.1), 0.12, 0.15, OSCURO,
             rot=(0, math.radians(90), 0), vertices=12)
for i, ang in enumerate((math.radians(20), math.radians(110))):
    add_box("PalaRotorCola_%d" % i, (-0.28, -6.6, 1.1),
            (0.05, 0.26, 1.05), OSCURO, rot=(ang, 0, 0))

# ---------------------------------------------------------------------------
# Rotor principal: mástil, buje y 2 palas (bajo el vacío "Rotor")
# ---------------------------------------------------------------------------
# Base abombada del rotor sobre el lomo (el mástil no flota en el aire).
add_sphere("BaseRotor", (0, -1.8, 1.0), (0.67, 0.67, 0.35), VERDE_CLARO,
           segments=16, rings=8)
add_cylinder("MastilRotor", (0, -1.8, 1.6), 0.13, 1.3, OSCURO, vertices=12)
add_sphere("BujeRotor", (0, -1.8, 2.4), (0.48, 0.48, 0.18), VERDE_CLARO,
           segments=16, rings=8)
add_sphere("TapaBuje", (0, -1.8, 2.58), (0.17, 0.15, 0.17), ROJO,
           segments=10, rings=6)

bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, -1.8, 2.4))
rotor = bpy.context.active_object
rotor.name = "Rotor"

for side, tag in ((-1, "Izq"), (1, "Der")):
    # Pala: de x=0,6 a x=8,2, cuerda 0,32, con franjas marfil en la punta.
    blade = add_box("RotorBlade_" + tag, (side * 4.4, -1.8, 2.4),
                    (7.6, 0.32, 0.07), VERDE)
    blade.parent = rotor
    for x in (6.8, 7.25):
        tip = add_box("RotorPunta_%s_%s" % (tag, x), (side * x, -1.8, 2.48),
                      (0.10, 0.33, 0.025), MARFIL)
        tip.parent = rotor
    cap = add_sphere("RotorCap_%s" % tag, (side * 8.0, -1.8, 2.4),
                     (0.48, 0.39, 0.16), VERDE_CLARO, segments=10, rings=6)
    cap.parent = rotor

# ---------------------------------------------------------------------------
# Alas cortas, lanzacohetes y patines
# ---------------------------------------------------------------------------
for side in (-1, 1):
    tag = "Izq" if side < 0 else "Der"
    # Ala corta con ligera inclinación.
    add_box("Ala_" + tag, (side * 2.85, -0.8, 0.1), (1.85, 0.72, 0.14),
            VERDE, rot=(0, 0, side * -0.12))
    # Insignia redonda sobre el ala.
    add_disc("InsigniaAla_" + tag, (side * 3.0, -0.8, 0.19), 0.45, MARFIL)
    add_disc("InsigniaAlaCentro_" + tag, (side * 3.0, -0.8, 0.22), 0.33,
             VERDE)
    # Luz roja en la punta del ala.
    add_sphere("LuzAla_" + tag, (side * 4.55, -0.65, 0.0),
               (0.32, 0.36, 0.5), OSCURO, segments=10, rings=6)
    # Lanzacohetes: 2 filas x 3 cohetes bajo cada ala, con punta marfil.
    for row, z in enumerate((-0.45, -1.0)):
        for col, x in enumerate((2.1, 2.75, 3.4)):
            add_cylinder("Cohete_%s_%d_%d" % (tag, row, col),
                         (side * x, -0.38, z), 0.23, 1.05, VERDE,
                         rot=(math.radians(90), 0, 0), vertices=10)
            add_cylinder("PuntaCohete_%s_%d_%d" % (tag, row, col),
                         (side * x, 0.28, z), 0.23, 0.30, MARFIL,
                         rot=(math.radians(-90), 0, 0), vertices=8,
                         radius2=0.02)
    # Patín: tubo a lo largo del fuselaje + 2 soportes hasta la panza.
    add_cylinder("Patin_" + tag, (side * 1.35, 1.0, -1.35), 0.09, 4.6,
                 OSCURO, rot=(math.radians(90), 0, 0), vertices=12)
    for y in (-0.5, 2.5):
        add_cylinder("SoportePatin_%s_%s" % (tag, y),
                     (side * 1.35, y, -1.15), 0.06, 0.45, OSCURO,
                     vertices=8)

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
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

sun_data = bpy.data.lights.new("Sol", type="SUN")
sun_data.energy = 2.5
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


import mathutils

CENTER = (0, -0.8, 1.0)
VIEWS = {
    "frontal": (0, 15, 2.5),
    "lateral": (15, -0.8, 2.0),
    "cenital": (0, -0.8, 22),
    "tres-cuartos": (10, -11, 7),
}
for name, loc in VIEWS.items():
    look_at(cam, CENTER, loc)
    scene.render.filepath = os.path.join(PREVIEWS_DIR, "helicoptero_%s.png" % name)
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
