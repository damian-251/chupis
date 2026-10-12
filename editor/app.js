import { GitHubClient, slugFromTitle } from "./github.js";

const byId = (id) => document.getElementById(id);
const connectionPanel = byId("connection-panel");
const connectionForm = byId("connection-form");
const workspace = byId("workspace");
const globalStatus = byId("global-status");
const sectionList = byId("section-list");
const sectionForm = byId("section-form");
const editorTitle = byId("editor-title");
const editorSubtitle = byId("editor-subtitle");
const dirtyIndicator = byId("dirty-indicator");
const saveButton = byId("save-button");
const deleteButton = byId("delete-section-button");
const newSectionButton = byId("new-section-button");
const newSubsectionButton = byId("new-subsection-button");
const backgroundPicker = byId("section-background");
const backgroundHex = byId("section-background-hex");
const customBackground = byId("use-custom-background");

let client = null;
let allSections = [];
let activeSection = null;
let editor = null;
let isDirty = false;
let loadingEditor = false;
let suppressDirty = false;
let savingSectionOrder = false;

function showStatus(message, kind = "info") {
  globalStatus.textContent = message;
  globalStatus.className = `status${kind === "error" ? " error" : kind === "success" ? " success" : ""}`;
  globalStatus.hidden = false;
}

function clearStatus() {
  globalStatus.hidden = true;
  globalStatus.textContent = "";
}

function markDirty(value = true) {
  if (suppressDirty) return;
  isDirty = value;
  dirtyIndicator.hidden = !value;
  saveButton.textContent = value ? "Guardar cambios en GitHub" : "Guardar en GitHub";
}

function contrastInk(hex) {
  const raw = /^#[\da-f]{6}$/i.test(hex) ? hex.slice(1) : "000000";
  const channels = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

function updateBackgroundPreview() {
  const isCustom = customBackground.checked;
  backgroundPicker.disabled = !isCustom;
  backgroundHex.disabled = !isCustom;
  const hex = backgroundHex.value.trim();
  const validHex = /^#[\da-f]{6}$/i.test(hex);
  backgroundHex.setCustomValidity(isCustom && !validHex ? "Escribe un color hexadecimal válido, por ejemplo #663399." : "");
  const background = isCustom ? (validHex ? hex.toLowerCase() : null) : "#000000";
  byId("background-value").textContent = isCustom
    ? (validHex ? background.toUpperCase() : "Código hexadecimal no válido")
    : "Fondo predeterminado · negro";
  if (background && editor?.getBody()) {
    editor.getBody().style.backgroundColor = background;
    editor.getBody().style.color = contrastInk(background);
  }
}

function readFormValues() {
  const content = editor ? editor.getContent() : "";
  return {
    titulo: byId("section-title").value,
    descripcion: byId("section-description").value,
    usarFondo: customBackground.checked,
    fondo: backgroundHex.value.trim(),
    menu: byId("section-menu").checked,
    padre: byId("section-parent").value,
    html: content,
  };
}

function actualizarPadres(section) {
  const select = byId("section-parent");
  select.replaceChildren(new Option("Ninguna · sección principal", ""));
  const excluidas = new Set([section?.slug]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const candidate of allSections) {
      if (candidate.padre && excluidas.has(candidate.padre) && !excluidas.has(candidate.slug)) {
        excluidas.add(candidate.slug);
        cambio = true;
      }
    }
  }
  for (const candidate of allSections) {
    if (candidate.id === section?.id || (candidate.menu === false && candidate.slug !== section?.padre) || excluidas.has(candidate.slug)) continue;
    select.add(new Option(candidate.titulo, candidate.slug));
  }
  select.value = section?.padre ?? "";
}

function setFormValues(section) {
  loadingEditor = true;
  suppressDirty = true;
  actualizarPadres(section);
  byId("section-title").value = section?.titulo ?? "";
  byId("section-description").value = section?.descripcion ?? "";
  byId("section-menu").checked = section?.menu !== false;
  const custom = Boolean(section?.fondo && section.fondo.toLowerCase() !== "#000000");
  customBackground.checked = custom;
  backgroundPicker.value = custom ? section.fondo : "#000000";
  backgroundHex.value = custom ? section.fondo : "#000000";
  updateBackgroundPreview();
  if (editor) {
    editor.setContent(section?.html || "<p></p>");
    updateBackgroundPreview();
  }
  markDirty(false);
  window.setTimeout(() => {
    loadingEditor = false;
    suppressDirty = false;
    markDirty(false);
  }, 0);
}

function selectSection(section) {
  if (!section) return;
  if (isDirty && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos y abrir otra sección?")) return;
  activeSection = section;
  clearStatus();
  editorTitle.textContent = section.titulo;
  byId("section-kind").textContent = section.tipo === "antigua" ? "SECCIÓN ANTIGUA · HTML" : "SECCIÓN NUEVA · MARKDOWN + HTML";
  editorSubtitle.textContent = section.tipo === "antigua"
    ? `Se guardará el contenido y sus ajustes en ${section.path}.`
    : `Se guardará en ${section.path}.`;
  byId("save-explanation").textContent = section.tipo === "antigua"
    ? "Guardar actualiza el archivo de la página y sus ajustes en un único commit."
    : "Guardar actualiza el archivo Markdown de esta sección en un commit.";
  newSubsectionButton.disabled = section.menu === false;
  deleteButton.hidden = section.tipo === "borrador";
  renderSectionList();
  setFormValues(section);
}

function renderSectionList() {
  const filter = byId("section-search").value.trim().toLocaleLowerCase("es");
  const filtered = allSections.filter((section) => `${section.titulo} ${section.slug}`.toLocaleLowerCase("es").includes(filter));
  byId("section-count").textContent = `${filtered.length} de ${allSections.length} secciones`;
  sectionList.replaceChildren();
  for (const section of filtered) {
    const siblings = allSections.filter((candidate) => (candidate.padre || "") === (section.padre || ""));
    const siblingIndex = siblings.indexOf(section);
    const row = document.createElement("div");
    row.className = "section-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-choice";
    button.setAttribute("aria-current", String(activeSection?.id === section.id));
    const numeral = document.createElement("span");
    numeral.className = "section-index";
    numeral.textContent = String(allSections.indexOf(section) + 1).padStart(2, "0");
    const copy = document.createElement("span");
    copy.className = "section-choice-copy";
    const title = document.createElement("span");
    title.className = "section-choice-title";
    title.textContent = section.titulo || section.slug;
    const parent = allSections.find((candidate) => candidate.slug === section.padre);
    const parentLabel = document.createElement("span");
    parentLabel.className = "section-choice-parent";
    parentLabel.textContent = parent ? `Subsección de ${parent.titulo}` : "";
    const kind = document.createElement("span");
    kind.className = "section-choice-kind";
    kind.textContent = section.tipo === "antigua" ? "Antigua" : "Nueva";
    copy.append(title);
    if (parent) copy.append(parentLabel);
    copy.append(kind);
    button.append(numeral, copy);
    button.addEventListener("click", () => selectSection(section));
    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.className = "section-reorder";
    moveUp.textContent = "↑";
    moveUp.title = `Subir «${section.titulo}» entre sus secciones del mismo nivel`;
    moveUp.setAttribute("aria-label", moveUp.title);
    moveUp.disabled = savingSectionOrder || siblingIndex === 0;
    moveUp.addEventListener("click", () => moveSection(section, -1));
    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.className = "section-reorder";
    moveDown.textContent = "↓";
    moveDown.title = `Bajar «${section.titulo}» entre sus secciones del mismo nivel`;
    moveDown.setAttribute("aria-label", moveDown.title);
    moveDown.disabled = savingSectionOrder || siblingIndex === siblings.length - 1;
    moveDown.addEventListener("click", () => moveSection(section, 1));
    row.append(button, moveUp, moveDown);
    sectionList.append(row);
  }
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.style.cssText = "padding:10px;font-size:12px";
    empty.textContent = "No hay secciones que coincidan con la búsqueda.";
    sectionList.append(empty);
  }
}

async function moveSection(section, direction) {
  if (!client || savingSectionOrder) return;
  const siblings = allSections.filter((candidate) => (candidate.padre || "") === (section.padre || ""));
  const siblingIndex = siblings.indexOf(section);
  const target = siblings[siblingIndex + direction];
  if (!target) return;
  const previousOrder = [...allSections];
  const currentIndex = allSections.indexOf(section);
  const targetIndex = allSections.indexOf(target);
  [allSections[currentIndex], allSections[targetIndex]] = [allSections[targetIndex], allSections[currentIndex]];
  savingSectionOrder = true;
  renderSectionList();
  showStatus("Guardando el orden de las secciones en GitHub…");
  try {
    await client.saveSectionOrder(allSections);
    showStatus("Se ha guardado el nuevo orden de las secciones.", "success");
  } catch (error) {
    allSections = previousOrder;
    showStatus(error.message || String(error), "error");
  } finally {
    savingSectionOrder = false;
    renderSectionList();
  }
}

async function initializeEditor() {
  if (!window.tinymce) throw new Error("No se pudo cargar TinyMCE. Comprueba tu conexión y recarga la página.");
  if (!window.marked?.parse) throw new Error("No se pudo cargar el conversor Markdown. Comprueba tu conexión y recarga la página.");
  const created = await window.tinymce.init({
    selector: "#content",
    document_base_url: `https://raw.githubusercontent.com/${encodeURIComponent(client.owner)}/${encodeURIComponent(client.repo)}/${client.branch.split("/").map(encodeURIComponent).join("/")}/public/`,
    height: 570,
    min_height: 440,
    menubar: "edit view insert format tools table",
    plugins: "advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table wordcount help",
    toolbar: "undo redo | fontfamily fontsize | blocks | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist | outdent indent | link image table | removeformat code fullscreen",
    font_family_formats: "Arial=Arial,Helvetica,sans-serif; Arial Black=Arial Black,Arial,sans-serif; Comic Sans MS=Comic Sans MS,cursive; Courier New=Courier New,Courier,monospace; Georgia=Georgia,serif; Impact=Impact,Charcoal,sans-serif; Tahoma=Tahoma,Geneva,sans-serif; Times New Roman=Times New Roman,Times,serif; Trebuchet MS=Trebuchet MS,Helvetica,sans-serif; Verdana=Verdana,Geneva,sans-serif",
    font_size_formats: "8pt 9pt 10pt 11pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt 60pt 72pt",
    license_key: "gpl",
    branding: false,
    promotion: false,
    resize: true,
    statusbar: true,
    elementpath: true,
    paste_data_images: true,
    convert_urls: false,
    relative_urls: false,
    remove_script_host: false,
    valid_classes: { "*": "*" },
    extended_valid_elements: "div[class|id|style],span[class|id|style],p[class|id|style],img[class|id|style|src|alt|title|width|height|loading|decoding|border],table[class|id|style|width|border|cellpadding|cellspacing],tbody[class|style],thead[class|style],tfoot[class|style],tr[class|style],td[class|id|style|colspan|rowspan|width|height|align|valign],th[class|id|style|colspan|rowspan|width|height|align|valign],a[class|id|style|href|name|target|title|rel],iframe[src|width|height|frameborder|allowfullscreen|title|class|style],font[face|size|color|class|style]",
    content_style: "html{min-height:100%;}body{margin:0;padding:16px;min-height:560px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.5}img,video,iframe{max-width:100%}table{max-width:100%;border-collapse:collapse}a{overflow-wrap:anywhere}",
    setup(instance) {
      instance.on("init", () => { editor = instance; updateBackgroundPreview(); });
      instance.on("input change undo redo SetContent", () => { if (!loadingEditor && activeSection) markDirty(true); });
      instance.on("drop", () => { if (!loadingEditor && activeSection) markDirty(true); });
    },
    file_picker_types: "image",
    file_picker_callback(callback, value, meta) {
      if (meta.filetype !== "image") return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file || !client) return;
        try {
          showStatus("Subiendo la imagen a public/images/subidas…");
          const path = await client.uploadImage(file);
          callback(path, { title: file.name, alt: file.name.replace(/\.[^.]+$/, "") });
          showStatus("Imagen subida a GitHub. Guarda también la sección para publicar la referencia.", "success");
        } catch (error) { showStatus(error.message || String(error), "error"); }
      });
      input.click();
    },
    images_upload_handler: async (blobInfo, progress) => {
      if (!client) throw new Error("Conecta con GitHub antes de subir imágenes.");
      progress(10);
      const path = await client.uploadImage(blobInfo.blob());
      progress(100);
      showStatus("Imagen subida a GitHub. Guarda la sección para publicar la referencia.", "success");
      return path;
    },
  });
  editor = created[0];
  updateBackgroundPreview();
}

async function loadAllSections() {
  showStatus("Conectando con GitHub y leyendo las secciones…");
  const sections = await client.listSections((markdown) => {
    if (window.marked?.parse) return window.marked.parse(markdown, { async: false });
    return `<p>${markdown.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char])}</p>`;
  });
  allSections = sections;
  connectionPanel.hidden = true;
  workspace.hidden = false;
  byId("connected-repo").textContent = `${byId("github-owner").value}/${byId("github-repo").value} · ${byId("github-branch").value}`;
  renderSectionList();
  selectSection(allSections[0]);
  showStatus(`Conectado. Se han cargado ${allSections.filter((item) => item.tipo === "antigua").length} secciones antiguas y ${allSections.filter((item) => item.tipo === "nueva").length} nuevas.`, "success");
}

connectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();
  const button = byId("connect-button");
  button.disabled = true;
  button.textContent = "Conectando…";
  try {
    client = new GitHubClient({
      owner: byId("github-owner").value,
      repo: byId("github-repo").value,
      branch: byId("github-branch").value,
      token: byId("github-token").value,
    });
    if (!editor) await initializeEditor();
    await loadAllSections();
  } catch (error) {
    client = null;
    editor?.remove();
    editor = null;
    showStatus(error.message || String(error), "error");
  } finally {
    button.disabled = false;
    button.textContent = "Conectar y cargar secciones";
  }
});

deleteButton.addEventListener("click", async () => {
  if (!client || !activeSection || activeSection.tipo === "borrador") return;
  const section = activeSection;
  if (allSections.some((item) => item.padre === section.slug)) {
    showStatus("Antes de borrar esta sección, asigna sus subsecciones a otra sección superior o déjalas como principales.", "error");
    return;
  }
  const message = isDirty
    ? `¿Borrar «${section.titulo}» de GitHub? También se descartarán los cambios sin guardar.`
    : `¿Borrar «${section.titulo}» de GitHub? Esta acción no se puede deshacer desde el editor.`;
  if (!window.confirm(message)) return;
  deleteButton.disabled = true;
  showStatus("Borrando la sección de GitHub…");
  try {
    await client.deleteSection(section);
    allSections = allSections.filter((item) => item.id !== section.id);
    activeSection = null;
    markDirty(false);
    if (allSections.length) {
      selectSection(allSections[0]);
    } else {
      deleteButton.hidden = true;
      setFormValues(null);
      editorTitle.textContent = "Elige una sección";
      byId("section-kind").textContent = "";
      editorSubtitle.textContent = "No hay secciones disponibles.";
      byId("save-explanation").textContent = "";
      newSubsectionButton.disabled = true;
      renderSectionList();
    }
    showStatus(`Se ha borrado «${section.titulo}» de GitHub.`, "success");
  } catch (error) {
    showStatus(error.message || String(error), "error");
  } finally {
    deleteButton.disabled = false;
  }
});

sectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client || !activeSection) return;
  if (!byId("section-title").value.trim()) {
    showStatus("Escribe un título antes de guardar.", "error");
    byId("section-title").focus();
    return;
  }
  saveButton.disabled = true;
  saveButton.textContent = "Guardando…";
  clearStatus();
  try {
    const values = readFormValues();
    let saved;
    if (activeSection.tipo === "borrador") {
      const slug = activeSection.slug;
      const draftId = activeSection.id;
      if (allSections.some((section) => section.id !== draftId && section.slug === slug)) throw new Error(`Ya existe una sección con la dirección «${slug}». Cambia el título para crear otra.`);
      saved = await client.createSection({ ...values, slug, orden: allSections.map((section) => section.slug) });
      allSections[allSections.findIndex((section) => section.id === draftId)] = saved;
    } else {
      saved = await client.saveSection(activeSection, values);
      Object.assign(activeSection, saved, { html: values.html });
    }
    activeSection = saved;
    newSubsectionButton.disabled = saved.menu === false;
    deleteButton.hidden = false;
    markDirty(false);
    renderSectionList();
    editorTitle.textContent = saved.titulo;
    byId("section-kind").textContent = saved.tipo === "antigua" ? "SECCIÓN ANTIGUA · HTML" : "SECCIÓN NUEVA · MARKDOWN + HTML";
    editorSubtitle.textContent = `Guardado en ${saved.path}.`;
    showStatus("Guardado en GitHub. La publicación del sitio se inicia automáticamente al llegar el commit a la rama principal.", "success");
  } catch (error) {
    showStatus(error.message || String(error), "error");
    if (error.status === 409 || error.status === 422) showStatus(`${error.message} Puede que la rama haya cambiado mientras editabas. Recarga las secciones y vuelve a aplicar tus cambios.`, "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = isDirty ? "Guardar cambios en GitHub" : "Guardar en GitHub";
  }
});

function crearBorrador(padre = "") {
  if (isDirty && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos y crear una sección nueva?")) return;
  const seccionPadre = allSections.find((section) => section.slug === padre);
  const tituloPrompt = seccionPadre
    ? `Título de la subsección de «${seccionPadre.titulo}»:`
    : "Título de la nueva sección:";
  const title = window.prompt(tituloPrompt);
  if (title === null) return;
  if (!title.trim()) { showStatus("Escribe un título para la nueva sección.", "error"); return; }
  const base = slugFromTitle(title);
  let slug = base;
  let suffix = 2;
  while (allSections.some((section) => section.slug === slug)) slug = `${base}-${suffix++}`;
  const draft = {
    id: `draft:${slug}`,
    slug,
    titulo: title.trim(),
    descripcion: "",
    fondo: null,
    menu: true,
    padre,
    fecha: new Date().toISOString(),
    html: "<p>Escribe aquí el contenido de tu nueva sección.</p>",
    tipo: "borrador",
    path: `src/nuevas/${slug}.md`,
  };
  allSections.push(draft);
  activeSection = draft;
  newSubsectionButton.disabled = draft.menu === false;
  deleteButton.hidden = true;
  editorTitle.textContent = draft.titulo;
  byId("section-kind").textContent = "NUEVA SECCIÓN · BORRADOR";
  editorSubtitle.textContent = `Se creará ${draft.path} al guardar.`;
  byId("save-explanation").textContent = "Al guardar se añadirá un archivo nuevo al repositorio y se generará un commit.";
  renderSectionList();
  setFormValues(draft);
  showStatus("Borrador local. Todavía no se ha creado ningún archivo en GitHub.");
}

newSectionButton.addEventListener("click", () => crearBorrador());
newSubsectionButton.addEventListener("click", () => {
  if (!activeSection || activeSection.menu === false) return;
  crearBorrador(activeSection.slug);
});

byId("section-search").addEventListener("input", renderSectionList);
customBackground.addEventListener("change", () => { updateBackgroundPreview(); markDirty(true); });
backgroundPicker.addEventListener("input", () => {
  backgroundHex.value = backgroundPicker.value.toLowerCase();
  updateBackgroundPreview();
  markDirty(true);
});
backgroundHex.addEventListener("input", () => {
  if (/^#[\da-f]{6}$/i.test(backgroundHex.value.trim())) backgroundPicker.value = backgroundHex.value.trim().toLowerCase();
  updateBackgroundPreview();
  markDirty(true);
});
byId("section-title").addEventListener("input", () => { if (!loadingEditor) { markDirty(true); if (activeSection) editorTitle.textContent = byId("section-title").value || "Sección sin título"; } });
byId("section-description").addEventListener("input", () => markDirty(true));
byId("section-menu").addEventListener("change", () => {
  markDirty(true);
  newSubsectionButton.disabled = !activeSection || !byId("section-menu").checked;
});
byId("section-parent").addEventListener("change", () => markDirty(true));

byId("reload-section-button").addEventListener("click", () => {
  if (!activeSection) return;
  if (isDirty && !window.confirm("¿Descartar todos los cambios que aún no has guardado?")) return;
  if (activeSection.tipo === "borrador") {
    allSections = allSections.filter((section) => section.id !== activeSection.id);
    activeSection = null;
    renderSectionList();
    setFormValues(null);
    editorTitle.textContent = "Elige una sección";
    showStatus("Borrador descartado. No se ha enviado nada a GitHub.");
    return;
  }
  setFormValues(activeSection);
  editorTitle.textContent = activeSection.titulo;
  showStatus("Se han recuperado los últimos contenidos cargados desde GitHub.");
});

byId("disconnect-button").addEventListener("click", () => {
  if (isDirty && !window.confirm("Tienes cambios sin guardar. ¿Quieres desconectarte y descartarlos?")) return;
  client = null;
  editor?.remove();
  editor = null;
  allSections = [];
  activeSection = null;
  connectionPanel.hidden = false;
  workspace.hidden = true;
  byId("github-token").value = "";
  newSubsectionButton.disabled = true;
  markDirty(false);
  deleteButton.hidden = true;
  clearStatus();
});

window.addEventListener("beforeunload", (event) => {
  if (isDirty) { event.preventDefault(); event.returnValue = ""; }
});
