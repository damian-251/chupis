# Chupis

Versión actualizada del sitio, sin marcos (`<iframe>`) y con una sola plantilla.

## Cómo está organizado

| Carpeta o archivo | Para qué sirve |
|---|---|
| `src/paginas/*.html` | El contenido de cada sección. Es lo único que hay que editar para cambiar textos o imágenes. |
| `src/secciones.json` | Lista de las secciones antiguas: nombre en el menú, dirección, color de fondo y orden. |
| `src/nuevas/*.md` | Secciones creadas con el editor visual. Las genera el editor, no se tocan a mano. |
| `editor/` | El editor visual. Se publica en GitHub Pages, no en Neocities. La configuración está en `config.js`. |
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

El sitio incluye un editor visual (Sveltia CMS) en la carpeta `editor/`. Cada sección que se guarda ahí se publica sola:
el editor guarda un archivo en `src/nuevas/`, la Action de GitHub regenera el sitio y lo sube a Neocities.

El editor no puede vivir en Neocities, porque Neocities impide que sus páginas se conecten a GitHub.
Por eso se publica aparte en GitHub Pages, con la Action `editor-pages.yml`. Su dirección será
`https://TU_USUARIO.github.io/TU_REPOSITORIO/`.

Para activarlo:

1. Abre `editor/config.js` y cambia `TU_USUARIO/TU_REPOSITORIO` por el de tu repositorio.
2. En GitHub, abre **Settings, Pages** y en **Source** elige **GitHub Actions**.
3. Haz commit y push. Cuando termine la Action «Publicar el editor (GitHub Pages)», entra en la dirección del editor.
4. Para añadir a otras personas, ve a **Settings, Collaborators**. Cada una crea su token siguiendo `GUIA-EDITORES.md`.

Ten en cuenta:

- GitHub Pages es gratis para repositorios públicos. Si tu repositorio es privado, necesitas un plan de pago de GitHub. El repositorio público no expone tus claves: la de Neocities está en los secretos.
- Quien tiene permiso de escritura en el repositorio puede modificar la Action y, con ella, usar la clave `NEOCITIES_API_TOKEN`. Da acceso solo a personas de confianza.
- Con `cleanup: false` en `neocities.yml`, si alguien borra una sección en el editor, la página sigue en Neocities hasta que la borres tú desde el panel. Si cambias `cleanup` a `true`, Neocities quedará idéntico a `dist/` y se borrarán los archivos que no estén ahí.
- El editor carga su código desde `unpkg.com`, fijado a una versión concreta (`editor/index.html`). Para actualizarlo, cambia el número de versión.
- Sveltia solo trae el español de Colombia. `editor/es-ES.json` es una copia adaptada al español de España (por ejemplo «Añadir» e «Introduce»), y `editor/index.html` la carga en su lugar. Si cambias la versión de Sveltia, conviene comprobar que sigue funcionando.
- Los textos de las secciones nuevas se guardan en Markdown y se convierten a HTML al generar el sitio.
