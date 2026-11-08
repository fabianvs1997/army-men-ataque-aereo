extends "res://scripts/arena.gd"

const TARGET = preload("res://scenes/target.tscn")
const A := Vector3.ZERO
const B := Vector3(-45, 0, -50)
const C := Vector3(77.5, 0, -62.5)
const GREEN := Color("#376f39")
enum Stage {CLEAR, PICKUP, ESCORT, WON, LOST}
var stage := Stage.CLEAR
var defenders: Array[Node3D] = []
var hostiles: Array[Node3D] = []
var wounded: Array[Node3D] = []
var squad: Array[Node3D] = []
var lift_time := 0.0
var delivery_time := 0.0
var hull := 12
var fire_time := 1.5

func _ready() -> void:
	_camera_rig.global_position = A
	_message_label.hide()
	for point in [[A, "A · BASE"], [B, "B · RESCATE"], [C, "C · EXTRACCIÓN"]]:
		var pad := box(self, point[0], Vector3(12, 0.18, 12), Color("#595a46"))
		var sign := Label3D.new()
		sign.text = point[1]
		sign.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		sign.pixel_size = 0.045
		pad.add_child(sign)
		sign.position.y = 5
	trail(A, B)
	trail(B, C)
	for i in range(4):
		soldier(A + Vector3(-5 + i * 3, 0, 5), false)
		squad.append(soldier(B + Vector3(-3 + i * 2, 0, 2), false))
	for i in range(3):
		wounded.append(soldier(B + Vector3(-2 + i * 2, 0, -1), true))
	for pos in [Vector3(-22, 0, -25), B + Vector3(-8, 0, -5), B + Vector3(8, 0, -2), B + Vector3(2, 0, 8), Vector3(13, 0, -60), Vector3(49, 0, -59)]:
		var unit := TARGET.instantiate() as Node3D
		add_child(unit)
		unit.position = pos
		hostiles.append(unit)
		if pos.distance_to(B) < 15:
			defenders.append(unit)
		unit.destroyed.connect(enemy_down)
	update_orders()

func box(parent: Node3D, pos: Vector3, size: Vector3, color: Color) -> MeshInstance3D:
	var visual := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mesh.material = mat
	visual.mesh = mesh
	parent.add_child(visual)
	visual.position = pos
	return visual

func trail(start: Vector3, end: Vector3) -> void:
	var strip := box(self, (start+end)/2, Vector3(7, 0.08, start.distance_to(end)), Color("#a78b57"))
	strip.look_at(end, Vector3.UP)

func soldier(pos: Vector3, hurt: bool) -> Node3D:
	var toy := Node3D.new()
	add_child(toy)
	toy.position = pos
	toy.set_meta("hp", 18)
	box(toy, Vector3(0, 0.8, 0), Vector3(0.75, 1.5, 0.55), GREEN)
	box(toy, Vector3(0, 1.65, 0), Vector3(0.85, 0.45, 0.75), GREEN)
	if hurt:
		toy.rotation.z = PI/2
		toy.position.y = 0.35
		box(toy, Vector3(0, 1, -0.30), Vector3(0.65, 0.35, 0.08), Color.WHITE)
	return toy

func enemy_down(unit: Node3D) -> void:
	hostiles.erase(unit)
	defenders.erase(unit)
	if stage == Stage.CLEAR and defenders.is_empty():
		stage = Stage.PICKUP
	update_orders()

func _physics_process(delta: float) -> void:
	if stage >= Stage.WON:
		return
	var pos := Vector3(_helicopter.position.x, 0, _helicopter.position.z)
	fire_time -= delta
	if fire_time <= 0:
		fire_time = 1.6
		for unit in hostiles.duplicate():
			if unit.position.distance_to(pos) < 15:
				tracer(unit.position + Vector3.UP * 3, _helicopter.position, Color.ORANGE)
				hull -= 1
				if hull <= 0:
					stage = Stage.LOST
					finish("Helicóptero derribado")
					break
			elif stage == Stage.ESCORT:
				for toy in squad:
					if unit.position.distance_to(toy.position) < 13:
						tracer(unit.position + Vector3.UP * 3, toy.position + Vector3.UP, Color.ORANGE)
						var hp := int(toy.get_meta("hp")) - 3
						toy.set_meta("hp", hp)
						if hp <= 0:
							stage = Stage.LOST
							finish("Pelotón perdido")
						break
			if stage == Stage.LOST:
				break
		if stage == Stage.ESCORT:
			for unit in hostiles.duplicate():
				if squad[0].position.distance_to(unit.position) < 12:
					tracer(squad[0].position + Vector3.UP, unit.position + Vector3.UP * 3, Color.YELLOW)
					unit.take_damage(1)
					break
	if stage == Stage.PICKUP:
		lift_time = lift_time + delta if pos.distance_to(B) < 6 else 0.0
		if lift_time >= 1.5:
			for toy in wounded:
				toy.queue_free()
			wounded.clear()
			stage = Stage.ESCORT
	if stage == Stage.ESCORT:
		var arrived := 0
		for i in range(squad.size()):
			var toy := squad[i]
			var goal := C + Vector3(-3 + i * 2, 0, 0)
			if toy.position.distance_to(pos) < 20:
				toy.position = toy.position.move_toward(goal, 7 * delta)
			if toy.position.distance_to(goal) < 2:
				arrived += 1
		delivery_time = delivery_time + delta if arrived == squad.size() and pos.distance_to(C) < 9 else 0.0
		if delivery_time >= 2.0:
			stage = Stage.WON
			var progress := ConfigFile.new()
			var loaded := progress.load("user://rescate.cfg")
			var count := int(progress.get_value("rescates", "completados", 0)) if loaded == OK else 0
			progress.set_value("rescates", "completados", count + 1)
			var saved := progress.save("user://rescate.cfg")
			finish("3 heridos y 4 escoltados · Rescates: %d" % (count + 1) if saved == OK else "Rescate completo · No se pudo guardar")
	update_orders()

func finish(title: String) -> void:
	_message_label.text = title + "\nR para volver a volar"
	_message_label.show()
	_helicopter.set_physics_process(false)

func update_orders() -> void:
	var pos := _helicopter.position
	var orders := ""
	match stage:
		Stage.CLEAR: orders = "Sigue la vereda hasta B · Defensas: %d" % defenders.size()
		Stage.PICKUP: orders = "Sobrevuela B para recoger a los 3 heridos"
		Stage.ESCORT: orders = "Escolta al pelotón hasta C · Mantente cerca"
		Stage.WON: orders = "Pelotón a salvo"
		Stage.LOST: orders = "Misión fallida"
	var dest := C if stage == Stage.ESCORT else B
	_targets_label.text = "%s\nDistancia: %d m   ·   Blindaje: %d/12" % [orders, pos.distance_to(dest), hull]

func tracer(start: Vector3, end: Vector3, color: Color) -> void:
	var ray := box(self, (start + end) / 2, Vector3(0.09, 0.09, start.distance_to(end)), color)
	ray.look_at(end)
	get_tree().create_timer(0.09).timeout.connect(ray.queue_free)
