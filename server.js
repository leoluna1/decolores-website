const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads', 'products');
const DB_PATH = path.join(DATA_DIR, 'decolores.sqlite');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'decolores_admin';
const PRODUCT_CSV_URL = clean(process.env.PRODUCT_CSV_URL, 1000);
const PRODUCT_CSV_SYNC_ON_START = process.env.PRODUCT_CSV_SYNC_ON_START === '1';
const PRODUCT_CSV_SYNC_INTERVAL_MINUTES = Number(process.env.PRODUCT_CSV_SYNC_INTERVAL_MINUTES || 0);
const UPLOAD_REMOVE_WHITE_BG = process.env.UPLOAD_REMOVE_WHITE_BG !== '0';
const UPLOAD_WHITE_BG_THRESHOLD = clampNumber(process.env.UPLOAD_WHITE_BG_THRESHOLD, 220, 255, 245);
const UPLOAD_WHITE_BG_TOLERANCE = clampNumber(process.env.UPLOAD_WHITE_BG_TOLERANCE, 0, 80, 24);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!process.env.ADMIN_PASSWORD) {
    console.warn('Admin usando clave local por defecto: admin123. Define ADMIN_PASSWORD en produccion.');
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!safeImageExtension(file)) return cb(new Error('Solo se permiten imagenes JPG, PNG, WebP o GIF.'));
        cb(null, true);
    }
});

const db = new DatabaseSync(DB_PATH);
db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'papeleria',
        brand TEXT NOT NULL DEFAULT 'De Colores',
        price REAL NOT NULL DEFAULT 0,
        old_price REAL,
        description TEXT NOT NULL DEFAULT '',
        stock INTEGER NOT NULL DEFAULT 0,
        image TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Disponible',
        popular INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

const count = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
if (count === 0) seedProducts();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.get('/api/session', (req, res) => {
    const session = readSession(req);
    res.json({ authenticated: Boolean(session), user: session?.user || null });
});

app.post('/api/login', (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const token = signSession({ user: username, exp: Date.now() + 1000 * 60 * 60 * 8 });
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}`);
    res.json({ ok: true, user: username });
});

app.post('/api/logout', requireAdmin, (req, res) => {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ ok: true });
});

app.get('/api/products', requireAdminOptional, (req, res) => {
    const includeInactive = req.admin && req.query.includeInactive === '1';
    const products = listProducts({ includeInactive });
    res.json({ products });
});

app.get('/api/products/public', (req, res) => {
    res.json({ products: listProducts({ includeInactive: false }) });
});

app.post('/api/products', requireAdmin, (req, res) => {
    const product = normalizeProduct(req.body);
    product.id = uniqueId(product.id || slugify(product.name));
    insertProduct(product);
    res.status(201).json({ product: getProduct(product.id) });
});

app.put('/api/products/:id', requireAdmin, (req, res) => {
    const existing = getProduct(req.params.id, true);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado.' });

    const product = normalizeProduct({ ...existing, ...req.body, id: existing.id });
    updateProduct(product);
    res.json({ product: getProduct(product.id, true) });
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
    const existing = getProduct(req.params.id, true);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado.' });

    db.prepare('UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

app.post('/api/products/import', requireAdmin, (req, res) => {
    const rows = Array.isArray(req.body.products) ? req.body.products : [];
    res.json(importProducts(rows));
});

app.get('/api/products/csv-source', requireAdmin, (req, res) => {
    res.json({
        url: getCsvSourceUrl(),
        envUrlConfigured: Boolean(PRODUCT_CSV_URL),
        lastSync: getSetting('product_csv_last_sync'),
        lastSyncSummary: getSetting('product_csv_last_summary')
    });
});

app.post('/api/products/csv-source', requireAdmin, (req, res) => {
    const url = clean(req.body.url, 1000);
    if (url && !isAllowedCsvUrl(url)) return res.status(400).json({ error: 'Ingresa un link CSV valido http/https.' });

    setSetting('product_csv_url', url);
    res.json({ ok: true, url: getCsvSourceUrl() });
});

app.post('/api/products/sync-csv', requireAdmin, async (req, res) => {
    try {
        if (req.body.url !== undefined) {
            const url = clean(req.body.url, 1000);
            if (url && !isAllowedCsvUrl(url)) return res.status(400).json({ error: 'Ingresa un link CSV valido http/https.' });
            setSetting('product_csv_url', url);
        }

        const result = await syncProductsFromCsv();
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/uploads/products', requireAdmin, (req, res) => {
    upload.single('image')(req, res, async error => {
        if (error) return res.status(400).json({ error: error.message });
        if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen.' });

        try {
            const result = await saveUploadedProductImage(req.file, {
                removeWhiteBackground: UPLOAD_REMOVE_WHITE_BG && req.body.removeBackground !== '0'
            });
            res.status(201).json(result);
        } catch (saveError) {
            res.status(400).json({ error: saveError.message });
        }
    });
});

const PRIVATE_PATH_RE = /^\/(?:server\.js|package(?:-lock)?\.json|README\.md|data\/|node_modules\/|\.env)/i;

app.use((req, res, next) => {
    if (PRIVATE_PATH_RE.test(req.path)) return res.status(404).send('Not found');
    next();
});
app.use('/uploads', express.static(path.join(ROOT, 'uploads'), {
    fallthrough: false,
    setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
}));
app.use('/admin', express.static(path.join(ROOT, 'admin'), { extensions: ['html'] }));
app.use(express.static(ROOT, { extensions: ['html'] }));

app.listen(PORT, () => {
    console.log(`Papeleria De Colores: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
    scheduleCsvSync();
});

function requireAdmin(req, res, next) {
    const session = readSession(req);
    if (!session) return res.status(401).json({ error: 'No autorizado.' });
    req.admin = session;
    next();
}

function requireAdminOptional(req, res, next) {
    req.admin = readSession(req);
    next();
}

function readSession(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[SESSION_COOKIE];
    if (!token) return null;

    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = hmac(payload);
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!session.exp || session.exp < Date.now()) return null;
        return session;
    } catch {
        return null;
    }
}

function signSession(session) {
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
    return `${payload}.${hmac(payload)}`;
}

function hmac(value) {
    return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function parseCookies(header) {
    return Object.fromEntries(header.split(';').filter(Boolean).map(part => {
        const index = part.indexOf('=');
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
    }));
}

function listProducts({ includeInactive = false } = {}) {
    const sql = includeInactive
        ? 'SELECT * FROM products ORDER BY updated_at DESC, name ASC'
        : 'SELECT * FROM products WHERE active = 1 ORDER BY popular DESC, updated_at DESC, name ASC';
    return db.prepare(sql).all().map(toClientProduct);
}

function getProduct(id, includeInactive = false) {
    const row = includeInactive
        ? db.prepare('SELECT * FROM products WHERE id = ?').get(id)
        : db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id);
    return row ? toClientProduct(row) : null;
}

function insertProduct(product) {
    db.prepare(`
        INSERT INTO products (id, name, category, brand, price, old_price, description, stock, image, status, popular, active)
        VALUES (@id, @name, @category, @brand, @price, @oldPrice, @description, @stock, @image, @status, @popular, @active)
    `).run(product);
}

function updateProduct(product) {
    db.prepare(`
        UPDATE products
        SET name = @name,
            category = @category,
            brand = @brand,
            price = @price,
            old_price = @oldPrice,
            description = @description,
            stock = @stock,
            image = @image,
            status = @status,
            popular = @popular,
            active = @active,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
    `).run(product);
}

function importProducts(rows) {
    let created = 0;
    let updated = 0;
    const errors = [];

    withTransaction(() => {
        rows.forEach((raw, index) => {
            try {
                const product = normalizeProduct(raw);
                product.id = uniqueId(product.id || slugify(product.name), { allowExisting: true });
                if (getProduct(product.id, true)) {
                    updateProduct(product);
                    updated += 1;
                } else {
                    insertProduct(product);
                    created += 1;
                }
            } catch (error) {
                errors.push({ row: index + 1, message: error.message });
            }
        });
    });

    return { created, updated, errors };
}

async function syncProductsFromCsv() {
    const url = getCsvSourceUrl();
    if (!url) throw new Error('Configura primero el link CSV de productos.');
    if (!isAllowedCsvUrl(url)) throw new Error('El link CSV configurado no es valido.');

    const csvUrl = normalizeCsvUrl(url);
    const response = await fetch(csvUrl, {
        headers: {
            Accept: 'text/csv,text/plain,*/*',
            'User-Agent': 'decolores-product-sync/1.0'
        }
    });

    if (!response.ok) throw new Error(`No se pudo descargar el CSV. HTTP ${response.status}.`);

    const csvText = await response.text();
    const products = parseCsvProducts(csvText);
    if (!products.length) throw new Error('El CSV no contiene productos validos.');

    const result = importProducts(products);
    const syncedAt = new Date().toISOString();
    const summary = `CSV sincronizado. Filas validas: ${products.length}. Creados: ${result.created}. Actualizados: ${result.updated}. Errores: ${result.errors.length}.`;
    setSetting('product_csv_last_sync', syncedAt);
    setSetting('product_csv_last_summary', summary);

    return { ...result, rows: products.length, syncedAt, url: maskUrlForClient(url), summary };
}

function parseCsvProducts(csvText) {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) return [];

    const header = buildCsvHeader(rows[0]);
    const dataRows = header.hasHeader ? rows.slice(1) : rows;

    return dataRows
        .map((cols, index) => csvRowToProduct(cols, header.index, index))
        .filter(Boolean);
}

function parseCsvRows(csvText) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < String(csvText || '').length; i += 1) {
        const char = csvText[i];
        const next = csvText[i + 1];

        if (char === '"') {
            if (quoted && next === '"') {
                cell += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
        } else if (char === ',' && !quoted) {
            row.push(cell);
            cell = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && next === '\n') i += 1;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }

    row.push(cell);
    rows.push(row);
    return rows
        .map(csvRow => csvRow.map(value => cleanCsvCell(value)))
        .filter(csvRow => csvRow.some(Boolean));
}

function buildCsvHeader(firstRow) {
    const normalized = firstRow.map(normalizeHeader);
    const find = (...names) => {
        const targets = names.map(normalizeHeader);
        return normalized.findIndex(header => targets.includes(header));
    };
    const findLast = (...names) => {
        const targets = names.map(normalizeHeader);
        for (let i = normalized.length - 1; i >= 0; i -= 1) {
            if (targets.includes(normalized[i])) return i;
        }
        return -1;
    };

    const index = {
        id: find('id', 'codigo', 'código', 'sku'),
        name: find('nombre', 'producto', 'detalle', 'item', 'articulo', 'artículo'),
        category: find('categoria', 'categoría', 'familia', 'linea', 'línea'),
        brand: find('marca', 'proveedor'),
        price: findLast('precio', 'pvp', 'p.v.p.', 'valor', 'precio venta', 'pvp sug uni'),
        oldPrice: find('precio anterior', 'precio_anterior', 'oldprice', 'old price'),
        stock: find('stock', 'existencia', 'inventario', 'cantidad', 'adquisicion', 'adquisición'),
        image: find('imagen', 'foto', 'image', 'url imagen', 'url_imagen'),
        description: find('descripcion', 'descripción', 'resumen'),
        status: find('estado', 'status'),
        popular: find('destacado', 'popular'),
        active: find('activo', 'visible', 'publicado')
    };

    const hasHeader = index.name >= 0 && index.price >= 0;
    if (hasHeader) return { hasHeader, index };

    return {
        hasHeader: false,
        index: {
            name: 0,
            category: 1,
            brand: 2,
            price: 3,
            stock: 4,
            image: 5,
            description: 6,
            id: -1,
            oldPrice: -1,
            status: -1,
            popular: -1,
            active: -1
        }
    };
}

function csvRowToProduct(cols, index, rowIndex) {
    const get = key => index[key] >= 0 ? cols[index[key]] : '';
    const name = clean(get('name'), 120);
    const price = parseCsvNumber(get('price'));
    if (!name || price == null) return null;

    const category = normalizeCategory(get('category') || inferCategory(name));
    const stock = parseCsvInteger(get('stock'));

    return {
        id: clean(get('id'), 80) || slugify(name) || `csv-${rowIndex + 1}`,
        name,
        category,
        brand: clean(get('brand'), 80) || 'De Colores',
        price,
        oldPrice: parseCsvNumber(get('oldPrice')),
        stock: stock == null ? 1 : stock,
        image: clean(get('image'), 220) || categoryImage(category),
        description: clean(get('description'), 280) || 'Producto disponible para consultar en tienda.',
        status: clean(get('status'), 40) || (stock === 0 ? 'Agotado' : 'Disponible'),
        popular: get('popular') ? truthy(get('popular')) : rowIndex < 12,
        active: get('active') ? truthy(get('active')) : true
    };
}

function cleanCsvCell(value) {
    return String(value || '').replace(/^\uFEFF/, '').trim();
}

function normalizeHeader(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function parseCsvNumber(value) {
    const text = cleanCsvCell(value);
    if (!text) return null;
    const normalized = text
        .replace(/\s+/g, '')
        .replace(/\$/g, '')
        .replace(/,/g, '.')
        .replace(/[^\d.-]/g, '');
    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseCsvInteger(value) {
    const number = parseCsvNumber(value);
    return number == null ? null : Math.max(0, Math.trunc(number));
}

function inferCategory(name) {
    const text = slugify(name);
    const groups = [
        ['tecnologia', ['calculadora', 'usb', 'mouse', 'cable', 'audifono', 'parlante', 'teclado']],
        ['arte', ['pintura', 'acuarela', 'pincel', 'tempera', 'crayon', 'color', 'marcador', 'plastilina']],
        ['escolares', ['cuaderno', 'lapiz', 'lapices', 'mochila', 'cartuchera', 'regla', 'compas', 'borrador']],
        ['oficina', ['archivador', 'carpeta', 'folder', 'grapa', 'grapadora', 'clip', 'perforadora', 'papel-bond']],
        ['libros', ['libro', 'cuento', 'diccionario', 'atlas']],
        ['regalos', ['adorno', 'regalo', 'navidad', 'globo', 'cinta', 'decoracion']]
    ];
    const match = groups.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)));
    return match ? match[0] : 'papeleria';
}

function getCsvSourceUrl() {
    return PRODUCT_CSV_URL || getSetting('product_csv_url');
}

function getSetting(key) {
    return db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value || '';
}

function setSetting(key, value) {
    db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, String(value || ''));
}

function isAllowedCsvUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function normalizeCsvUrl(url) {
    const parsed = new URL(url);
    const sheetMatch = parsed.hostname === 'docs.google.com' && parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!sheetMatch) return url;

    const gidFromHash = parsed.hash.match(/gid=(\d+)/)?.[1];
    const gid = parsed.searchParams.get('gid') || gidFromHash || '0';
    return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv&gid=${gid}`;
}

function maskUrlForClient(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return '';
    }
}

function scheduleCsvSync() {
    if (PRODUCT_CSV_SYNC_ON_START && getCsvSourceUrl()) {
        syncProductsFromCsv().then(result => {
            console.log(`[CSV] ${result.summary}`);
        }).catch(error => {
            console.warn(`[CSV] ${error.message}`);
        });
    }

    if (Number.isFinite(PRODUCT_CSV_SYNC_INTERVAL_MINUTES) && PRODUCT_CSV_SYNC_INTERVAL_MINUTES > 0) {
        const intervalMs = PRODUCT_CSV_SYNC_INTERVAL_MINUTES * 60 * 1000;
        setInterval(() => {
            if (!getCsvSourceUrl()) return;
            syncProductsFromCsv().then(result => {
                console.log(`[CSV] ${result.summary}`);
            }).catch(error => {
                console.warn(`[CSV] ${error.message}`);
            });
        }, intervalMs).unref();
    }
}

function normalizeProduct(input) {
    const name = clean(input.name, 120);
    if (!name) throw new Error('El nombre es obligatorio.');

    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) throw new Error(`Precio invalido para ${name}.`);

    const oldPrice = input.oldPrice === '' || input.oldPrice == null ? null : Number(input.oldPrice);
    const stock = Math.max(0, Number.parseInt(input.stock || 0, 10));

    return {
        id: clean(input.id, 80),
        name,
        category: normalizeCategory(input.category),
        brand: clean(input.brand, 80) || 'De Colores',
        price,
        oldPrice: Number.isFinite(oldPrice) ? oldPrice : null,
        description: clean(input.description, 280) || 'Producto disponible para consultar en tienda.',
        stock: Number.isFinite(stock) ? stock : 0,
        image: clean(input.image, 220) || categoryImage(normalizeCategory(input.category)),
        status: clean(input.status, 40) || (stock > 0 ? 'Disponible' : 'Agotado'),
        popular: truthy(input.popular) ? 1 : 0,
        active: input.active === undefined ? 1 : (truthy(input.active) ? 1 : 0)
    };
}

function toClientProduct(row) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        brand: row.brand,
        price: Number(row.price),
        oldPrice: row.old_price == null ? null : Number(row.old_price),
        description: row.description,
        stock: Number(row.stock),
        image: row.image,
        status: row.status,
        popular: Boolean(row.popular),
        active: Boolean(row.active),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function clean(value, max = 280) {
    return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function normalizeCategory(value) {
    const raw = slugify(value || 'papeleria');
    const map = {
        escolar: 'escolares',
        utiles: 'escolares',
        utilesescolares: 'escolares',
        oficina: 'oficina',
        arte: 'arte',
        manualidades: 'arte',
        papeleria: 'papeleria',
        tecnologia: 'tecnologia',
        libros: 'libros',
        lectura: 'libros',
        regalos: 'regalos',
        decoracion: 'regalos',
        impresion: 'impresion',
        accesorios: 'accesorios'
    };
    return map[raw] || raw || 'papeleria';
}

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function uniqueId(base, options = {}) {
    let id = slugify(base) || crypto.randomUUID().slice(0, 8);
    if (options.allowExisting) return id;
    let next = id;
    let index = 2;
    while (getProduct(next, true)) {
        next = `${id}-${index}`;
        index += 1;
    }
    return next;
}

function truthy(value) {
    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'si';
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

async function saveUploadedProductImage(file, options = {}) {
    const originalExt = safeImageExtension(file);
    if (!originalExt || !file.buffer) throw new Error('Imagen invalida.');

    let buffer = file.buffer;
    let extension = originalExt;
    let backgroundRemoved = false;
    let removedPixels = 0;

    if (options.removeWhiteBackground && file.mimetype !== 'image/gif') {
        const result = await removeWhiteConnectedBackground(file.buffer);
        if (result.removedPixels > 0) {
            buffer = result.buffer;
            extension = '.png';
            backgroundRemoved = true;
            removedPixels = result.removedPixels;
        }
    }

    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buffer);

    return {
        path: `uploads/products/${filename}`,
        filename,
        size: buffer.length,
        backgroundRemoved,
        removedPixels
    };
}

async function removeWhiteConnectedBackground(inputBuffer) {
    const image = sharp(inputBuffer, { limitInputPixels: 25000000 }).rotate().ensureAlpha();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const pixelCount = width * height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Uint32Array(pixelCount);
    let head = 0;
    let tail = 0;

    const isWhiteCandidate = pixel => {
        const offset = pixel * channels;
        const alpha = data[offset + 3];
        if (alpha <= 12) return false;

        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        return red >= UPLOAD_WHITE_BG_THRESHOLD
            && green >= UPLOAD_WHITE_BG_THRESHOLD
            && blue >= UPLOAD_WHITE_BG_THRESHOLD
            && max - min <= UPLOAD_WHITE_BG_TOLERANCE;
    };

    const enqueue = pixel => {
        if (visited[pixel] || !isWhiteCandidate(pixel)) return;
        visited[pixel] = 1;
        queue[tail] = pixel;
        tail += 1;
    };

    for (let x = 0; x < width; x += 1) {
        enqueue(x);
        enqueue((height - 1) * width + x);
    }

    for (let y = 1; y < height - 1; y += 1) {
        enqueue(y * width);
        enqueue(y * width + width - 1);
    }

    let removedPixels = 0;
    while (head < tail) {
        const pixel = queue[head];
        head += 1;

        const offset = pixel * channels;
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
        removedPixels += 1;

        const x = pixel % width;
        if (pixel >= width) enqueue(pixel - width);
        if (pixel < pixelCount - width) enqueue(pixel + width);
        if (x > 0) enqueue(pixel - 1);
        if (x < width - 1) enqueue(pixel + 1);
    }

    if (removedPixels === 0 || removedPixels === pixelCount) return { buffer: inputBuffer, removedPixels: 0 };

    const png = await sharp(data, {
        raw: { width, height, channels }
    })
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
        .png({ compressionLevel: 9 })
        .toBuffer();

    return { buffer: png, removedPixels };
}

function safeImageExtension(file) {
    const allowed = new Map([
        ['image/jpeg', '.jpg'],
        ['image/png', '.png'],
        ['image/webp', '.webp'],
        ['image/gif', '.gif']
    ]);
    const ext = allowed.get(file.mimetype);
    if (!ext) return '';

    const original = path.extname(file.originalname || '').toLowerCase();
    if (original && ![...allowed.values(), '.jpeg'].includes(original)) return '';
    return ext;
}

function categoryImage(category) {
    const images = {
        escolares: 'images/materiales/mochila-escolar-con-suministros-de-estudiantes.jpg',
        oficina: 'images/materiales/49-Archivador-Artesco-2.png',
        arte: 'images/materiales/colores.png',
        papeleria: 'images/materiales/papel bond.png',
        tecnologia: 'images/tecnologia/calculadora-cs-bols-hl-4a-neg.png',
        libros: 'images/materiales/libreta.png',
        regalos: 'images/materiales/cartuchera.jpg',
        impresion: 'images/materiales/papel bond.png',
        accesorios: 'images/materiales/cartuchera.jpg'
    };
    return images[category] || images.papeleria;
}

function seedProducts() {
    const products = [
        {
            id: 'kit-regreso-clases',
            name: 'Kit regreso a clases',
            category: 'escolares',
            brand: 'De Colores',
            price: 24.9,
            oldPrice: 31.5,
            description: 'Seleccion de basicos escolares para iniciar el ciclo con orden.',
            stock: 12,
            image: 'images/materiales/mochila-escolar-con-suministros-de-estudiantes.jpg',
            status: 'Oferta',
            popular: 1,
            active: 1
        },
        {
            id: 'set-colores-premium',
            name: 'Set de color premium',
            category: 'arte',
            brand: 'De Colores',
            price: 8.75,
            oldPrice: null,
            description: 'Colores intensos para tareas, lettering y proyectos creativos.',
            stock: 18,
            image: 'images/materiales/colores.png',
            status: 'Nuevo',
            popular: 1,
            active: 1
        },
        {
            id: 'archivador-ejecutivo',
            name: 'Archivador ejecutivo',
            category: 'oficina',
            brand: 'Artesco',
            price: 5.5,
            oldPrice: 6.75,
            description: 'Organiza documentos de trabajo, estudio o tramites personales.',
            stock: 9,
            image: 'images/materiales/49-Archivador-Artesco-2.png',
            status: 'Oferta',
            popular: 1,
            active: 1
        },
        {
            id: 'calculadora-escolar',
            name: 'Calculadora escolar',
            category: 'tecnologia',
            brand: 'Casio',
            price: 11.9,
            oldPrice: null,
            description: 'Practica, liviana y lista para clases de matematica y oficina.',
            stock: 7,
            image: 'images/tecnologia/calculadora-cs-bols-hl-4a-neg.png',
            status: 'Disponible',
            popular: 1,
            active: 1
        }
    ];

    withTransaction(() => products.forEach(insertProduct));
}

function withTransaction(callback) {
    db.exec('BEGIN');
    try {
        callback();
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
