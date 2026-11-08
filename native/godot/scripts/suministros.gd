extends "res://scripts/arena.gd"

const BASE := Vector3(-22, 0, -32)
const PORTAL := Vector3(30, 0, -48)
var cargo: MeshInstance3D
var carrying := false
var complete := false

func _ready() -> void:
	trail(Vector3.ZERO, BASE)
	trail(BASE, PORTAL)
	box(self, BASE, Vector3(8, 0.2, 8), Color("#676654"))
	cargo = box(self, BASE + Vector3.UP, Vector3(2, 2, 2), Color("#b77a35"))
	box(cargo, Vector3.ZERO, Vector3(0.35, 2.1, 2.1), Color("#333d2a"))
	var glow := Color("#44debc")
	for x in [-4, 4]:
		box(self, PORTAL + Vector3(x, 3, 0), Vector3(0.7, 6, 1.0), glow)
	box(self, PORTAL + Vector3(0, 6, 0), Vector3(8.5, 0.7, 1), glow)
	$HUD/HelpLabel.text = "Clic derecho: volar   ·   E o clic central: gancho   ·   R: reiniciar   ·   F3: rescate A–B–C"
	_message_label.hide()
	update_order()

func _unhandled_input(event: InputEvent) -> void:
	super._unhandled_input(event)
	var hook_key: bool = event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_E
	var hook_mouse: bool = event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_MIDDLE
	if hook_key or hook_mouse:
		use_hook()

func use_hook() -> void:
	if complete:
		return
	var below := Vector3(_helicopter.position.x, 0, _helicopter.position.z)
	if carrying:
		carrying = false
		cargo.position = below + Vector3.UP
	elif below.distance_to(Vector3(cargo.position.x, 0, cargo.position.z)) < 5:
		carrying = true

func _physics_process(_delta: float) -> void:
	if complete:
		return
	if carrying:
		cargo.position = _helicopter.position - Vector3.UP * 1.8
		var pos := _helicopter.position
		if absf(pos.x - PORTAL.x) <= 3 and absf(pos.z - PORTAL.z) < 1:
			complete = true
			_message_label.text = "Suministros entregados\nF3 para iniciar el rescate"
			_message_label.show()
			_helicopter.set_physics_process(false)
	update_order()

func update_order() -> void:
	var dest := PORTAL if carrying else cargo.position
	var delta_pos := dest - _helicopter.position
	var direction := ("N" if delta_pos.z < -3 else "S" if delta_pos.z > 3 else "") + ("E" if delta_pos.x > 3 else "O" if delta_pos.x < -3 else "")
	var order := "Transporta la caja al portal" if carrying else "Recoge la caja en la base secreta"
	_targets_label.text = "MISIÓN 1 · SUMINISTROS\n%s   ·   %s   %d m" % [order, direction, Vector2(delta_pos.x,delta_pos.z).length()]
