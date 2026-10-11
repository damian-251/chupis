# Cómo usar el editor visual de Chupis

El editor permite modificar las 45 secciones antiguas y las secciones nuevas. No hace falta saber programar: puedes cambiar el texto, usar distintas fuentes y tamaños, colorear palabras, insertar enlaces, tablas e imágenes, y elegir el fondo de cada sección.

## Antes de empezar (solo la primera vez)

1. Acepta la invitación al repositorio de GitHub que te llegará por correo.
2. Crea un token personal de GitHub. Es una clave privada; guárdala en un gestor de contraseñas y no se la envíes a nadie.
   - **Token de acceso detallado (recomendado):** en GitHub, entra en *Settings → Developer settings → Personal access tokens → Fine-grained tokens*. Limita el token al repositorio de Chupis y concede **Contents: Read and write**.
   - **Token clásico:** marca `public_repo` si el repositorio es público o `repo` si es privado.
3. Copia el token cuando GitHub te lo muestre. El editor no lo guarda en el repositorio ni en el almacenamiento persistente del navegador.

## Entrar y editar

1. Abre la dirección del editor que te dará quien administra el sitio. Suele tener este formato: `https://TU_USUARIO.github.io/TU_REPOSITORIO/`.
2. Completa el usuario, el nombre del repositorio y la rama (`main` por defecto), pega tu token y pulsa **Conectar y cargar secciones**.
3. Elige una sección en la columna de la izquierda. Usa el buscador para encontrarla rápidamente.
4. Edita el título, la descripción, la sección superior, el fondo y el contenido. El fondo se ve en el área de escritura mientras trabajas.
5. Selecciona texto para cambiar su tipo de letra, tamaño, color, alineación, estilo o para añadir enlaces y listas.
6. Pulsa **Guardar en GitHub**. Las secciones antiguas se guardan junto con sus metadatos en un único commit; las nuevas se guardan en `src/nuevas/`. Al llegar el commit a `main`, las acciones del repositorio regeneran el sitio.
7. Para quitar una sección, selecciónala y pulsa **Borrar sección**. Confirma la acción; las secciones antiguas se eliminan junto con su archivo y las nuevas se quitan de `src/nuevas/`.

## Crear una sección nueva

Pulsa **+ Nueva**, escribe el título, completa la descripción, la sección superior, el fondo y el contenido y pulsa **Guardar en GitHub**. La dirección se genera automáticamente a partir del título. Antes de guardar, el borrador solo está en el navegador. Para crear una subsección directamente dentro de la página seleccionada, pulsa **+ Sub.**.

En **Sección superior · subsección de** puedes elegir o cambiar dónde aparece la página en el menú lateral. Si eliges una sección superior, la página quedará dentro de su submenú; puedes repetirlo para crear varios niveles. Para que una sección aparezca como opción superior, déjala en **Ninguna · sección principal**. La lista del editor indica también de qué sección depende cada subsección. Una sección con subsecciones no se puede borrar hasta reasignarlas.

## Imágenes

Usa el botón de imagen y selecciona un archivo. El editor lo sube a `public/images/subidas/` en GitHub. Se admiten imágenes de hasta 5 MB. La subida de la imagen crea su propio commit; guarda también la sección después de insertarla. Las imágenes guardadas en el repositorio también se muestran en la vista de edición.

## Recomendaciones importantes

- Pulsa **Descartar cambios** para recuperar la versión que cargaste de GitHub. Cambiar de página con cambios sin guardar también pedirá confirmación.
- No cierres ni compartas tu token. Pulsa **Desconectar** cuando termines; el campo del token se vacía.
- El guardado crea un commit directamente en la rama seleccionada. Comprueba el título y el contenido antes de guardar.
- Si aparece un error de permisos, comprueba que el token tiene acceso al repositorio y permiso de lectura y escritura en `Contents`.
- Si GitHub avisa de que la rama ha cambiado mientras editabas, vuelve a cargar el editor y aplica de nuevo los cambios sobre la versión más reciente.
- Tras guardar, la publicación empieza automáticamente al llegar el commit a `main`; puede tardar unos minutos.

## Si el editor no se abre

El editor necesita conexión a Internet para cargar TinyMCE y el acceso a GitHub. Si no aparece la barra de fuentes y tamaños, recarga la página y comprueba que la red no bloquee `cdn.jsdelivr.net`.
