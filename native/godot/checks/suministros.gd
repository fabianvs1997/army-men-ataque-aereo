extends SceneTree

func _initialize() -> void:
	call_deferred("check")

func check() -> void:
	var mission = load("res://scenes/suministros.tscn").instantiate()
	root.add_child(mission)
	var heli = mission.get_node("Helicopter")
	mission.use_hook()
	if mission.carrying:
		quit(1)
		return
	heli.position = mission.BASE + Vector3.UP * 3
	mission.use_hook()
	mission._physics_process(0.1)
	if not mission.carrying:
		quit(2)
		return
	mission.use_hook()
	heli.position = mission.PORTAL + Vector3.UP * 3
	mission._physics_process(0.1)
	if mission.complete:
		quit(3)
		return
	heli.position = mission.BASE + Vector3.UP * 3
	mission.use_hook()
	heli.position = mission.PORTAL + Vector3.UP * 3
	mission._physics_process(0.1)
	if not mission.complete:
		quit(4)
		return
	print("Gancho fuera de alcance, recogida, descarga y entrega comprobados.")
	quit()
