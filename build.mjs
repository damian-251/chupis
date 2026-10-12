// Generador del sitio. Necesita Node 20 o superior y dos paquetes pequeños (marked y yaml): npm install
// Uso: node build.mjs   (crea la carpeta dist/ lista para subir a Neocities)
import { mkdir, rm, cp, writeFile, readFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";
import { applySectionOrder } from "./editor/github.js";
import { pagina, portada, noEncontrada, redireccion, escapar } from "./src/plantilla.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(aqui, "dist");
const secciones = JSON.parse(await readFile(path.join(aqui, "src/secciones.json"), "utf8"));

// ---- Secciones nuevas, creadas con el editor visual (src/nuevas/*.md, Markdown con cabecera YAML) ----
const RESERVADOS = new Set(["admin", "images", "index", "not_found", "favicon", "estilos"]);
const nuevas = [];
for (const archivo of (await readdir(path.join(aqui, "src/nuevas"))).filter((f) => f.endsWith(".md")).sort()) {
  const texto = (await readFile(path.join(aqui, "src/nuevas", archivo), "utf8")).replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const partes = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const datos = partes ? parseYaml(partes[1]) ?? {} : {};
  const markdown = partes ? partes[2] : texto;

  let slug = archivo.replace(/\.md$/, "");
  const usados = new Set([...secciones.map((s) => s.slug), ...nuevas.map((s) => s.slug), ...RESERVADOS]);
  if (usados.has(slug)) {
    console.warn(`Aviso: "${archivo}" repite una dirección que ya existe; se publica como "${slug}-nueva".`);
    slug = `${slug}-nueva`;
  }
  const titulo = String(datos.titulo ?? slug);
  const fondo = /^#[0-9a-f]{6}$/i.test(String(datos.fondo ?? "")) ? String(datos.fondo).toLowerCase() : null;
  const html = marked
    .parse(markdown, { async: false })
    .replaceAll("<img ", '<img loading="lazy" decoding="async" ');
  nuevas.push({
    slug,
    titulo,
    original: null,
    fondo: fondo === "#000000" ? null : fondo,
    menu: datos.menu !== false,
    descripcion: String(datos.descripcion || "").trim() || titulo,
    padre: typeof datos.padre === "string" ? datos.padre.trim() : "",
    fecha: new Date(datos.fecha ?? 0).getTime() || 0,
    html: `      <h2 class="titulo">${escapar(titulo)}</h2>\n${html}`,
  });
}
nuevas.sort((a, b) => a.fecha - b.fecha);
let orden = [];
try {
  orden = JSON.parse(await readFile(path.join(aqui, "src/orden-secciones.json"), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!Array.isArray(orden) || orden.some((slug) => typeof slug !== "string")) {
  throw new Error("src/orden-secciones.json debe contener una lista de direcciones de sección.");
}
const seccionesOrdenadas = applySectionOrder([...secciones, ...nuevas], orden);
secciones.splice(0, secciones.length, ...seccionesOrdenadas);

const seccionesPorSlug = new Map(secciones.map((seccion) => [seccion.slug, seccion]));
for (const seccion of secciones) {
  if (!seccion.padre) continue;
  if (!seccionesPorSlug.has(seccion.padre)) {
    throw new Error(`La sección "${seccion.slug}" apunta a una sección superior inexistente: "${seccion.padre}".`);
  }
  const visitados = new Set([seccion.slug]);
  let padre = seccion.padre;
  while (padre) {
    if (visitados.has(padre)) throw new Error(`La jerarquía de secciones contiene un ciclo desde "${seccion.slug}".`);
    visitados.add(padre);
    padre = seccionesPorSlug.get(padre)?.padre || "";
  }
}

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
  const fragmento = s.html ?? (await readFile(path.join(aqui, "src/paginas", `${s.slug}.html`), "utf8"));
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
const antiguas = secciones.filter((s) => s.original).map((s) => [s.original, `${s.slug}/`]);
antiguas.push(["principal.html", "./"], ["menu.html", "./"], ["foro.html", "./"]);
for (const [origen, destino] of antiguas) await escribir(origen, redireccion(destino));

// Informe: imágenes que las páginas piden y no están en public/images.
const existentes = new Set((await readdir(path.join(aqui, "public/images"), { recursive: true })).map((f) => f.replaceAll("\\", "/")));
const faltan = [];
for (const s of secciones) {
  const fragmento = s.html ?? (await readFile(path.join(aqui, "src/paginas", `${s.slug}.html`), "utf8"));
  for (const [, src] of fragmento.matchAll(/src="\/?images\/([^"]+)"/g)) {
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

console.log(`Sitio generado en dist/: portada + ${secciones.length} secciones (${nuevas.length} nuevas) + ${antiguas.length} redirecciones`);
console.log(`Imágenes que faltan: ${faltan.length} (ver IMAGENES-FALTANTES.txt)`);
