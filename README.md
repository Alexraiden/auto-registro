# Auto registro

Aplicación estática para completar un auto registro, guardar los datos en el navegador, sincronizarlos opcionalmente entre dispositivos y generar un PDF desde la impresión del navegador.

## Archivos

- `index.html`: aplicación para GitHub Pages.
- `worker.js`: Cloudflare Worker para guardar y cargar blobs cifrados.
- `wrangler.toml`: configuración del Worker y KV.

## Despliegue

1. Crear un repositorio público en GitHub y subir `index.html`.
2. Activar GitHub Pages desde la rama principal.
3. Crear una cuenta Cloudflare y un namespace Workers KV.
4. En `wrangler.toml`, reemplazar `REPLACE_WITH_KV_NAMESPACE_ID` por el ID del namespace.
5. Cambiar `ALLOWED_ORIGIN` por el origen exacto de GitHub Pages.
6. Desplegar el Worker con `npx wrangler deploy`.
7. En `index.html`, reemplazar `https://CHANGE-ME.workers.dev` por la URL real del Worker.

## Seguridad

El enlace privado contiene el secreto de descifrado en el fragmento `#sync=...`. Ese fragmento no se envía al Worker en las peticiones HTTP. El Worker guarda únicamente `encryptedPayload`, `accessHash`, `version` y `updatedAt`.

Si el enlace privado se pierde, los datos cifrados guardados en línea no se pueden recuperar.
