extends Node3D
## Arena de la Fase 1: base de salida, claro, dos obstáculos y tres
## blancos. Coordina solo lo propio de esta escena: la cámara que sigue
## al jugador, la mira, el contador de blancos y el reinicio con R.
## El helicóptero (scripts/helicopter.gd) no depende de nada de aquí.

@onready var _helicopter: CharacterBody3D = $Helicopter
@onready var _camera_rig: Node3D = $CameraRig
@onready var _reticle: Node3D = $Reticle
@onready var _targets_label: Label = $HUD/TargetsLabel
@onready var _message_label: Label = $HUD/MessageLabel

var targets_total: int = 0
var targets_remaining: int = 0
var _completed: bool = false


func _ready() -> void:
	var targets: Array[Node] = get_tree().get_nodes_in_group("targets")
	targets_total = targets.size()
	targets_remaining = targets_total
	for target: Node in targets:
		if target.has_signal("destroyed"):
			target.destroyed.connect(_on_target_destroyed)
	_update_hud()
	_message_label.visible = false
	# La cámara arranca ya sobre el jugador.
	_camera_rig.global_position = Vector3(_helicopter.global_position.x, 0.0, _helicopter.global_position.z)


func _process(delta: float) -> void:
	# La cámara sigue al jugador en XZ con orientación fija: nunca gira,
	# así WASD no cambia de sentido aunque el morro apunte a otro lado.
	var wanted := Vector3(_helicopter.global_position.x, 0.0, _helicopter.global_position.z)
	_camera_rig.global_position = _camera_rig.global_position.lerp(wanted, minf(1.0, delta * 6.0))
	# Mira sobre el plano de vuelo, en el punto bajo el cursor.
	_reticle.global_position = _helicopter.aim_point
	_reticle.visible = true


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_F3:
		var modes := ["res://scenes/suministros.tscn", "res://scenes/rescate.tscn", "res://scenes/main.tscn"]
		get_tree().change_scene_to_file(modes[(modes.find(scene_file_path) + 1) % modes.size()])
		return
	if event.is_action_pressed("restart"):
		get_tree().reload_current_scene()


func _on_target_destroyed(_target: StaticBody3D) -> void:
	targets_remaining = maxi(0, targets_remaining - 1)
	_update_hud()
	if targets_remaining <= 0 and not _completed:
		_completed = true
		_message_label.text = "¡Arena despejada! Pulsa R para reiniciar"
		_message_label.visible = true


func _update_hud() -> void:
	_targets_label.text = "Blancos: %d / %d" % [targets_total - targets_remaining, targets_total]

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

