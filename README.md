# Chupis

Versión actualizada del sitio, sin marcos (`<iframe>`) y con una sola plantilla.

## Cómo está organizado

| Carpeta o archivo | Para qué sirve |
|---|---|
| `src/paginas/*.html` | El contenido de cada sección. Es lo único que hay que editar para cambiar textos o imágenes. |
| `src/secciones.json` | Lista de las secciones antiguas: nombre en el menú, dirección, color de fondo y orden. |
| `src/nuevas/*.md` | Secciones creadas con el editor visual. Las genera el editor, no se tocan a mano. |
| `public/admin/` | El editor visual (`/admin/` en el sitio). La configuración está en `config.js`. |
| `GUIA-EDITORES.md` | Guía para las personas que escriben secciones nuevas. |
| `src/plantilla.mjs` | Cabecera, menú y portada. Se escriben una sola vez para todo el sitio. |
| `public/` | Estilos, favicon y la carpeta `images/`. Se copia tal cual. |
| `build.mjs` | Genera el sitio completo en `dist/`. |
| `dist/` | El sitio terminado. Esto es lo que se sube a Neocities. |
| `IMAGENES-FALTANTES.txt` | Imágenes que las páginas piden y no están en `images/`. |

## Uso

Necesitas Node 20 o superior.

```
npm install         # solo la primera vez
node build.mjs      # regenera dist/
npm start           # regenera y abre el sitio en local
```

## Publicar en Neocities

Sube el contenido de la carpeta `dist/` (no la carpeta en sí). Las direcciones antiguas,
como `/noticias.html`, siguen funcionando y llevan a la nueva, `/noticias/`.

## Añadir una sección

1. Crea `src/paginas/mi-seccion.html` con el contenido.
2. Añade una entrada en `src/secciones.json`:
   `{ "slug": "mi-seccion", "titulo": "Mi sección", "original": "mi-seccion.html", "fondo": "#330033", "menu": true, "descripcion": "Texto corto para buscadores." }`
3. Ejecuta `node build.mjs`.

En los fragmentos, las rutas se escriben desde la raíz (`images/foto.jpg`, `noticias/`); el generador las ajusta solo.

## Clases disponibles en el contenido

`centro`, `derecha`, `t1` a `t7` (tamaños de letra, antes `<font size>`), `izq`, `medio`, `centrada` (imágenes).

## Editor visual para otras personas

El sitio incluye un editor visual en `/admin/` (Sveltia CMS). Cada sección que se guarda ahí se publica sola:
el editor guarda un archivo en `src/nuevas/`, la Action de GitHub regenera el sitio y lo sube a Neocities.

Para activarlo:

1. Abre `public/admin/config.js` y cambia `TU_USUARIO/TU_REPOSITORIO` por el de tu repositorio.
2. En GitHub, añade a las personas en **Settings, Collaborators**.
3. Cada una crea su token siguiendo `GUIA-EDITORES.md` y entra en `https://TU-SITIO.neocities.org/admin/`.

Ten en cuenta:

- Quien tiene permiso de escritura en el repositorio puede modificar la Action y, con ella, usar la clave `NEOCITIES_API_TOKEN`. Da acceso solo a personas de confianza.
- Con `cleanup: false` en `neocities.yml`, si alguien borra una sección en el editor, la página sigue en Neocities hasta que la borres tú desde el panel. Si cambias `cleanup` a `true`, Neocities quedará idéntico a `dist/` y se borrarán los archivos que no estén ahí.
- El editor carga su código desde `unpkg.com`, fijado a una versión concreta (`public/admin/index.html`). Para actualizarlo, cambia el número de versión.
- Los textos de las secciones nuevas se guardan en Markdown y se convierten a HTML al generar el sitio.
