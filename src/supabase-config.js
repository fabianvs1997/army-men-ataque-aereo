(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToySupabaseConfig = api;
})(globalThis, function () {
  'use strict';
  // Configuración de Supabase para cuentas, puntuaciones y registro
  // remoto de errores. Para activarla, Fabian crea un proyecto en
  // https://supabase.com, ejecuta supabase/schema.sql en el SQL Editor
  // y pega aquí la URL del proyecto y la clave ANON (Publishable key)
  // de Settings → API. Ver docs/SUPABASE.md.
  //
  // La clave ANON es pública por diseño: con Row Level Security activado
  // solo permite lo que permiten las políticas (cada usuario guarda lo
  // suyo; el ranking es de lectura pública). NUNCA pegues aquí la clave
  // secreta (service_role): esa clave salta todas las reglas y no debe
  // estar nunca en el juego ni en el repositorio.
  //
  // Con estos dos campos vacíos el juego funciona 100 % sin servidor:
  // se juega como invitado y las puntuaciones y los errores se guardan
  // solo en este dispositivo, como hasta ahora.
  const url = '';
  const anonKey = '';
  function isConfigured() {
    return (
      typeof url === 'string' &&
      url.indexOf('https://') === 0 &&
      url.indexOf('.supabase.co') > 0 &&
      typeof anonKey === 'string' &&
      anonKey.length > 20
    );
  }
  return { url, anonKey, isConfigured };
});
