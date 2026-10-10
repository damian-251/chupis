# Chupis

Versión actualizada del sitio, sin marcos (`<iframe>`) y con una sola plantilla.

## Cómo está organizado

| Carpeta o archivo | Para qué sirve |
|---|---|
| `src/paginas/*.html` | El contenido de cada sección. Es lo único que hay que editar para cambiar textos o imágenes. |
| `src/secciones.json` | Lista de secciones: nombre en el menú, dirección, color de fondo y orden. |
| `src/plantilla.mjs` | Cabecera, menú y portada. Se escriben una sola vez para todo el sitio. |
| `public/` | Estilos, favicon y la carpeta `images/`. Se copia tal cual. |
| `build.mjs` | Genera el sitio completo en `dist/`. |
| `dist/` | El sitio terminado. Esto es lo que se sube a Neocities. |
| `IMAGENES-FALTANTES.txt` | Imágenes que las páginas piden y no están en `images/`. |

## Uso

Necesitas Node 20 o superior.

```
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
