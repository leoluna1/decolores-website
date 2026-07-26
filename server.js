const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
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

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!process.env.ADMIN_PASSWORD) {
    console.warn('Admin usando clave local por defecto: admin123. Define ADMIN_PASSWORD en produccion.');
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOAD_DIR),
        filename: (req, file, cb) => {
            const ext = safeImageExtension(file);
            cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
        }
    }),
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

    res.json({ created, updated, errors });
});

app.post('/api/uploads/products', requireAdmin, (req, res) => {
    upload.single('image')(req, res, error => {
        if (error) return res.status(400).json({ error: error.message });
        if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen.' });

        res.status(201).json({
            path: `uploads/products/${req.file.filename}`,
            filename: req.file.filename,
            size: req.file.size
        });
    });
});

app.use('/data', (req, res) => res.status(404).send('Not found'));
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
