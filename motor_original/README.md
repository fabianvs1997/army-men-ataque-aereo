# Motor que lee el disco AMVP de Windows

Este hito carga ALPINE1.PAK desde la carpeta Pak instalada, en modo de solo lectura. No requiere ISO en ejecución. Ejecutar con Godot 4.4.1, o abrir MotorAlpino.exe junto a MotorAlpino.pck. Si el selector aparece, elegir Pak/ALPINE1.PAK. También se admite la ruta después de --. Clic derecho para avanzar hacia el cursor o WASD y Q/E para inspeccionar el terreno.

La altura se lee como 129 × 129 enteros de 16 bits de TERRAIN.HI. SHARED.MBL aporta posiciones, registros de caras de la primera malla estática y su primera textura indexada. Las reglas de ensamblaje, UV, orientación, escala, cámara y altura de vuelo son provisionales. El color del terreno viene de RADARMAP.TIM hasta reconstruir los mosaicos de la superficie original. El inicio del vuelo es un punto de inspección, no un spawn reconstruido.

No se ha migrado la campaña. Faltan capas de terreno de detalle, colocación de objetos (POB), animaciones y rotores, enemigos e IA, colisiones, gancho, eventos, sonido, interfaz y progreso. El exportado solo contiene código y configuración; todos los datos leídos proceden del PAK del usuario. Comparar el escenario con el juego original antes de considerar fiel una misión.
