# Chupis

Versión actualizada del sitio, sin marcos (`<iframe>`) y con una sola plantilla.

## Cómo está organizado

| Carpeta o archivo | Para qué sirve |
|---|---|
| `src/paginas/*.html` | El contenido HTML de las 45 secciones antiguas. Se puede editar desde el editor visual. |
| `src/secciones.json` | Nombre del menú, dirección, color de fondo, descripción y orden de las secciones antiguas. |
| `src/nuevas/*.md` | Secciones creadas desde el editor visual, con cabecera YAML y contenido HTML/Markdown. |
| `editor/` | Editor visual propio, publicado en GitHub Pages. Usa TinyMCE y la API de GitHub para leer y guardar contenido. |
| `tests/editor-github.test.mjs` | Pruebas automatizadas de la integración de GitHub simulada. |
| `GUIA-EDITORES.md` | Instrucciones para las personas que editan el sitio. |
| `src/plantilla.mjs` | Cabecera, menú y portada. Se escriben una sola vez para todo el sitio. |
| `public/` | Estilos, favicon y la carpeta `images/`. Las imágenes nuevas se suben a `public/images/subidas/`. |
| `build.mjs` | Genera el sitio completo en `dist/`. |
| `dist/` | El sitio terminado, listo para publicar en Neocities. |
| `IMAGENES-FALTANTES.txt` | Informe de imágenes que las páginas piden y no están en `public/images/`. |

## Uso local

Necesitas Node 20 o superior.

```sh
npm install         # solo la primera vez
npm run build       # regenera dist/
npm test            # pruebas del editor y de la API simulada
npm start           # regenera y abre el sitio en local
```

## Publicar en Neocities

El workflow `.github/workflows/neocities.yml` genera `dist/` y lo sube a Neocities al recibir un commit en `main`. Las direcciones antiguas, como `/noticias.html`, siguen funcionando y llevan a la dirección nueva `/noticias/`.

## Editor visual

El editor vive en `editor/` y se publica en GitHub Pages mediante `.github/workflows/editor-pages.yml`. No puede vivir en Neocities porque Neocities impide que sus páginas se conecten a GitHub.

Para activarlo, abre **Settings → Pages** y elige **GitHub Actions** como origen; después de publicar el workflow, la dirección será `https://TU_USUARIO.github.io/TU_REPOSITORIO/`. El editor viene preconfigurado con `damian-251/chupis`, rama `main`, y permite cambiar esos tres campos al conectarse.

Cada persona entra con su token personal de GitHub. Para guardar necesita permiso de lectura y escritura en `Contents` para este repositorio. El token se mantiene en memoria mientras está abierta la pestaña; no se escribe en archivos ni en `localStorage`.

El editor permite modificar todas las 45 secciones antiguas, incluidas sus descripciones, visibilidad en el menú y color de fondo. El contenido de una sección antigua y su entrada en `src/secciones.json` se actualizan con un solo commit. También permite crear y editar secciones nuevas y subir imágenes de hasta 5 MB a `public/images/subidas/`.

TinyMCE y Marked se cargan desde jsDelivr, así que el editor necesita conexión a Internet. Quien tenga permiso de escritura en el repositorio también puede cambiar los workflows; comparte ese acceso solo con personas de confianza. La guía detallada está en `GUIA-EDITORES.md`.


## Sobre el uso de Inteligencia Artificial

Este proyecto es una versión restaurada y modernizada de **Chupis**, una antigua página de **MSN Groups** (cerrado en 2009).

- **Contenido original y nuevo:** todo el contenido ha sido recopilado y redactado manualmente.
- **Estructura, plantilla y código:** la plantilla, el sistema de generación del sitio y gran parte del código de este repositorio fueron desarrollados con asistencia de Inteligencia Artificial.

La IA se ha utilizado como herramienta de desarrollo, no como fuente de contenido. Todas las decisiones, la selección del material y la redacción final son de elaboración humana.
