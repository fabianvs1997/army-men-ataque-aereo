extends SceneTree

func _initialize() -> void:
	call_deferred("check")

func check() -> void:
	var arena = load("res://scenes/rescate.tscn").instantiate()
	root.add_child(arena)
	var heli = arena.get_node("Helicopter")
	heli.position = arena.B + Vector3.UP * 3
	arena._physics_process(2.0)
	if arena.stage != arena.Stage.CLEAR or arena.wounded.size() != 3:
		quit(1)
		return
	for unit in arena.defenders.duplicate():
		unit.take_damage(100)
	for unit in arena.hostiles.duplicate():
		unit.take_damage(100)
	arena._physics_process(2.0)
	if arena.stage != arena.Stage.ESCORT or not arena.wounded.is_empty():
		quit(2)
		return
	heli.position = arena.C + Vector3.UP * 3
	arena._physics_process(2.0)
	if arena.stage != arena.Stage.ESCORT:
		quit(3)
		return
	for step in 300:
		heli.position = arena.squad[0].position + Vector3.UP * 3
		arena._physics_process(0.1)
	if arena.stage != arena.Stage.WON:
		quit(4)
		return
	print("Rescate: despeje, recogida, escolta, entrega y victoria verificados.")
	quit()
