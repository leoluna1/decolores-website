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
- Subir imagenes JPG, PNG, WebP o GIF hasta 3MB.
- Filtrar inventario por busqueda, categoria, activos, ocultos y bajo stock.
- Importar productos desde CSV simple.
- Exportar inventario a CSV.

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
