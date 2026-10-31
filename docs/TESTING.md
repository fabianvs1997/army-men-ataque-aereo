# Pruebas

## Automatizadas

Desde la raíz, con Node 22:

```sh
node --test
```

No requieren instalar dependencias. Combate, preferencias, entrada, audio,
transiciones, mundo, misiones y renderer tienen pruebas directas; ocho integraciones
usan `support/fake-host.cjs`. Game.create acepta `{random}` para reproducir resultados.

## Navegador real

El smoke de desarrollo requiere Playwright y Chromium disponibles en el entorno
(no son dependencias del juego). Con Playwright resoluble por Node:

```sh
BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-browser.cjs
SMOKE_ENTRY=army-men-ataque-aereo.html BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-browser.cjs
```

Abre file://, inicia, dispara, pausa, navega ayuda/ajustes, silencia, continúa,
gira el viewport y vuelve al menú; exige cero errores JavaScript. No sustituye
una partida manual completa ni las restricciones reales de Safari/iOS.

## Cinco pasos manuales por entrega

1. Jugar una misión: destruir bases, rescatar aliados y extraerlos; pasar a la siguiente.
2. Pausar y continuar: el mundo se detiene y el audio no queda sonando en pausa.
3. Girar vertical/horizontal: controles visibles, sin entrada retenida ni saltos de estado.
4. Silenciar/reactivar y probar primer toque y regreso desde segundo plano.
5. Perder y reintentar: misión correcta, HUD reiniciado y preferencias conservadas.

## Pendientes en iPhone físico

- [Audio y segundo plano #13](https://github.com/fabianvs1997/army-men-ataque-aereo/issues/13)
- [Multitáctil y orientación #14](https://github.com/fabianvs1997/army-men-ataque-aereo/issues/14)
- [Campaña, WebGL y Canvas #15](https://github.com/fabianvs1997/army-men-ataque-aereo/issues/15)

Registrar modelo, iOS y resultados antes de cerrar cada Issue.

## Estado de CI y etiqueta

Durante el refactor, Actions no inició jobs por bloqueo de facturación de la cuenta.
Las pruebas locales sí se ejecutaron. `v-pre-refactor` apunta localmente a
`1c59125bb925e7727cd265c64f1d2f5a2cb62a05`; su publicación remota sigue pendiente.
Tras desbloquear Actions, volver a ejecutar el workflow Preserve pre-refactor baseline
y el de pruebas. El workflow se niega a mover una etiqueta existente a otro commit.

## Rotura de plástico

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-debris.cjs` comprueba
un impacto barrido, cinco tipos de enemigo, ausencia de bolas de fuego, reposo
sobre el terreno y ambos renderers en file://. Captura imágenes en /tmp.
Las pruebas Node cubren daño repetido, piezas separadas una sola vez, misiles,
persistencia, límite de restos, pausa y limpieza de misión. Validación física de
rendimiento en iPhone pendiente; el límite es 320 piezas, no una garantía de FPS.

## Cobertura y objetos sólidos

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-cover.cjs` usa la regadera
real del mapa: detrás no se recibe daño; al salir se recibe el disparo. Comprueba
movimiento detenido, paso por encima y renderizado WebGL/Canvas en ambas orientaciones.
Pruebas directas: cajas giradas, elipsoides, proyectiles rápidos, primer contacto,
misiles y cobertura frente a daño de área, deslizamiento, altura, restos, vegetación
oculta, terreno y prevención de atravesar un objeto desde su superficie.
