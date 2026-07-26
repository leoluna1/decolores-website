# decolores-website
## Papelería De Colores

Sitio estático para una papelería con home comercial, catálogo filtrable y lista de pedido por WhatsApp.

### Ejecutar en local

```bash
python3 -m http.server 3002
```

Abrir `http://localhost:3002`.

### Ejecutar con panel admin

Instalar dependencias una sola vez:

```bash
npm install
```

Arrancar el servidor:

```bash
npm start
```

Abrir:

- Sitio: `http://localhost:4173`
- Admin: `http://localhost:4173/admin`

Credenciales locales por defecto:

- Usuario: `admin`
- Contrasena: `admin123`

Para produccion, definir variables de entorno:

```bash
ADMIN_USER=admin ADMIN_PASSWORD="cambia-esta-clave" SESSION_SECRET="clave-larga-random" npm start
```

El admin guarda productos en `data/decolores.sqlite`. Cuando el sitio corre con `npm start`, el catalogo intenta leer primero `/api/products`; si no hay servidor, mantiene el respaldo de Google Sheets y productos provisionales.

Funciones actuales del admin:

- Crear y editar productos.
- Ocultar o activar productos.
- Subir imagenes JPG, PNG, WebP o GIF hasta 3MB, con eliminacion automatica de fondo blanco para JPG, PNG y WebP.
- Procesar links de imagen para descargarlos, quitar fondo blanco y guardar una copia local.
- Detectar un color dominante de la imagen y usarlo como color automatico de la tarjeta en el catalogo.
- Filtrar inventario por busqueda, categoria, activos, ocultos y bajo stock.
- Importar productos desde CSV simple.
- Guardar un link CSV externo y sincronizar productos desde ese link.
- Exportar inventario a CSV.

### Sincronizar productos desde un link CSV

El cliente puede mantener los productos en Google Sheets u otro CSV publico. El servidor descarga ese CSV, crea o actualiza productos en `data/decolores.sqlite`, y el catalogo publico los lee desde `/api/products`.

Columnas recomendadas:

```csv
id,nombre,categoria,marca,precio,precio anterior,stock,imagen,color,descripcion,estado,destacado,activo
```

Tambien acepta nombres comunes como `producto`, `detalle`, `pvp`, `existencia`, `foto`, `visible`, `popular`, `accent` y `acento`.

Opciones de configuracion:

- Desde el admin: entra a `/admin`, pega el link en `Link CSV automatico`, guarda y pulsa `Sincronizar ahora`.
- Desde produccion: define `PRODUCT_CSV_URL` con el link del CSV.
- Para sincronizar al iniciar el servidor: `PRODUCT_CSV_SYNC_ON_START=1`.
- Para sincronizar cada cierto tiempo: `PRODUCT_CSV_SYNC_INTERVAL_MINUTES=30` o el intervalo que prefieras.

Para Google Sheets, comparte la hoja como publica o publicada en la web. Puedes pegar el link normal de la hoja; el servidor lo convierte al formato CSV cuando detecta `docs.google.com/spreadsheets`.

### Imagenes de productos

Al subir una imagen desde el admin, la opcion `Quitar fondo blanco automaticamente al subir` viene activada. El servidor detecta el fondo blanco conectado a los bordes de la foto, lo convierte en transparencia y guarda el resultado como PNG.

Si pegas un link en el campo `Imagen`, usa `Procesar link de imagen`. El servidor descarga la imagen, aplica el mismo tratamiento y reemplaza el link por una copia local en `uploads/products`.

El servidor tambien extrae un color dominante de la imagen y llena `Color catalogo`. Ese color se guarda con el producto y el catalogo lo usa como acento visual de la tarjeta. Si una imagen no devuelve un color claro, el catalogo mantiene el color por categoria.

Si el producto es blanco o el fondo forma parte de la foto, desactiva esa opcion antes de subirla.

Variables opcionales:

- `UPLOAD_REMOVE_WHITE_BG=0` desactiva la eliminacion automatica por defecto.
- `UPLOAD_WHITE_BG_THRESHOLD=245` ajusta que tan blanco debe ser el fondo.
- `UPLOAD_WHITE_BG_TOLERANCE=24` ajusta cuanta variacion de tono acepta el detector.

### Publicar

La parte publica puede publicarse como sitio estatico. Para usar el panel admin necesitas publicar el servidor Node (`npm start`) en un VPS, NAS, Render, Railway, Fly.io u otro hosting que ejecute Node 24+.

### Configuración

Los datos editables principales están en `scripts/config.js`:

- Nombre de marca.
- Colores principales.
- WhatsApp.
- Teléfono.
- Email.
- Categorías.
- Productos destacados provisionales.

Reemplazar `https://papeleriadecolores.com` en `index.html`, `catalogo-productos.html`, `robots.txt` y `sitemap.xml` cuando el dominio real esté confirmado.
