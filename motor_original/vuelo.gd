extends Node3D
const Reader = preload("res://lector.gd")
var ship := MeshInstance3D.new()
var camera := Camera3D.new()
var status := Label.new()
var heights := PackedByteArray()
var side := 0

func _ready() -> void:
	add_child(status)
	status.position = Vector2(12,12)
	status.add_theme_constant_override("outline_size",4)
	var root := OS.get_executable_path().get_base_dir()
	var paths := [root.path_join("Pak/ALPINE1.PAK"), root.path_join("ALPINE1.PAK"), "C:/Program Files (x86)/3DO/Air Attack/Pak/ALPINE1.PAK"]
	paths.append_array(OS.get_cmdline_user_args())
	for path in paths:
		if FileAccess.file_exists(path) and load_level(path):
			return
	status.text = "Selecciona ALPINE1.PAK en la carpeta Pak del juego."
	var picker := FileDialog.new()
	picker.access = FileDialog.ACCESS_FILESYSTEM
	picker.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	picker.filters = PackedStringArray(["*.PAK,*.pak ; Archivo del juego"])
	add_child(picker)
	picker.file_selected.connect(func(path): 
		if not load_level(path):
			status.text = "Archivo incompatible. Selecciona ALPINE1.PAK."
			picker.popup_centered_ratio(0.8))
	picker.popup_centered_ratio(0.8)

func load_level(path: String) -> bool:
	var pak := Reader.read_pak(path)
	for name in ["ALPINE1.SCD","TERRAIN.TER","TERRAIN.HI","SHARED.MBL","RADARMAP.TIM"]:
		if not pak.has(name): return false
	var ter: PackedByteArray = pak["TERRAIN.TER"]
	if ter.size()<8 or ter.decode_u16(0)!=64 or ter.decode_u16(2)!=64: return false
	var dimension := 2*ter.decode_u16(0)+1
	var hi: PackedByteArray = pak["TERRAIN.HI"]
	if hi.size()<dimension*dimension*2: return false
	var radar := Reader.radar(pak["RADARMAP.TIM"])
	var hull := Reader.fuselage(pak["SHARED.MBL"])
	var skin := Reader.hull_texture(pak["SHARED.MBL"])
	if not radar or not hull or not skin: return false
	heights=hi
	side=dimension
	var ground := MeshInstance3D.new()
	ground.mesh=Reader.ground(hi,side)
	ground.material_override=material(radar)
	add_child(ground)
	ship.mesh=hull
	ship.material_override=material(skin)
	add_child(ship)
	add_child(camera)
	camera.current=true
	camera.fov=48
	ship.position=Vector3(240,0,240)
	position_camera(1.0)
	status.text="Alpina 1 · Vuelo de inspección\nW/S avanzar y retroceder · A/D girar · Q/E lateral · Clic derecho: volar hacia el cursor"
	print("ALPINE1: ",side*side," alturas; caras originales: ",pak["SHARED.MBL"].decode_u32(88))
	return true

func material(image: Image) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
	m.cull_mode=BaseMaterial3D.CULL_DISABLED
	m.albedo_texture=ImageTexture.create_from_image(image)
	return m

func position_camera(delta:float) -> void:
	var p := Vector2(ship.position.x,ship.position.z)/4.0
	var x := clampi(floori(p.x),0,side-2)
	var z := clampi(floori(p.y),0,side-2)
	var values := PackedFloat32Array()
	for offset in [0,1,side,side+1]:
		values.append(-heights.decode_s16(2*(z*side+x+offset))/1024.0)
	ship.position.y=9+lerpf(lerpf(values[0],values[1],p.x-x),lerpf(values[2],values[3],p.x-x),p.y-z)
	camera.position=camera.position.lerp(ship.position+Vector3(0,22,28),minf(1,delta*8))
	camera.look_at(ship.position,Vector3.UP)

func _physics_process(dt:float) -> void:
	if side==0: return
	ship.rotation.y += (int(Input.is_physical_key_pressed(KEY_A))-int(Input.is_physical_key_pressed(KEY_D)))*dt*2.2
	var forward := int(Input.is_physical_key_pressed(KEY_W))-int(Input.is_physical_key_pressed(KEY_S))
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		var mouse := get_viewport().get_mouse_position()
		var hit = Plane(Vector3.UP,ship.position.y).intersects_ray(camera.project_ray_origin(mouse),camera.project_ray_normal(mouse))
		if hit != null:
			var aim: Vector3 = hit-ship.position
			if aim.length() > 1:
				ship.rotation.y = rotate_toward(ship.rotation.y,atan2(-aim.x,-aim.z),2.2*dt)
				forward = 1
	var lateral := int(Input.is_physical_key_pressed(KEY_E))-int(Input.is_physical_key_pressed(KEY_Q))
	ship.position += ship.basis*Vector3(lateral,0,-forward).limit_length(1)*24*dt
	ship.position.x=clampf(ship.position.x,1,(side-1)*4-1)
	ship.position.z=clampf(ship.position.z,1,(side-1)*4-1)
	position_camera(dt)
