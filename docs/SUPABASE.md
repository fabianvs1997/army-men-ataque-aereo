# Supabase: cuentas, puntuaciones y registro de errores

El juego funciona 100 % sin servidor. Supabase es opcional y añade tres
cosas: cuentas con correo y contraseña, puntuaciones en línea (ranking) y
envío del registro de errores. Sin configuración, se juega como invitado
y todo se guarda solo en este dispositivo, como hasta ahora.

## 1. Crear el proyecto (solo Fabian, 10 minutos)

1. Entra en <https://supabase.com> y crea un proyecto (región cercana,
   por ejemplo US East; plan gratuito).
2. En el proyecto, ve a **SQL Editor → New query**, pega el contenido de
   `supabase/schema.sql` y pulsa **Run**. Crea las tablas `profiles`,
   `scores` y `error_logs`, con Row Level Security y sus políticas.
3. Ve a **Authentication → Sign In / Providers → Email** y comprueba que
   el proveedor de correo está activado. Para probar sin confirmar el
   correo, desactiva **Confirm email** (Authentication → Settings);
   para producción, déjalo activado y cada cuenta confirma su correo.
4. Ve a **Settings → API** y copia dos valores:
   - **Project URL** (por ejemplo `https://xyz.supabase.co`)
   - **Publishable key** (la clave ANON; en el panel nuevo se llama
     "Publishable key", antes "anon public").
5. Pega esos dos valores en `src/supabase-config.js` (`url` y
   `anonKey`), haz commit y publica. Eso es todo en el código.

## 2. Claves: cuál sí y cuál nunca

- **Publishable / ANON: sí.** Es pública por diseño: solo identifica el
  proyecto. Lo que protege los datos son las políticas RLS del esquema:
  cada usuario inserta solo sus puntuaciones y sus errores, y el ranking
  es de lectura pública porque las filas no contienen datos personales.
- **Secret / service_role: nunca.** Esa clave salta todas las reglas de
  seguridad. No va en el juego, ni en el repositorio, ni en ningún
  archivo del proyecto. Si alguna vez se filtra, se regenera en
  Settings → API.

## 3. Cómo funciona en el juego

- **Menú → Cuenta:** correo, nombre visible y contraseña. Crear cuenta,
  iniciar sesión y cerrar sesión. Sin sesión se juega como invitado.
- **Puntuaciones:** al completar una misión, si hay sesión y conexión,
  la puntuación (puntos de campaña, estrellas y supervivientes) se guarda
  en la tabla `scores`. Como invitado o sin red, queda en cola local
  (máximo 20) y se envía al iniciar sesión. En Cuenta se ven las tuyas
  y el top 5 del ranking.
- **Registro de errores:** `src/logger.js` captura `console.error`,
  errores no controlados, rechazos de promesas y frames de más de 500 ms,
  con versión, misión, fase, semilla, FPS y dispositivo. Se guarda en
  localStorage (últimas 100 entradas, rotación) y se puede ver en
  **Menú → Registro**, exportar como `army-men-logs.json` o ver el
  contador con `?logs=1` en la dirección. Con sesión, los errores se
  envían en lotes a `error_logs` al completar una misión o al iniciar
  sesión; sin servidor, quedan solo en el dispositivo.
- **Sin conexión o sin CDN:** la librería de Supabase se carga desde el
  CDN de jsDelivr solo si hay configuración; si no carga (sin red,
  `file://` sin conexión), el juego sigue como invitado y no se rompe
  nada. Las puntuaciones en cola se reintentan solas.

## 4. Probarlo en local

1. Con la configuración vacía: abre `index.html`, juega una misión y
   comprueba en **Cuenta** que dice "Supabase sin configurar" y en
   **Registro** que los errores aparecen y se exportan.
2. Con la configuración puesta: crea una cuenta desde el menú, completa
   una misión y comprueba en **Table Editor → scores** que aparece la
   fila, y en **Table Editor → error_logs** que llegan los errores tras
   completar una misión.
3. Pruebas automáticas: `node --test` (sin red; Supabase se simula con
   un cliente falso en `tests/supabase.test.cjs`).

## 5. Desactivar Supabase

Deja `url` y `anonKey` vacíos en `src/supabase-config.js`. El juego
vuelve a modo invitado sin tocar nada más. Para quitarlo del todo,
basta con no cargar los módulos en `src/bootstrap.js`.

## 6. Coste y límites

El plan gratuito de Supabase cubre de sobra un juego pequeño: Auth,
base de datos y 500 MB. Si el ranking crece mucho, el índice
`scores(mission, score desc)` mantiene rápida la consulta del top.
