# Helicóptero de juguete verde (estilo Huey) de Army Men: Ataque Aéreo.
#
# Modelo original desde cero. Revisión 3 ajustada a LOS DOS videos del
# original (PS1, 1999) — la revisión 2 solo usó el segundo video y ese
# fue el error:
#
# Video 1 (Betão Play Oficial, 61,9 s, gameplay; 21 fotogramas 1/3 s +
# denso 1 fps en 10-20 s y 42-60 s): el helicóptero se ve grande y
# claro en vista cenital/3-4. Referencias: ~3 s (visto por detrás,
# rotor con puntas amarillas, estelas rojas de las trazadoras del
# morro — no son parte del modelo), ~12 s (vista cenital: cabina
# verde lisa sin insignias, botalón largo y fino, estabilizador con
# puntas amarillas), ~15 s (rotor girando, puntas amarillas en arco).
# Video 2 (montaje, 125,5 s; 42 fotogramas): mismo helicóptero verde
# en las partidas (p. ej. ~57 s, vista lateral: cabina corta y
# cuadrada, botalón largo y fino, patines finos y oscuros bajo la
# panza) y portada del juego arriba del todo (~57 s: morro redondeado
# verde con UNA banda ancha oscura de parabrisas en el frontal y
# techo verde). Los dos videos muestran el mismo modelo, así que se
# ajusta a los dos; el video 1 manda en proporciones (se ve más
# grande) y el video 2 en el frontal y el lateral.
#
# Diferencias corregidas en esta revisión (rev. 2 -> rev. 3):
# - Cabina corta y cuadrada, no un elipsoide largo: el fuselaje pasa
#   de 7,4 m a 5,2 m de largo (2,7 de ancho, 2,3 de alto); en el
#   video la cabina mide ~2,2 veces su alto y el botalón ~lo mismo
#   que la cabina.
# - Botalón largo y fino: de 3,6 m a 5,7 m (radio 0,26 -> 0,12),
#   hasta la deriva en y=-7,5; antes era la mitad de corto que la
#   cabina y en el video es tan largo como ella.
# - Rotor más corto y palas más anchas: envergadura 17 m -> 14,8 m
#   (en el video el disco mide ~1,3-1,5 veces la cabina, no 2,3) y
#   cuerda 0,32 -> 0,50, con puntas amarillas del 15 % como en el
#   video; el mástil se mueve a y=-1,2, sobre la cabina.
# - Parabrisas hundido: la banda oscura ya no asoma por encima del
#   morro en la vista cenital (en la rev. 2 se veía un "bigote"
#   negro en la cenital); sigue leyéndose como banda ancha oscura
#   de frente, como en la portada del video 2.
# - Sin insignias blancas: en ninguno de los dos videos se ve un
#   círculo blanco/marfil en el fuselaje ni en las alas (la cabina
#   es verde lisa); se quitan las 8 insignias. El juego hoy sí
#   dibuja una insignia en el ala (src/toy-helicopter.js), pero los
#   videos mandan para el modelo.
# - Estabilizador con puntas amarillas (verde en el centro, amarillo
#   en los extremos), como se ve claro en el video 1 ~12 s.
# - Sin rojo en el modelo: se quitan la baliza roja con su mástil,
#   las luces rojas de las puntas del estabilizador y el tapón rojo
#   del buje (en la cenital se veía un punto rojo en el centro del
#   rotor que no existe en los videos). La barra roja vertical que
#   se ve en el video 1 ~3 s y ~15 s sobre el eje del helicóptero
#   son trazadoras disparadas por los cañones del morro, no parte
#   del helicóptero: hay varias estelas iguales sueltas por el
#   camino en el mismo fotograma.
# - Motores más pequeños y pegados al fuselaje: antes eran dos
#   bultos enormes que dominaban la vista trasera; en el video los
#   lados de la cabina son casi lisos.
# - Patines metidos bajo la panza (x ±1,35 -> ±1,05, más bajos):
#   desde arriba no se veían en el video; de lado se ven finos y
#   oscuros bajo la panza (video 2 ~57 s).
# - Puntas de los cohetes verdes, no marfil: en los videos no hay
#   nada blanco en el helicóptero.
# - Verde ajustado al muestreo de los fotogramas claros del video 1
#   (mediana sRGB ~52, 193, 51 al sol): (0.04, 0.52, 0.04) lineal.
# Nada se copia del original: solo se mira cómo se ve y se remodela.
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
# Materiales (colores lineales; verde muestreado de los fotogramas)
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


# Verde del video 1 muestreado al sol: sRGB mediana ~52, 193, 51
# (el verde anterior, 0.05/0.52/0.02, salía sRGB ~62, 191, 39, algo
# más amarillento). El amarillo es el de las puntas del rotor, que en
# el video se ven doradas en el rotor girando.
VERDE = make_material("VerdePlastico", (0.04, 0.52, 0.04), 0.42)
VERDE_CLARO = make_material("VerdeClaro", (0.18, 0.68, 0.05), 0.42)
VERDE_OSCURO = make_material("VerdeOscuro", (0.03, 0.24, 0.02), 0.5)
AMARILLO = make_material("Amarillo", (0.80, 0.55, 0.03), 0.42)
CRISTAL = make_material("Cristal", (0.025, 0.045, 0.035), 0.12, 0.25)
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
# Cabina corta y cuadrada (5,2 m de largo): en el video la cabina
# mide ~2,2 veces su alto y el botalón ~lo mismo que la cabina; el
# elipsoide largo de la rev. 2 (7,4 m) no se parecía.
add_sphere("Fuselaje", (0, 0.65, 0), (1.35, 2.6, 1.15), VERDE, 20, 10)
# Parabrisas delantero: UNA banda ancha oscura en la cara frontal,
# como en la portada del video 2. Banda ancha y baja (ancho 0,72,
# alto 0,30, centrada arriba en z=0,25): de frente se lee como la
# banda oscura del original con el morro verde debajo, y desde
# arriba apenas asoma una pestaña fina en la punta del morro.
# (Primer intento de la rev. 3 era una esfera que de frente se veía
# como un óvalo negro enorme en mitad del morro.)
add_sphere("CabinaDelantera", (0, 2.8, 0.25), (0.72, 0.50, 0.30), CRISTAL, 16, 10)
# Cabina trasera: ventanilla lateral baja, visible de lado y oculta
# desde arriba.
add_sphere("CabinaTrasera", (0, 0.7, 0.45), (1.36, 0.70, 0.38), CRISTAL, 16, 10)
# Sin insignias blancas ni marco claro: en los dos videos la cabina
# es verde lisa, sin círculos blancos ni marcos claros.

# Motores a los lados, con escapes oscuros hacia atrás. Pequeños y
# pegados al fuselaje, donde la cabina es ancha: en la rev. 3 iban
# atrás (y=-1,2), donde el fuselaje ya se estrecha a 0,95 m de medio
# ancho, y asomaban como dos bolas enormes; en el video los lados
# de la cabina son casi lisos.
for side in (-1, 1):
    add_sphere("Motor_%s" % ("Izq" if side < 0 else "Der"),
               (side * 0.85, -0.6, 0.50), (0.35, 0.80, 0.45), VERDE, 12, 8)
    add_cylinder("Escape_%s" % ("Izq" if side < 0 else "Der"),
                 (side * 0.85, -1.35, 0.50), 0.28, 0.12, OSCURO,
                 rot=(math.radians(90), 0, 0), vertices=12)

# Cañones del morro y sensor oscuro bajo el morro.
for side in (-1, 1):
    add_cylinder("Canon_%s" % ("Izq" if side < 0 else "Der"),
                 (side * 0.85, 3.3, -0.8), 0.10, 0.65, OSCURO,
                 rot=(math.radians(90), 0, 0), vertices=12)
add_sphere("SensorMorro", (0, 2.4, -1.35), (0.22, 0.32, 0.32), CRISTAL,
           segments=10, rings=6)

# ---------------------------------------------------------------------------
# Cola: botalón, estabilizador, deriva y rotor de cola
# ---------------------------------------------------------------------------
# Botalón cónico largo y fino desde la cabina hasta la deriva: 5,7 m,
# tan largo como la cabina, como en el video 1 ~12 s (antes 3,6 m).
add_cylinder("BotalonCola", (0, -4.75, 0.30), 0.26, 5.7, VERDE,
             rot=(math.radians(90), 0, 0), vertices=12, radius2=0.12)
add_sphere("UnionCola", (0, -1.95, 0.30), (0.30, 0.45, 0.30), VERDE,
           segments=10, rings=6)
# Estabilizador horizontal con puntas amarillas: en el video 1 ~12 s
# se ve verde en el centro y amarillo en los extremos.
add_box("Estabilizador", (0, -7.3, 0.35), (1.0, 0.40, 0.12), VERDE)
for side in (-1, 1):
    add_box("EstabPunta_%s" % ("Izq" if side < 0 else "Der"),
            (side * 0.675, -7.3, 0.35), (0.35, 0.40, 0.12), AMARILLO)
# Deriva vertical del mismo verde que el fuselaje (en el video la
# cola es toda verde). Sin baliza roja ni luces rojas: en los videos
# no hay nada rojo en el helicóptero.
add_box("Deriva", (0, -7.5, 0.9), (0.15, 0.35, 0.7), VERDE)
# Rotor de cola: buje y 2 palas amarillas en el lado izquierdo de la
# deriva.
add_cylinder("BujeRotorCola", (-0.18, -7.5, 1.0), 0.12, 0.15, OSCURO,
             rot=(0, math.radians(90), 0), vertices=12)
for i, ang in enumerate((math.radians(20), math.radians(110))):
    add_box("PalaRotorCola_%d" % i, (-0.28, -7.5, 1.0),
            (0.05, 0.18, 0.65), AMARILLO, rot=(ang, 0, 0))

# ---------------------------------------------------------------------------
# Rotor principal: mástil, buje y 2 palas (bajo el vacío "Rotor")
# ---------------------------------------------------------------------------
# Mástil sobre la cabina (y=-1,2), más bajo que en la rev. 2: el
# buje flotaba muy alto sobre el techo. Base del mismo verde que el
# fuselaje para que desde arriba el centro del rotor no destaque.
add_sphere("BaseRotor", (0, -1.2, 1.0), (0.55, 0.55, 0.25), VERDE,
           segments=16, rings=8)
add_cylinder("MastilRotor", (0, -1.2, 1.45), 0.13, 1.0, OSCURO, vertices=12)
add_sphere("BujeRotor", (0, -1.2, 2.1), (0.48, 0.48, 0.18), VERDE_CLARO,
           segments=16, rings=8)

bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, -1.2, 2.1))
rotor = bpy.context.active_object
rotor.name = "Rotor"
# Palas en diagonal (45°): en la vista lateral una pala apuntando a
# la cámara se veía como una paleta flotante sobre el helicóptero;
# en diagonal se lee como el rotor en reposo y en la cenital queda
# como en el video (el disco girando se ve en ángulo). El juego gira
# el rotor igualmente, así que la orientación en reposo es libre.
rotor.rotation_euler = (0, 0, math.radians(45))

for side, tag in ((-1, "Izq"), (1, "Der")):
    # Pala: de x=0,4 a x=7,4 (envergadura total 14,8 m, ~1,3 veces la
    # longitud total del helicóptero, como en el video; antes 17 m),
    # cuerda 0,50 (antes 0,32: el disco girando se ve ancho) con
    # banda amarilla en la punta (15 % de la pala).
    blade = add_box("RotorBlade_" + tag, (side * 3.9, -1.2, 2.1),
                    (7.0, 0.50, 0.07), VERDE)
    blade.parent = rotor
    tip = add_box("RotorPunta_" + tag, (side * 6.9, -1.2, 2.18),
                  (1.2, 0.51, 0.025), AMARILLO)
    tip.parent = rotor
    cap = add_sphere("RotorCap_%s" % tag, (side * 7.3, -1.2, 2.1),
                     (0.48, 0.39, 0.16), VERDE_CLARO, segments=10, rings=6)
    cap.parent = rotor

# ---------------------------------------------------------------------------
# Alas cortas, lanzacohetes y patines
# ---------------------------------------------------------------------------
for side in (-1, 1):
    tag = "Izq" if side < 0 else "Der"
    # Ala corta con ligera inclinación. Sin insignia ni luz en la
    # punta: en los videos las alas son verdes lisas.
    add_box("Ala_" + tag, (side * 2.85, -0.5, 0.1), (1.85, 0.72, 0.14),
            VERDE, rot=(0, 0, side * -0.12))
    # Lanzacohetes: 2 filas x 3 cohetes bajo cada ala, con la punta
    # verde (antes marfil: en los videos no hay nada blanco en el
    # helicóptero). Más finos que en la rev. 3 (radio 0,19): en la
    # vista lateral se veían como un bloque enorme bajo el ala.
    for row, z in enumerate((-0.45, -1.0)):
        for col, x in enumerate((2.1, 2.75, 3.4)):
            add_cylinder("Cohete_%s_%d_%d" % (tag, row, col),
                         (side * x, -0.38, z), 0.19, 0.90, VERDE,
                         rot=(math.radians(90), 0, 0), vertices=10)
            add_cylinder("PuntaCohete_%s_%d_%d" % (tag, row, col),
                         (side * x, 0.20, z), 0.19, 0.28, VERDE,
                         rot=(math.radians(-90), 0, 0), vertices=8,
                         radius2=0.02)
    # Patín: tubo a lo largo del fuselaje + 2 soportes hasta la panza.
    # Metido bajo la panza (x ±0,95) y más bajo, para que desde
    # arriba no se vea y de lado se lea fino y oscuro bajo la panza
    # (video 2 ~57 s). Más corto que en la rev. 3: sus extremos
    # asomaban por los lados del morro en la cenital.
    add_cylinder("Patin_" + tag, (side * 0.95, 0.5, -1.55), 0.09, 3.4,
                 OSCURO, rot=(math.radians(90), 0, 0), vertices=12)
    for y in (-0.5, 1.8):
        add_cylinder("SoportePatin_%s_%s" % (tag, y),
                     (side * 0.95, y, -1.35), 0.06, 0.45, OSCURO,
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
# Standard y no AgX: con AgX el verde y el amarillo salen apagados
# (misma trampa que en el tanque, docs/TANQUE-BLENDER.md).
scene.view_settings.view_transform = "Standard"
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

CENTER = (0, -2.0, 1.0)
# Cámaras alejadas para que el rotor entero (14,8 m, con las puntas
# amarillas) quepa en el encuadre con margen: con el objetivo de
# 50 mm las puntas quedaban cortadas en la cenital, la frontal y la
# lateral.
VIEWS = {
    "frontal": (0, 20, 3.0),
    "lateral": (22, -2.0, 3.0),
    "cenital": (0, -2.0, 32),
    "tres-cuartos": (15, -18, 10),
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
