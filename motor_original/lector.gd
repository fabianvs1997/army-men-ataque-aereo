extends RefCounted

# A data track PAK stores its sector-aligned payloads after the directory.
static func read_pak(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if not f or f.get_length() < 52 or f.get_length() > 64000000:
		return {}
	var count := f.get_32()
	if count < 1 or count > 2048 or 4 + count * 52 > f.get_length():
		return {}
	var names := PackedStringArray()
	var sizes := PackedInt32Array()
	var start := f.get_length()
	for i in count:
		f.seek(4 + i * 52)
		var name := f.get_buffer(16).get_string_from_ascii()
		var size := f.get_32()
		if size % 2048 or size > start or name in names:
			return {}
		start -= size
		names.append(name)
		sizes.append(size)
	if start < 4 + count * 52:
		return {}
	f.seek(start)
	var result := {}
	for i in count:
		result[names[i]] = f.get_buffer(sizes[i])
	return result

static func rgb555(n: int) -> Color:
	return Color(float(n & 31)/31, float((n>>5)&31)/31, float((n>>10)&31)/31)

static func radar(d: PackedByteArray) -> Image:
	if d.size()<532 or d.decode_u32(0)!=16 or d.decode_u32(4)!=9:
		return null
	var start := 8+d.decode_u32(8)
	if start+12>d.size() or start<532:
		return null
	var w := 2*d.decode_u16(start+8)
	var h := d.decode_u16(start+10)
	if w*h==0 or start+12+w*h>d.size():
		return null
	var image := Image.create_empty(w,h,false,Image.FORMAT_RGB8)
	for y in h:
		for x in w:
			image.set_pixel(x,y,rgb555(d.decode_u16(20+2*d[start+12+y*w+x])))
	return image

static func ground(hi: PackedByteArray, side: int) -> ArrayMesh:
	var v := PackedVector3Array()
	var uv := PackedVector2Array()
	var indices := PackedInt32Array()
	for z in side:
		for x in side:
			v.append(Vector3(x*4,-hi.decode_s16(2*(z*side+x))/1024.0,z*4))
			uv.append(Vector2(x,z)/(side-1.0))
			if x+1<side and z+1<side:
				var a := z*side+x
				indices.append_array([a,a+1,a+side,a+1,a+side+1,a+side])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX]=v
	arrays[Mesh.ARRAY_TEX_UV]=uv
	arrays[Mesh.ARRAY_INDEX]=indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	return mesh

# Static fuselage in the first shared 3MDL stream. Position commands write
# individual registers or pairs packed into the upper 12 bits of a word.
static func fuselage(d: PackedByteArray) -> ArrayMesh:
	if d.size()<76: return null
	var p := d.decode_u32(40)
	if p+24>d.size() or d.slice(p,p+4).get_string_from_ascii()!="3MDL": return null
	var count := d.decode_u32(p+8)
	var end := p+d.decode_u32(p+20)
	if count==0 or end>d.size() or p+24+count*8>=end: return null
	var points := PackedVector3Array()
	for i in count:
		var o := p+24+8*i
		points.append(Vector3(d.decode_s16(o),-d.decode_s16(o+2),-d.decode_s16(o+4))/512.0)
	var slot := [0,0,0,0]
	var vertices := PackedVector3Array()
	var uvs := PackedVector2Array()
	var tex := [Vector2.ZERO,Vector2.ZERO,Vector2.ZERO,Vector2.ZERO]
	var faces := 0
	for o in range(p+24+count*8,end,4):
		var op := int(d[o])
		var index := (op>>2)&3
		var cmd := op & 0xf0
		if cmd==0x30:
			slot[index]=int(d[o+1])
		elif cmd==0x40:
			slot[index]=int(d[o+1])
			if index<3: slot[index+1]=d.decode_u16(o+2)>>4
		elif cmd==0x20:
			tex[index]=Vector2(d[o+1],d[o+2])/64.0
		if op & 3:
			var corners := [0,1,2,2,1,3] if (op&3)==1 else [0,1,2]
			for j in corners:
				if slot[j]>=count: return null
				vertices.append(points[slot[j]])
				uvs.append(tex[j])
			faces+=1
	if faces!=d.decode_u32(p+12): return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in vertices.size():
		st.set_uv(uvs[i])
		st.add_vertex(vertices[i])
	st.generate_normals()
	return st.commit()

static func hull_texture(d: PackedByteArray) -> Image:
	if d.size()<76: return null
	var tex := d.decode_u32(48)
	var pal := d.decode_u32(52)
	if tex+4108>d.size() or pal+516>d.size(): return null
	if d.decode_u32(tex)!=64 or d.decode_u32(tex+4)!=64 or d.decode_u32(tex+8)!=1 or d.decode_u32(pal)!=256: return null
	var image := Image.create_empty(64,64,false,Image.FORMAT_RGB8)
	for y in 64:
		for x in 64: image.set_pixel(x,y,rgb555(d.decode_u16(pal+4+2*d[tex+12+y*64+x])))
	return image
