// Configuración del editor visual de Chupis.
// IMPORTANTE: cambia "repo" por tu usuario y el nombre de tu repositorio de GitHub.
CMS.init({
  config: {
    load_config_file: false,
    app_title: "Editor de Chupis",

    backend: {
      name: "github",
      repo: "damian-251/chupis",
      branch: "main",
      auth_methods: ["token"], // cada editor entra con su token personal de GitHub
      commit_messages: {
        create: "Nueva sección: {{slug}}",
        update: "Editar sección: {{slug}}",
        delete: "Borrar sección: {{slug}}",
        uploadMedia: "Subir imagen: {{path}}",
        deleteMedia: "Borrar imagen: {{path}}",
      },
    },

    // Se publica directamente, sin revisión previa.
    publish_mode: "simple",

    // Las imágenes se guardan en el repositorio y se enlazan desde la raíz del sitio.
    media_folder: "public/images/subidas",
    public_folder: "/images/subidas",

    // Las direcciones salen del título: "Mi sección" -> /mi-seccion/
    slug: { encoding: "ascii", clean_accents: true },

    collections: [
      {
        name: "secciones",
        label: "Secciones nuevas",
        label_singular: "sección",
        folder: "src/nuevas",
        extension: "md",
        create: true,
        identifier_field: "titulo",
        summary: "{{titulo}}",
        fields: [
          {
            name: "titulo",
            label: "Título",
            widget: "string",
            hint: "Es el nombre que aparece en el menú y como encabezado de la página.",
          },
          {
            name: "descripcion",
            label: "Descripción corta",
            widget: "string",
            required: false,
            hint: "Una frase para los buscadores. Si la dejas vacía se usa el título.",
          },
          {
            name: "fondo",
            label: "Color de fondo",
            widget: "color",
            default: "#000000",
            allowInput: true,
            hint: "El color del texto y de los enlaces se ajusta solo para que se lea.",
          },
          { name: "menu", label: "Mostrar en el menú", widget: "boolean", default: true },
          { name: "fecha", label: "Fecha de creación", widget: "datetime", default: "{{now}}", hint: "Decide el orden en el menú: las más nuevas van al final." },
          {
            name: "body",
            label: "Contenido",
            widget: "markdown",
            buttons: ["bold", "italic", "link", "heading-two", "heading-three", "quote", "bulleted-list", "numbered-list"],
            editor_components: ["image"],
            modes: ["rich_text"],
          },
        ],
      },
    ],
  },
});
