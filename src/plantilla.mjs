// Plantilla única del sitio: cabecera, menú lateral y estructura se definen aquí una sola vez.

export const escapar = (texto) =>
  String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const WEBARCHIVE = "https://web.archive.org/web/20080228050516/http://groups.msn.com/chupis/bienvenidos.msnw";

const WEBARCHIVE_INGLES = "https://web.archive.org/web/20080228051210/http://groups.msn.com/chupisenglish";

// ---- Contraste: el color del texto y de los enlaces se elige según el fondo de cada sección ----
const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function coloresDe(fondo) {
  if (!fondo) return "";
  const tinta = contraste(fondo, "#ffffff") >= contraste(fondo, "#000000") ? "#ffffff" : "#000000";
  const enlace = ["#0000ee", "#9aa6ff", "#ffffff", "#000000"].find((c) => contraste(fondo, c) >= 4.5) ?? tinta;
  return ` style="--fondo:${fondo};--tinta:${tinta};--enlace:${enlace}"`;
}

/**
 * @param {object} p
 * @param {string} p.titulo        Título de la página
 * @param {string} p.descripcion   Meta description
 * @param {string} p.raiz          Prefijo hacia la raíz ("", "../" o "/")
 * @param {string|null} p.actual   slug activo ("" = portada, null = ninguno)
 * @param {string} p.cuerpo        HTML del contenido principal
 * @param {Array}  p.secciones     Secciones del menú
 * @param {string|null} p.fondo    Color de fondo propio de la sección
 * @param {string} p.clase         Clase extra para <main>
 * @param {boolean} p.ocultarTitulo  Añade un <h1> solo para lectores de pantalla
 */
export function pagina({ titulo, descripcion, raiz, actual, cuerpo, secciones, fondo = null, clase = "", ocultarTitulo = true }) {
  const item = (href, texto, activa) =>
    `        <li><a href="${href}"${activa ? ' aria-current="page"' : ""}>${escapar(texto)}</a></li>`;
  const enlaces = [
    item(raiz, "Principal", actual === ""),
    ...secciones.filter((s) => s.menu).map((s) => item(`${raiz}${s.slug}/`, s.titulo, s.slug === actual)),
  ].join("\n");

  const nombre = actual ? `${titulo} · Chupis` : titulo;
  const h1 = ocultarTitulo ? `      <h1 class="solo-lectores">${escapar(titulo)}</h1>\n` : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapar(nombre)}</title>
  <meta name="description" content="${escapar(descripcion)}">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#52395f">
  <link rel="icon" href="${raiz}favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${raiz}estilos.css">
</head>
<body>
  <a class="saltar" href="#contenido">Saltar al contenido</a>

  <header class="cabecera">
    <div class="banda"></div>
    <div class="marca">
      <a class="logo" href="${raiz}">
        <svg class="gente" viewBox="0 0 40 32" aria-hidden="true"><circle cx="14" cy="9" r="6" fill="#e8c26a"/><path d="M3 30c0-8 5-12 11-12s11 4 11 12z" fill="#e8c26a"/><circle cx="28" cy="11" r="5" fill="#9bb7e8"/><path d="M19 30c0-7 4-11 9-11s9 4 9 11z" fill="#9bb7e8"/></svg>
        <span>Groups</span>
      </a>
      <nav class="superior" aria-label="Enlaces del sitio">
        <a href="${raiz}">Groups Home</a>
        <a href="${WEBARCHIVE}">My Groups</a>
        <a href="${WEBARCHIVE_INGLES}">Language</a>
        <a href="${raiz}bienrecibidos/">Help</a>
      </nav>
    </div>
    <div class="barra-grupo">
      <strong>Chupis</strong>
      <span>chupis@groups.msn.com</span>
    </div>
  </header>

  <div class="estructura">
    <nav class="menu" aria-label="Secciones">
      <div class="novedades">
        <svg class="estrella" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7-6-3.4-6 3.400 1.300-6.700-5-4.700 6.800-.8z" fill="none" stroke="#d4c64a" stroke-width="1.5" stroke-linejoin="round"/></svg>
        <a href="${raiz}noticias/">What's New</a>
        <a href="${raiz}bienrecibidos/">Join Now</a>
      </div>
      <details open>
        <summary>Secciones</summary>
        <ul>
${enlaces}
        </ul>
      </details>
    </nav>

    <main id="contenido" class="${clase}"${coloresDe(fondo)}>
${h1}${cuerpo}
    </main>
  </div>

  <script>
    // Mejoras opcionales: sin JavaScript el menú sigue funcionando.
    (() => {
      const menu = document.querySelector(".menu");
      const detalles = menu.querySelector("details");
      const movil = matchMedia("(max-width: 40rem)");
      const ajustar = () => { detalles.open = !movil.matches; };
      ajustar();
      movil.addEventListener("change", ajustar);

      // Conserva la posición del menú al pasar de una página a otra y muestra la sección activa.
      try {
        const guardada = sessionStorage.getItem("menu-scroll");
        if (guardada !== null) menu.scrollTop = Number(guardada);
        addEventListener("pagehide", () => sessionStorage.setItem("menu-scroll", menu.scrollTop));
      } catch {}
      menu.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
    })();
  </script>
</body>
</html>
`;
}

export const portada = () => `
  <h1 class="logo-gif" aria-label="CHUPIS">
    <img src="images/c.gif" alt="" width="70" height="100">
    <img src="images/h.gif" alt="" width="72" height="100">
    <img src="images/u.gif" alt="" width="72" height="100">
    <img src="images/p.gif" alt="" width="66" height="100">
    <img src="images/i.gif" alt="" width="38" height="100">
    <img src="images/s.gif" alt="" width="58" height="100">
  </h1>
  <div class="libro">
    <iframe src="https://guestbooks.meadow.cafe/guestbook/6290" title="Libro de visitas" loading="lazy"></iframe>
  </div>
  <footer class="ai-disclaimer">
    <p>Este sitio es una versión restaurada del archivo original de Chupis. La estructura y el diseño modernos fueron generados con asistencia de Inteligencia Artificial (Claude). El contenido original fue extraído manualmente.</p>
  </footer>
`;

export const noEncontrada = () => `      <h2>Página no encontrada</h2>
      <p>La página que buscas no existe o se ha movido.</p>
      <p><a class="boton" href="/">Volver a la página principal</a></p>`;

export const redireccion = (destino) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Esta página se ha movido</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${destino}">
  <meta http-equiv="refresh" content="0; url=${destino}">
</head>
<body>
  <p>Esta página se ha movido a <a href="${destino}">${destino}</a>.</p>
</body>
</html>
`;
