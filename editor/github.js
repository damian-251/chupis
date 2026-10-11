const API_ROOT = "https://api.github.com";

function encodePath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

export function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function parseScalar(value) {
  const text = value.trim();
  if (!text) return "";
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null" || text === "~") return null;
  if (text.startsWith('"')) {
    try { return JSON.parse(text); } catch { /* deja el texto original */ }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replaceAll("''", "'");
  return text.replace(/\s+#.*$/, "");
}

export function parseMarkdownDocument(text) {
  const match = text.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, body: text };
  const metadata = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (field) metadata[field[1]] = parseScalar(field[2]);
  }
  return { metadata, body: match[2] };
}

export function serializeMarkdownDocument(section, html) {
  const fecha = section.fecha || new Date().toISOString();
  const lines = [
    `titulo: ${JSON.stringify(section.titulo.trim())}`,
    `descripcion: ${JSON.stringify((section.descripcion || "").trim())}`,
    `fondo: ${JSON.stringify(section.fondo || "#000000")}`,
    `menu: ${section.menu !== false}`,
    ...(section.padre ? [`padre: ${JSON.stringify(section.padre)}`] : []),
    `fecha: ${JSON.stringify(fecha)}`,
  ];
  return `---\n${lines.join("\n")}\n---\n\n${html.trim()}\n`;
}

export function slugFromTitle(title) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "nueva-seccion";
}

export class GitHubClient {
  constructor({
  owner,
  repo,
  branch = "main",
  token,
  fetchImpl = (...args) => globalThis.fetch(...args)
}) {
    this.owner = owner.trim();
    this.repo = repo.trim();
    this.branch = branch.trim();
    this.token = token.trim();
    this.fetchImpl = fetchImpl;
    if (!this.owner || !this.repo || !this.branch || !this.token) throw new Error("Completa el usuario, repositorio, rama y token de GitHub.");
  }

  async request(path, options = {}) {
    const response = await this.fetchImpl(`${API_ROOT}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const raw = await response.text();
    let result = {};
    if (raw) {
      try { result = JSON.parse(raw); } catch { result = { message: raw }; }
    }
    if (!response.ok) {
      const detail = result.message || response.statusText || "Error desconocido";
      const hint = response.status === 401
        ? " Comprueba que el token sea válido y no haya caducado."
        : response.status === 403 && /permission|resource not accessible|forbidden/i.test(detail)
          ? " Comprueba que el token tenga acceso al repositorio y permiso de lectura y escritura en Contents."
          : "";
      const error = new Error(`GitHub (${response.status}): ${detail}.${hint}`);
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async readText(path) {
    const file = await this.request(`/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`);
    if (file.type !== "file" || typeof file.content !== "string") throw new Error(`GitHub no devolvió el contenido de ${path}.`);
    if (file.encoding === "base64") return decodeBase64Utf8(file.content);
    return file.content;
  }

  async listSections(renderMarkdown = (markdown) => markdown) {
    const rawSections = JSON.parse(await this.readText("src/secciones.json"));
    const legacySections = await Promise.all(rawSections.map(async (item) => {
      const path = `src/paginas/${item.slug}.html`;
      return {
        ...item,
        id: `legacy:${item.slug}`,
        tipo: "antigua",
        path,
        html: await this.readText(path),
        fondo: item.fondo || null,
        menu: item.menu !== false,
      };
    }));

    const directory = await this.request(`/contents/src/nuevas?ref=${encodeURIComponent(this.branch)}`);
    const markdownFiles = Array.isArray(directory) ? directory.filter((item) => item.type === "file" && item.name.endsWith(".md")) : [];
    const newSections = await Promise.all(markdownFiles.map(async (file) => {
      const [content, path] = [await this.readText(file.path), file.path];
      const parsed = parseMarkdownDocument(content);
      const slug = file.name.replace(/\.md$/i, "");
      const meta = parsed.metadata;
      return {
        id: `new:${slug}`,
        slug,
        titulo: String(meta.titulo ?? slug),
        descripcion: String(meta.descripcion ?? ""),
        fondo: String(meta.fondo ?? "#000000").toLowerCase() === "#000000" ? null : String(meta.fondo ?? ""),
        menu: meta.menu !== false,
        padre: String(meta.padre ?? ""),
        fecha: meta.fecha ?? "",
        html: renderMarkdown(parsed.body),
        markdown: parsed.body,
        tipo: "nueva",
        path,
      };
    }));
    newSections.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.slug.localeCompare(b.slug, "es"));
    return [...legacySections, ...newSections];
  }

  async saveSection(current, values) {
    const fondo = values.usarFondo && values.fondo.toLowerCase() !== "#000000" ? values.fondo.toLowerCase() : null;
    const section = {
      ...current,
      titulo: values.titulo.trim(),
      descripcion: values.descripcion.trim() || values.titulo.trim(),
      fondo,
      menu: values.menu,
      padre: values.padre || "",
      fecha: current.fecha || new Date().toISOString(),
    };
    if (!section.titulo) throw new Error("El título es obligatorio.");

    if (section.tipo === "antigua") {
      const sectionsPath = "src/secciones.json";
      const latestSections = JSON.parse(await this.readText(sectionsPath));
      const index = latestSections.findIndex((item) => item.slug === section.slug);
      if (index < 0) throw new Error(`La sección «${section.slug}» ya no aparece en src/secciones.json. Recarga la lista antes de guardar.`);
      const updatedSection = {
        ...latestSections[index],
        titulo: section.titulo,
        descripcion: section.descripcion,
        fondo: section.fondo,
        menu: section.menu,
      };
      if (section.padre) updatedSection.padre = section.padre;
      else delete updatedSection.padre;
      latestSections[index] = updatedSection;
      const htmlPath = `src/paginas/${section.slug}.html`;
      await this.commitFiles([
        { path: htmlPath, content: values.html },
        { path: sectionsPath, content: `${JSON.stringify(latestSections, null, 2)}\n` },
      ], `Editar sección antigua: ${section.titulo}`);
    } else {
      const markdown = serializeMarkdownDocument(section, values.html);
      await this.commitFiles([{ path: section.path, content: markdown }], `Editar sección: ${section.titulo}`);
    }
    return section;
  }

  async createSection(values) {
    const slug = values.slug;
    const filePath = `src/nuevas/${slug}.md`;
    const section = {
      slug,
      titulo: values.titulo.trim(),
      descripcion: values.descripcion.trim() || values.titulo.trim(),
      fondo: values.usarFondo && values.fondo.toLowerCase() !== "#000000" ? values.fondo.toLowerCase() : null,
      menu: values.menu,
      padre: values.padre || "",
      fecha: new Date().toISOString(),
    };
    if (!section.titulo) throw new Error("El título es obligatorio.");
    const markdown = serializeMarkdownDocument(section, values.html);
    await this.commitFiles([{ path: filePath, content: markdown }], `Crear sección: ${section.titulo}`);
    return { ...section, id: `new:${slug}`, tipo: "nueva", path: filePath, html: values.html };
  }

  async deleteSection(section) {
    if (section.tipo === "antigua") {
      const sectionsPath = "src/secciones.json";
      const latestSections = JSON.parse(await this.readText(sectionsPath));
      const remainingSections = latestSections.filter((item) => item.slug !== section.slug);
      if (remainingSections.length === latestSections.length) {
        throw new Error(`La sección «${section.slug}» ya no aparece en src/secciones.json. Recarga la lista antes de borrarla.`);
      }
      await this.commitFiles([
        { path: `src/paginas/${section.slug}.html`, delete: true },
        { path: sectionsPath, content: `${JSON.stringify(remainingSections, null, 2)}\n` },
      ], `Borrar sección: ${section.titulo}`);
      return;
    }
    if (section.tipo !== "nueva") throw new Error("Solo se pueden borrar secciones guardadas.");
    await this.commitFiles([{ path: section.path, delete: true }], `Borrar sección: ${section.titulo}`);
  }

  async uploadImage(file) {
    if (!(file instanceof Blob)) throw new Error("No se ha seleccionado un archivo de imagen válido.");
    if (file.size > 5 * 1024 * 1024) throw new Error("La imagen pesa más de 5 MB. Reduce su tamaño e inténtalo de nuevo.");
    const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);
    if (!allowedImageTypes.has(file.type)) throw new Error("Formato no admitido. Usa una imagen JPG, PNG, GIF, WebP o AVIF.");
    const originalName = typeof file.name === "string" && file.name ? file.name : "imagen";
    const extension = (originalName.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1] || ({
      "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif",
    }[file.type] || "jpg")).toLowerCase();
    const safeName = originalName.replace(/\.[^.]*$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "imagen";
    const filename = `${Date.now()}-${safeName}.${extension}`;
    const path = `public/images/subidas/${filename}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    await this.request(`/contents/${encodePath(path)}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Subir imagen: ${filename}`,
        content: btoa(binary),
        branch: this.branch,
      }),
    });
    return `images/subidas/${filename}`;
  }

  async commitFiles(files, message) {
    const ref = await this.request(`/git/ref/heads/${encodeURIComponent(this.branch)}`);
    const parentSha = ref.object?.sha;
    if (!parentSha) throw new Error("No se pudo averiguar el último commit de la rama.");
    const parent = await this.request(`/git/commits/${encodeURIComponent(parentSha)}`);
    const tree = await this.request("/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: files.map((file) => file.delete
          ? { path: file.path, mode: "100644", type: "blob", sha: null }
          : { path: file.path, mode: "100644", type: "blob", content: file.content }),
      }),
    });
    const commit = await this.request("/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
    });
    await this.request(`/git/refs/heads/${encodeURIComponent(this.branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return commit;
  }
}
