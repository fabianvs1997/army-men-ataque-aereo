# Supabase: cuentas, puntuaciones y registro de errores

El juego funciona 100 % sin servidor. Supabase es opcional y añade tres
cosas: cuentas con correo y contraseña, puntuaciones en línea (ranking) y
envío del registro de errores. Sin configuración, se juega como invitado
y todo se guarda solo en este dispositivo, como hasta ahora.

## 0. Nada hardcodeado: cómo llega la configuración

Un navegador no puede leer `process.env`: el juego es estático y no
tiene build. Por eso la URL y la clave ANON **no están en ningún
archivo del repositorio** y tampoco se pegan en `src/supabase-config.js`.
El flujo es:

```
Secretos de GitHub (SUPABASE_URL, SUPABASE_ANON_KEY)
  → variables de entorno en GitHub Actions
  → scripts/generate-supabase-config.cjs
  → src/supabase-env.js (generado, gitignorado, solo en el artefacto)
  → window.__SUPABASE_CONFIG__ en el navegador
  → src/supabase-config.js lo lee; sin él, modo invitado
```

En local es el mismo script con un `.env` (también gitignorado).
`src/supabase-config.js` solo resuelve lo inyectado: si no hay nada,
devuelve vacío y el juego va como invitado. El generador rechaza la
clave secreta (`service_role`) y cualquier URL que no sea
`https://<proyecto>.supabase.co`.

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
4. Ve a **Settings → API** y copia dos valores (no los pegues en ningún
   archivo, van a los secretos del paso 2):
   - **Project URL** (por ejemplo `https://xyz.supabase.co`)
   - **Publishable key** (la clave ANON; en el panel nuevo se llama
     "Publishable key", antes "anon public").

## 2. Crear los secretos en GitHub (solo Fabian)

En el repositorio, **Settings → Secrets and variables → Actions →
New repository secret**, crea exactamente estos dos:

| Nombre del secreto | Valor |
| --- | --- |
| `SUPABASE_URL` | La Project URL de Settings → API |
| `SUPABASE_ANON_KEY` | La Publishable key de Settings → API |

Nunca pongas la clave secreta (`service_role`) como secreto ni en
ningún otro sitio: el generador la rechaza y el juego no la usa.
Los secretos no se pueden ver después de crearlos, solo
sobrescribirlos; si te equivocas en un valor, crea el secreto de
nuevo con el mismo nombre.

## 3. Cambiar el despliegue a GitHub Actions (solo Fabian, una vez)

Hoy GitHub Pages publica directo desde la rama, y en ese modo no hay
dónde inyectar variables de entorno. Para que el flujo funcione:

1. **Añade el archivo del workflow desde la web** (una vez): la
   integración de GitHub que usa este asistente no puede crear archivos
   de `.github/workflows/` por API, así que el archivo no viene en el
   PR. En GitHub, abre la rama del PR, **Add file → Create new file**,
   ponle la ruta `.github/workflows/deploy-pages.yml` y pega este
   contenido (es el mismo archivo del repo local):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [Master]
  workflow_dispatch: {}
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Run tests
        run: node --test
      - name: Generate Supabase config from secrets
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: node scripts/generate-supabase-config.cjs
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

2. En el repositorio, **Settings → Pages → Build and deployment →
   Source** y cambia de "Deploy from a branch" a **GitHub Actions**.
3. Haz push a `Master` (o pulsa **Run workflow** en Actions →
   Deploy to GitHub Pages). El workflow corre los tests, genera
   `src/supabase-env.js` desde los secretos y publica el sitio.
4. Comprueba en **Actions** que el workflow terminó en verde.

Hasta que se haga este cambio, Pages sigue sirviendo la rama sin
configuración (modo invitado) y el juego no se rompe: el archivo
generado simplemente no existe y el cargador lo tolera.

## 4. Claves: cuál sí y cuál nunca

- **Publishable / ANON: sí.** Es pública por diseño: solo identifica el
  proyecto. Lo que protege los datos son las políticas RLS del esquema:
  cada usuario inserta solo sus puntuaciones y sus errores, y el ranking
  es de lectura pública porque las filas no contienen datos personales.
- **Secret / service_role: nunca.** Esa clave salta todas las reglas de
  seguridad. No va en el juego, ni en el repositorio, ni en los
  secretos de GitHub, ni en ningún archivo del proyecto. Si alguna vez
  se filtra, se regenera en Settings → API.

## 5. Cómo funciona en el juego

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

## 6. Probarlo en local

1. Sin configuración: abre `index.html`, juega una misión y comprueba
   en **Cuenta** que dice "Supabase sin configurar" y en **Registro**
   que los errores aparecen y se exportan.
2. Con configuración local (sin tocar el repo):
   `cp .env.example .env`, rellena los dos valores y ejecuta
   `node scripts/generate-supabase-config.cjs`. Abre `index.html`:
   crea una cuenta desde el menú, completa una misión y comprueba en
   **Table Editor → scores** que aparece la fila, y en
   **Table Editor → error_logs** que llegan los errores tras completar
   una misión. El archivo generado (`src/supabase-env.js`) y `.env`
   están gitignorados: `git status` debe seguir limpio.
3. Pruebas automáticas: `node --test` (sin red; Supabase se simula con
   un cliente falso en `tests/supabase.test.cjs`, la configuración
   inyectada en `tests/supabase-config.test.cjs` y el generador en
   `tests/generate-supabase-config.test.cjs`).

## 7. Desactivar Supabase

Borra los dos secretos en GitHub (o deja el workflow sin ellos) y
vuelve a desplegar: el generador escribe una configuración vacía y el
juego vuelve a modo invitado sin tocar nada más. En local, borra
`src/supabase-env.js` y `.env`. Para quitarlo del todo, basta con no
cargar los módulos en `src/bootstrap.js`.

## 8. Coste y límites

El plan gratuito de Supabase cubre de sobra un juego pequeño: Auth,
base de datos y 500 MB. Si el ranking crece mucho, el índice
`scores(mission, score desc)` mantiene rápida la consulta del top.

## 9. Si algo no conecta

- El juego sigue en invitado tras desplegar: revisa en **Actions**
  que el workflow de despliegue terminó en verde, que los secretos se
  llaman exactamente `SUPABASE_URL` y `SUPABASE_ANON_KEY`, y que
  Pages está en **Source: GitHub Actions** (paso 3). Un despliegue
  desde la rama no tiene configuración, por diseño.
- La cuenta no se crea: revisa el proveedor de Email y si
  **Confirm email** está activado (paso 1.3).
- El workflow falla en "Generate Supabase config": el generador
  rechaza URLs que no sean `https://<proyecto>.supabase.co` o claves
  que parezcan la secreta; corrige el secreto y vuelve a desplegar.
