extends CharacterBody3D
## Helicóptero arcade reutilizable (Fase 1).
##
## No sabe nada de la arena, de los blancos ni de la misión: solo vuela,
## apunta con el mouse y dispara. Las fases 2+ (rescate A-B-C y Battle
## Royale) reutilizan este mismo nodo con otra escena padre.
##
## Convenio Godot: el morro apunta a -Z. El movimiento es relativo a la
## cámara, y como la cámara de la arena nunca gira, W es siempre -Z
## (arriba de la pantalla) y D es siempre +X (derecha), apunte donde apunte
## el morro.

## Parámetros de ajuste (también editables en el inspector).
@export var flight_height: float = 3.0
@export var move_speed: float = 14.0
@export var acceleration: float = 40.0
@export var turn_speed: float = 6.0 # rad/s, velocidad máxima de giro del morro
@export var fire_interval: float = 0.12 # s entre disparos
@export var tilt_amount: float = 0.012 # inclinación visual por m/s
@export var arena_half_x: float = 28.0
@export var arena_half_z: float = 20.0
@export var bullet_scene: PackedScene

## Punto del plano de vuelo bajo el cursor. La arena lo usa para la mira.
var aim_point: Vector3 = Vector3(0.0, 3.0, -10.0)
var aim_direction: Vector3 = Vector3(0.0, 0.0, -1.0)

var _fire_cooldown: float = 0.0

@onready var _visual: Node3D = $Visual
@onready var _rotor: Node3D = $Visual/Rotor
@onready var _muzzle: Marker3D = $Visual/Muzzle


func _ready() -> void:
	# Altura estable: el vuelo es a una cota fija, sin gravedad.
	global_position.y = flight_height
	aim_point = global_position + Vector3(0.0, 0.0, -10.0)


func _physics_process(delta: float) -> void:
	_update_aim()
	_update_movement(delta)
	_update_facing(delta)
	_update_visual(delta)
	_update_firing(delta)


func _update_movement(delta: float) -> void:
	# Input.get_vector: x = derecha - izquierda, y = atrás - adelante.
	# Con la cámara fija, eso es directamente mundo: W -> -Z, D -> +X.
	var input: Vector2 = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var move_dir: Vector3 = Vector3(input.x, 0.0, input.y)
	var target_velocity: Vector3 = move_dir * move_speed
	velocity.x = move_toward(velocity.x, target_velocity.x, acceleration * delta)
	velocity.z = move_toward(velocity.z, target_velocity.z, acceleration * delta)
	velocity.y = 0.0
	move_and_slide()
	# Límites de la arena y cota de vuelo fija (el choque con obstáculos
	# lo resuelve move_and_slide contra sus StaticBody3D).
	global_position.x = clampf(global_position.x, -arena_half_x, arena_half_x)
	global_position.z = clampf(global_position.z, -arena_half_z, arena_half_z)
	global_position.y = flight_height


func _update_aim() -> void:
	var camera: Camera3D = get_viewport().get_camera_3d()
	if camera == null:
		return
	var mouse: Vector2 = get_viewport().get_mouse_position()
	var origin: Vector3 = camera.project_ray_origin(mouse)
	var direction: Vector3 = camera.project_ray_normal(mouse)
	# Proyección del cursor sobre el plano de vuelo (y = flight_height).
	var plane := Plane(Vector3.UP, flight_height)
	var hit: Variant = plane.intersects_ray(origin, direction)
	if hit == null:
		return
	aim_point = hit
	var to_aim: Vector3 = aim_point - global_position
	to_aim.y = 0.0
	if to_aim.length() > 0.5:
		aim_direction = to_aim.normalized()


func _update_facing(delta: float) -> void:
	# Morro (-Z) hacia aim_direction, con velocidad de giro limitada.
	# Así el disparo sale en la dirección actual del morro, no
	# instantáneamente hacia el cursor.
	var desired_yaw: float = atan2(-aim_direction.x, -aim_direction.z)
	var diff: float = wrapf(desired_yaw - rotation.y, -PI, PI)
	var step: float = turn_speed * delta
	rotation.y += clampf(diff, -step, step)


func _update_visual(delta: float) -> void:
	# Inclinación leve según la velocidad local (adelante / de lado).
	var forward: Vector3 = -global_transform.basis.z
	var right: Vector3 = global_transform.basis.x
	var forward_speed: float = velocity.dot(forward)
	var right_speed: float = velocity.dot(right)
	_visual.rotation.x = clampf(-forward_speed * tilt_amount, -0.18, 0.18)
	_visual.rotation.z = clampf(-right_speed * tilt_amount, -0.18, 0.18)
	# Flotación visual (solo el modelo, la posición de vuelo no cambia).
	_visual.position.y = sin(Time.get_ticks_msec() / 1000.0 * 2.0) * 0.08
	_rotor.rotation.y += 25.0 * delta


func _update_firing(delta: float) -> void:
	_fire_cooldown -= delta
	if Input.is_action_pressed("shoot") and _fire_cooldown <= 0.0:
		_fire_cooldown = fire_interval
		_shoot()


func _shoot() -> void:
	if bullet_scene == null:
		return
	var bullet: Node3D = bullet_scene.instantiate()
	# La bala vive en la arena (mismo espacio que blancos y obstáculos).
	get_parent().add_child(bullet)
	bullet.setup(_muzzle.global_position, -global_transform.basis.z)
