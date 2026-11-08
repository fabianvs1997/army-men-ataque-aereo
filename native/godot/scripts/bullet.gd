extends Node3D
## Proyectil del cañón. Viaja en línea recta y comprueba cada paso con un
## raycast contra su propio segmento, así no atraviesa obstáculos ni
## blancos aunque vaya rápido. La primera colisión decide: obstáculo lo
## detiene, blanco recibe daño.

@export var speed: float = 55.0
@export var max_range: float = 70.0

# Capas de colisión (ver project / escenas):
# 1 = mundo/suelo, 2 = obstáculo, 4 = blanco. El suelo no se incluye:
# la bala vuela a 3 m y su segmento es horizontal.
const HIT_MASK: int = 2 | 4

var direction: Vector3 = Vector3(0.0, 0.0, -1.0)
var _traveled: float = 0.0


func setup(p_origin: Vector3, p_direction: Vector3) -> void:
	global_position = p_origin
	direction = p_direction.normalized()
	# Orienta el modelo (alargado en Z) en la dirección de vuelo.
	if direction.length_squared() > 0.001:
		look_at(global_position + direction, Vector3.UP)


func _physics_process(delta: float) -> void:
	var step: float = speed * delta
	var next_position: Vector3 = global_position + direction * step
	var query := PhysicsRayQueryParameters3D.create(global_position, next_position)
	query.collision_mask = HIT_MASK
	var space_state: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var hit: Dictionary = space_state.intersect_ray(query)
	if not hit.is_empty():
		var collider: Object = hit.get("collider")
		if collider != null and collider.has_method("take_damage"):
			collider.take_damage(1)
		# Con obstáculo o con blanco, la bala se consume en el impacto.
		queue_free()
		return
	global_position = next_position
	_traveled += step
	if _traveled >= max_range:
		queue_free()
