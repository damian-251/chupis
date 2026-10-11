import test from "node:test";
import assert from "node:assert/strict";
import { pagina } from "../src/plantilla.mjs";

test("el menú anida subsecciones y abre la ruta activa en todos sus niveles", () => {
  const html = pagina({
    titulo: "Página hija",
    descripcion: "",
    raiz: "../",
    actual: "detalle",
    cuerpo: "",
    secciones: [
      { slug: "grupo", titulo: "Grupo", menu: true },
      { slug: "subgrupo", titulo: "Subgrupo", padre: "grupo", menu: true },
      { slug: "detalle", titulo: "Detalle <seguro>", padre: "subgrupo", menu: true },
    ],
  });

  assert.match(html, /<details class="submenu" open>/);
  assert.match(html, /<summary>Grupo<\/summary>/);
  assert.match(html, /<summary>Subgrupo<\/summary>/);
  assert.match(html, />Ver Grupo<\/a>/);
  assert.match(html, /href="\.\.\/detalle\/" aria-current="page">Detalle &lt;seguro&gt;/);
  assert.equal((html.match(/<details class="submenu" open>/g) ?? []).length, 2);
});

test("las secciones con subsecciones muestran solo el título principal hasta desplegarlo", () => {
  const opciones = {
    titulo: "Portada",
    descripcion: "",
    raiz: "../",
    cuerpo: "",
    secciones: [
      { slug: "grupo", titulo: "Grupo", menu: true },
      { slug: "hija", titulo: "Hija", padre: "grupo", menu: true },
    ],
  };
  const html = pagina({ ...opciones, actual: "" });

  assert.match(html, /<details class="submenu">\s*<summary>Grupo<\/summary>\s*<ul>[\s\S]*href="\.\.\/hija\/"/);
  assert.doesNotMatch(html, /<details class="submenu" open>/);
  const paginaPrincipal = pagina({ ...opciones, actual: "grupo" });
  assert.match(paginaPrincipal, /<details class="submenu">\s*<summary>Grupo<\/summary>/);
  assert.doesNotMatch(paginaPrincipal, /<details class="submenu" open>/);
});

test("las secciones ocultas no aparecen y sus descendientes visibles se promocionan", () => {
  const html = pagina({
    titulo: "Portada",
    descripcion: "",
    raiz: "",
    actual: "",
    cuerpo: "",
    secciones: [
      { slug: "oculta", titulo: "Oculta", menu: false },
      { slug: "visible", titulo: "Visible", padre: "oculta", menu: true },
    ],
  });

  assert.doesNotMatch(html, />Oculta</);
  assert.match(html, /href="visible\/">Visible</);
});
