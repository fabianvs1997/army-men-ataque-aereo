extends StaticBody3D
## Blanco destructible Tan (enemigo). 3 impactos lo destruyen.
## Avisa con la señal `destroyed` para que la arena cuente sin tener
## que buscarlo por la escena. Al destruirse no deja restos: solo una
## explosión breve, como pide el proyecto (nada que se acumule).

signal destroyed(target: StaticBody3D)

@export var max_health: int = 3

var health: int = 3
var _dead: bool = false

@onready var _visual: Node3D = $Visual


func _ready() -> void:
	health = max_health


func take_damage(amount: int) -> void:
	if _dead:
		return
	health -= amount
	if health <= 0:
		_die()
	else:
		# Golpe visible: sacudida de escala, sin cambiar el material.
		var tween: Tween = create_tween()
		_visual.scale = Vector3.ONE * 1.12
		tween.tween_property(_visual, "scale", Vector3.ONE, 0.15)


func _die() -> void:
	_dead = true
	destroyed.emit(self)
	# Sin restos: se apaga la colisión y el modelo, y aparece una
	# bola de fuego que crece y desaparece.
	set_deferred("collision_layer", 0)
	set_deferred("collision_mask", 0)
	_visual.visible = false
	var blast := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.6
	sphere.height = 1.2
	blast.mesh = sphere
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(1.0, 0.55, 0.1)
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	blast.material_override = material
	blast.position = Vector3(0.0, 1.8, 0.0)
	add_child(blast)
	var tween: Tween = create_tween()
	tween.tween_property(blast, "scale", Vector3.ONE * 4.0, 0.35)
	tween.tween_callback(queue_free)
