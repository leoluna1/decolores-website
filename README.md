# decolores-website
## Papelería De Colores

Sitio estático para una papelería con home comercial, catálogo filtrable y lista de pedido por WhatsApp.

### Ejecutar en local

```bash
python3 -m http.server 3002
```

Abrir `http://localhost:3002`.

### Publicar

Al ser HTML, CSS y JavaScript estático, puede publicarse en GitHub Pages, Cloudflare Pages, cPanel, NAS o cualquier hosting estático.

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
