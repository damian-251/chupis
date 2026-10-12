import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GitHubClient,
  applySectionOrder,
  decodeBase64Utf8,
  encodeBase64Utf8,
  parseMarkdownDocument,
  serializeMarkdownDocument,
  slugFromTitle,
} from '../editor/github.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sections = JSON.parse(await readFile(path.join(root, 'src/secciones.json'), 'utf8'));

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

class SimulatedGitHub {
  constructor() {
    this.files = new Map();
    this.requests = [];
    this.createdTree = null;
    this.createdCommit = null;
    this.patchedRef = null;
    this.files.set('src/secciones.json', JSON.stringify(sections, null, 2) + '\n');
  }

  async initialize() {
    for (const section of sections) {
      this.files.set(`src/paginas/${section.slug}.html`, await readFile(path.join(root, 'src/paginas', `${section.slug}.html`), 'utf8'));
    }
    for (const name of await readdir(path.join(root, 'src/nuevas'))) {
      if (name.endsWith('.md')) this.files.set(`src/nuevas/${name}`, await readFile(path.join(root, 'src/nuevas', name), 'utf8'));
    }
  }

  fetch = async (requestUrl, options = {}) => {
    const url = new URL(requestUrl);
    const prefix = '/repos/demo/chupis';
    const route = decodeURIComponent(url.pathname.slice(prefix.length));
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    this.requests.push({ route, method, body, headers: options.headers });

    if (route.startsWith('/contents/')) {
      const filePath = route.slice('/contents/'.length);
      if (method === 'GET' && this.files.has(filePath)) {
        const content = this.files.get(filePath);
        return response({ type: 'file', encoding: 'base64', content: encodeBase64Utf8(content), sha: `sha-${filePath}` });
      }
      if (method === 'GET' && filePath === 'src/nuevas') {
        const children = [...this.files.keys()].filter((item) => item.startsWith('src/nuevas/') && !item.slice('src/nuevas/'.length).includes('/'));
        return response(children.map((item) => ({ type: 'file', name: path.basename(item), path: item })));
      }
      if (method === 'PUT') return response({ content: { path: filePath } }, 201);
      return response({ message: `Not Found: ${filePath}` }, 404);
    }
    if (route === '/git/ref/heads/main' && method === 'GET') return response({ object: { sha: 'head-1' } });
    if (route === '/git/commits/head-1' && method === 'GET') return response({ tree: { sha: 'tree-1' } });
    if (route === '/git/trees' && method === 'POST') {
      this.createdTree = body;
      return response({ sha: 'tree-created' });
    }
    if (route === '/git/commits' && method === 'POST') {
      this.createdCommit = body;
      return response({ sha: 'commit-created' });
    }
    if (route === '/git/refs/heads/main' && method === 'PATCH') {
      this.patchedRef = body;
      return response({ ref: 'refs/heads/main', object: { sha: body.sha } });
    }
    return response({ message: `Unhandled mock route: ${method} ${route}` }, 500);
  };
}

function makeClient(mock) {
  return new GitHubClient({ owner: 'demo', repo: 'chupis', branch: 'main', token: 'test-token', fetchImpl: mock.fetch });
}

test('el editor puede cargar las 45 secciones antiguas y el contenido de cada una desde la API simulada', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  const loaded = await client.listSections((body) => `<p>${body}</p>`);
  const old = loaded.filter((item) => item.tipo === 'antigua');
  assert.equal(loaded.find((item) => item.slug === 'noticias').padre, 'bienrecibidos');
  assert.equal(old.length, 45);
  assert.equal(new Set(old.map((item) => item.slug)).size, 45);
  for (const section of old) {
    assert.ok(section.html.length > 0, `${section.slug} tiene contenido`);
    assert.equal(section.path, `src/paginas/${section.slug}.html`);
  }
  assert.ok(mock.requests.filter((r) => r.route.startsWith('/contents/src/paginas/')).length >= 45);
});

test('el orden guardado incluye secciones antiguas y nuevas y se aplica al volver a cargar', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  const loaded = await client.listSections();
  const reordered = [...loaded].reverse();

  await client.saveSectionOrder(reordered);
  const entry = mock.createdTree.tree.find((item) => item.path === 'src/orden-secciones.json');
  assert.deepEqual(JSON.parse(entry.content), reordered.map((section) => section.slug));

  mock.files.set('src/orden-secciones.json', entry.content);
  const reloaded = await client.listSections();
  assert.deepEqual(reloaded.map((section) => section.slug), reordered.map((section) => section.slug));
});

test('el orden solo desplaza secciones existentes y conserva al final las que no tienen posición explícita', () => {
  const sections = [{ slug: 'uno' }, { slug: 'dos' }, { slug: 'tres' }];
  assert.deepEqual(applySectionOrder(sections, ['tres', 'desconocida', 'tres']), [sections[2], sections[0], sections[1]]);
});

test('guardar una sección antigua genera un solo commit con contenido y metadatos, sin alterar las otras 44', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  const loaded = await client.listSections();
  const target = loaded.find((item) => item.slug === 'noticias');
  const nextHtml = '<p>Prueba guardada: ñandú, acción y música.</p>';
  await client.saveSection(target, {
    titulo: 'Noticias de prueba',
    descripcion: 'Descripción de prueba',
    usarFondo: true,
    fondo: '#224466',
    menu: false,
    padre: '10pokemon',
    html: nextHtml,
  });
  assert.equal(mock.createdTree.tree.length, 2);
  const htmlEntry = mock.createdTree.tree.find((entry) => entry.path === 'src/paginas/noticias.html');
  const jsonEntry = mock.createdTree.tree.find((entry) => entry.path === 'src/secciones.json');
  assert.equal(htmlEntry.content, nextHtml);
  const savedList = JSON.parse(jsonEntry.content);
  assert.equal(savedList.length, 45);
  const saved = savedList.find((item) => item.slug === 'noticias');
  assert.equal(saved.titulo, 'Noticias de prueba');
  assert.equal(saved.descripcion, 'Descripción de prueba');
  assert.equal(saved.fondo, '#224466');
  assert.equal(saved.menu, false);
  assert.equal(saved.padre, '10pokemon');
  assert.equal(savedList.find((item) => item.slug === 'bienrecibidos').titulo, 'Bienrecibidos');
  assert.deepEqual(mock.createdCommit.parents, ['head-1']);
  assert.deepEqual(mock.patchedRef, { sha: 'commit-created', force: false });
});

test('editar una sección permite devolverla al nivel principal', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  const loaded = await client.listSections();
  const target = loaded.find((item) => item.slug === 'noticias');
  await client.saveSection(target, {
    titulo: target.titulo,
    descripcion: target.descripcion,
    usarFondo: false,
    fondo: '#000000',
    menu: true,
    padre: '',
    html: target.html,
  });

  const manifest = JSON.parse(mock.createdTree.tree.find((item) => item.path === 'src/secciones.json').content);
  assert.equal(Object.hasOwn(manifest.find((item) => item.slug === 'noticias'), 'padre'), false);
});

test('borrar una sección antigua elimina su HTML y metadatos en un commit', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  const loaded = await client.listSections();
  const target = loaded.find((item) => item.slug === 'noticias');
  await client.deleteSection(target);
  assert.equal(mock.requests[0].headers.Authorization, 'Bearer test-token');
  assert.equal(mock.createdTree.tree.length, 2);
  assert.deepEqual(mock.createdTree.tree.find((item) => item.path === 'src/paginas/noticias.html'), {
    path: 'src/paginas/noticias.html',
    mode: '100644',
    type: 'blob',
    sha: null,
  });
  const manifest = JSON.parse(mock.createdTree.tree.find((item) => item.path === 'src/secciones.json').content);
  assert.equal(manifest.some((item) => item.slug === 'noticias'), false);
  assert.equal(manifest.length, 44);
  assert.equal(mock.patchedRef.sha, 'commit-created');
});

test('borrar una sección nueva elimina su archivo Markdown', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  await client.deleteSection({
    slug: 'prueba-nueva',
    titulo: 'Prueba nueva',
    tipo: 'nueva',
    path: 'src/nuevas/prueba-nueva.md',
  });
  assert.deepEqual(mock.createdTree.tree, [{
    path: 'src/nuevas/prueba-nueva.md',
    mode: '100644',
    type: 'blob',
    sha: null,
  }]);
});

test('la codificación Base64 conserva tildes, eñes y símbolos', () => {
  const sample = 'Chupis: canción, ñandú, Pokémon 😊';
  assert.equal(decodeBase64Utf8(encodeBase64Utf8(sample)), sample);
});

test('el frontmatter Markdown se interpreta y se serializa sin perder metadatos', () => {
  const source = '---\ntitulo: "Sección de prueba: ñ"\ndescripcion: "Descripción breve"\nfondo: "#330033"\nmenu: false\nfecha: "2026-10-11T10:00:00.000Z"\n---\n\n<p>Hola</p>\n';
  const parsed = parseMarkdownDocument(source);
  assert.equal(parsed.metadata.titulo, 'Sección de prueba: ñ');
  assert.equal(parsed.metadata.menu, false);
  assert.equal(parsed.body.trim(), '<p>Hola</p>');
  const serialized = serializeMarkdownDocument({
    titulo: parsed.metadata.titulo,
    descripcion: parsed.metadata.descripcion,
    fondo: parsed.metadata.fondo,
    menu: parsed.metadata.menu,
    fecha: parsed.metadata.fecha,
  }, parsed.body);
  const parsedAgain = parseMarkdownDocument(serialized);
  assert.deepEqual(parsedAgain.metadata, parsed.metadata);
  assert.equal(parsedAgain.body.trim(), parsed.body.trim());
});


test('crear una sección nueva guarda el Markdown con cabecera YAML sin cambiar las 45 antiguas', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  await client.createSection({
    slug: 'prueba-nueva',
    titulo: 'Prueba nueva: Ñandú',
    descripcion: 'Una descripción',
    usarFondo: true,
    fondo: '#123456',
    menu: true,
    padre: 'bienrecibidos',
    html: '<p>Contenido con <strong>formato</strong>.</p>',
  });

  assert.equal(mock.createdTree.tree.length, 1);
  const entry = mock.createdTree.tree[0];
  assert.equal(entry.path, 'src/nuevas/prueba-nueva.md');
  const parsed = parseMarkdownDocument(entry.content);
  assert.equal(parsed.metadata.titulo, 'Prueba nueva: Ñandú');
  assert.equal(parsed.metadata.fondo, '#123456');
  assert.equal(parsed.metadata.menu, true);
  assert.equal(parsed.metadata.padre, 'bienrecibidos');
  assert.equal(parsed.body.trim(), '<p>Contenido con <strong>formato</strong>.</p>');
  assert.equal(mock.patchedRef.sha, 'commit-created');
  assert.equal(mock.createdTree.tree.some((item) => item.path === 'src/secciones.json'), false);
});

test('guardar color de fondo hexadecimal no válido se rechaza antes de crear un commit', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  await assert.rejects(() => client.createSection({
    slug: 'color-invalido',
    titulo: 'Color inválido',
    usarFondo: true,
    fondo: '#12xx56',
    html: '<p>Prueba</p>',
  }), /código hexadecimal de seis dígitos/);
  assert.equal(mock.createdTree, null);
});

test('crear una sección guarda su orden junto con el archivo Markdown', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  const order = ['bienrecibidos', 'nueva-seccion', 'noticias'];
  await client.createSection({
    slug: 'nueva-seccion',
    titulo: 'Nueva sección',
    descripcion: '',
    usarFondo: false,
    fondo: '#000000',
    menu: true,
    html: '<p>Contenido</p>',
    orden: order,
  });

  assert.deepEqual(mock.createdTree.tree.map((file) => file.path).sort(), [
    'src/nuevas/nueva-seccion.md',
    'src/orden-secciones.json',
  ]);
  assert.deepEqual(JSON.parse(mock.createdTree.tree.find((file) => file.path === 'src/orden-secciones.json').content), order);
});

test('subir una imagen a GitHub usa una ruta segura y rechaza SVG y archivos grandes', async () => {
  const mock = new SimulatedGitHub();
  await mock.initialize();
  const client = makeClient(mock);
  const file = new File([new Uint8Array([1, 2, 3, 4])], 'Foto ñandú.png', { type: 'image/png' });
  const relativePath = await client.uploadImage(file);
  assert.match(relativePath, /^images\/subidas\/\d+-foto-nandu\.png$/);
  const put = mock.requests.find((request) => request.method === 'PUT');
  assert.equal(put.route.startsWith('/contents/public/images/subidas/'), true);
  assert.equal(put.body.branch, 'main');
  await assert.rejects(() => client.uploadImage(new File(['<svg/>'], 'vector.svg', { type: 'image/svg+xml' })), /Formato no admitido/);
  await assert.rejects(() => client.uploadImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })), /más de 5 MB/);
});

test('los títulos españoles generan direcciones sencillas y limpias', () => {
  assert.equal(slugFromTitle('Fotos de Pokémon y diversión'), 'fotos-de-pokemon-y-diversion');
  assert.equal(slugFromTitle('  !!!  '), 'nueva-seccion');
});
