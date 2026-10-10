// Generador del sitio. Sin dependencias: solo necesita Node 20 o superior.
// Uso: node build.mjs   (crea la carpeta dist/ lista para subir a Neocities)
import { mkdir, rm, cp, writeFile, readFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pagina, portada, noEncontrada, redireccion } from "./src/plantilla.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(aqui, "dist");
const secciones = JSON.parse(await readFile(path.join(aqui, "src/secciones.json"), "utf8"));

// Los fragmentos usan rutas "desde la raíz" (images/x.jpg, otra-seccion/).
// Aquí se ajustan según la profundidad de cada página.
const rebasar = (html, raiz) =>
  html.replace(/\b(src|href)="(?![a-zA-Z][a-zA-Z0-9+.-]*:|\/|#)([^"]*)"/g, (_, atributo, url) => `${atributo}="${raiz}${url}"`);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(aqui, "public"), dist, { recursive: true });

const escribir = async (ruta, contenido) => {
  await mkdir(path.dirname(path.join(dist, ruta)), { recursive: true });
  await writeFile(path.join(dist, ruta), contenido);
};

const base = { secciones };

// Portada
await escribir(
  "index.html",
  pagina({
    ...base,
    titulo: "The Website of Chupis",
    descripcion: "Chupis: secciones, fotos, juegos, chistes y recuerdos de una web de grupo de los años 2000.",
    raiz: "",
    actual: "",
    cuerpo: portada(),
    clase: "portada",
    ocultarTitulo: false,
  }),
);

// Una página por sección, con URL limpia: dist/noticias/index.html -> /noticias/
for (const s of secciones) {
  const fragmento = await readFile(path.join(aqui, "src/paginas", `${s.slug}.html`), "utf8");
  await escribir(
    `${s.slug}/index.html`,
    pagina({
      ...base,
      titulo: s.titulo,
      descripcion: s.descripcion,
      raiz: "../",
      actual: s.slug,
      cuerpo: rebasar(fragmento, "../"),
      fondo: s.fondo,
    }),
  );
}

// Página 404 (Neocities usa not_found.html). Rutas absolutas porque puede servirse desde cualquier dirección.
await escribir(
  "not_found.html",
  pagina({
    ...base,
    titulo: "Página no encontrada",
    descripcion: "La página que buscas no existe.",
    raiz: "/",
    actual: null,
    cuerpo: noEncontrada(),
    clase: "portada",
    ocultarTitulo: false,
  }),
);

// Las direcciones antiguas (/noticias.html, /diverFashion.html...) siguen funcionando y llevan a la nueva.
const antiguas = secciones.map((s) => [s.original, `${s.slug}/`]);
antiguas.push(["principal.html", "./"], ["menu.html", "./"], ["foro.html", "./"]);
for (const [origen, destino] of antiguas) await escribir(origen, redireccion(destino));

// Informe: imágenes que las páginas piden y no están en public/images.
const existentes = new Set(await readdir(path.join(aqui, "public/images")));
const faltan = [];
for (const s of secciones) {
  const fragmento = await readFile(path.join(aqui, "src/paginas", `${s.slug}.html`), "utf8");
  for (const [, src] of fragmento.matchAll(/src="images\/([^"]+)"/g)) {
    let nombre = src;
    try { nombre = decodeURIComponent(src); } catch {}
    if (!existentes.has(nombre)) faltan.push(`${s.slug}: ${nombre}`);
  }
}
await writeFile(
  path.join(aqui, "IMAGENES-FALTANTES.txt"),
  faltan.length
    ? `Imágenes que las páginas piden y no están en public/images (${faltan.length}):\n\n${faltan.join("\n")}\n`
    : "No falta ninguna imagen.\n",
);

console.log(`Sitio generado en dist/: portada + ${secciones.length} secciones + ${antiguas.length} redirecciones`);
console.log(`Imágenes que faltan: ${faltan.length} (ver IMAGENES-FALTANTES.txt)`);
