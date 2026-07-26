const state = {
    products: [],
    editingId: null,
    search: '',
    category: 'all',
    active: 'all'
};

const nodes = {
    loginView: document.querySelector('[data-login-view]'),
    dashboard: document.querySelector('[data-dashboard]'),
    loginForm: document.querySelector('[data-login-form]'),
    loginMessage: document.querySelector('[data-login-message]'),
    productForm: document.querySelector('[data-product-form]'),
    productMessage: document.querySelector('[data-product-message]'),
    formTitle: document.querySelector('[data-form-title]'),
    table: document.querySelector('[data-products-table]'),
    search: document.querySelector('[data-search]'),
    categoryFilter: document.querySelector('[data-category-filter]'),
    activeFilter: document.querySelector('[data-active-filter]'),
    importText: document.querySelector('[data-import-text]'),
    importMessage: document.querySelector('[data-import-message]'),
    imageFile: document.querySelector('[data-image-file]'),
    imagePreview: document.querySelector('[data-image-preview]')
};

boot();

async function boot() {
    bindEvents();
    const session = await api('/api/session');
    if (session.authenticated) showDashboard();
}

function bindEvents() {
    nodes.loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        setMessage(nodes.loginMessage, 'Verificando...');
        const data = Object.fromEntries(new FormData(nodes.loginForm));
        try {
            await api('/api/login', { method: 'POST', body: data });
            nodes.loginForm.reset();
            showDashboard();
        } catch (error) {
            setMessage(nodes.loginMessage, error.message, true);
        }
    });

    document.querySelector('[data-logout]').addEventListener('click', async () => {
        await api('/api/logout', { method: 'POST' });
        nodes.dashboard.hidden = true;
        nodes.loginView.hidden = false;
    });

    nodes.productForm.addEventListener('submit', async event => {
        event.preventDefault();
        const product = formProduct();
        const isEditing = Boolean(state.editingId);
        const url = isEditing ? `/api/products/${encodeURIComponent(state.editingId)}` : '/api/products';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            await api(url, { method, body: product });
            setMessage(nodes.productMessage, isEditing ? 'Producto actualizado.' : 'Producto creado.');
            resetForm();
            await loadProducts();
        } catch (error) {
            setMessage(nodes.productMessage, error.message, true);
        }
    });

    document.querySelector('[data-reset-form]').addEventListener('click', resetForm);

    nodes.search.addEventListener('input', event => {
        state.search = event.target.value.trim().toLowerCase();
        renderProducts();
    });

    nodes.categoryFilter.addEventListener('change', event => {
        state.category = event.target.value;
        renderProducts();
    });

    nodes.activeFilter.addEventListener('change', event => {
        state.active = event.target.value;
        renderProducts();
    });

    nodes.productForm.image.addEventListener('input', () => updateImagePreview(nodes.productForm.image.value));
    nodes.imageFile.addEventListener('change', uploadImage);
    document.querySelector('[data-export-csv]').addEventListener('click', exportCsv);

    document.querySelector('[data-import]').addEventListener('click', async () => {
        const products = parseImport(nodes.importText.value);
        if (!products.length) {
            setMessage(nodes.importMessage, 'No hay filas validas para importar.', true);
            return;
        }

        try {
            const result = await api('/api/products/import', { method: 'POST', body: { products } });
            setMessage(nodes.importMessage, `Importacion lista. Creados: ${result.created}. Actualizados: ${result.updated}. Errores: ${result.errors.length}.`, result.errors.length > 0);
            nodes.importText.value = '';
            await loadProducts();
        } catch (error) {
            setMessage(nodes.importMessage, error.message, true);
        }
    });
}

async function showDashboard() {
    nodes.loginView.hidden = true;
    nodes.dashboard.hidden = false;
    await loadProducts();
}

async function loadProducts() {
    const data = await api('/api/products?includeInactive=1');
    state.products = data.products;
    renderStats();
    renderProducts();
}

function renderStats() {
    const active = state.products.filter(product => product.active);
    document.querySelector('[data-stat-total]').textContent = state.products.length;
    document.querySelector('[data-stat-active]').textContent = active.length;
    document.querySelector('[data-stat-low]').textContent = active.filter(product => product.stock <= 3).length;
    document.querySelector('[data-stat-offer]').textContent = active.filter(product => /oferta/i.test(product.status)).length;
}

function renderProducts() {
    const products = state.products.filter(product => {
        const matchesSearch = !state.search ||
            [product.name, product.category, product.brand, product.status].some(value => String(value).toLowerCase().includes(state.search));
        const matchesCategory = state.category === 'all' || product.category === state.category;
        const matchesActive = state.active === 'all' ||
            (state.active === 'active' && product.active) ||
            (state.active === 'hidden' && !product.active) ||
            (state.active === 'low' && product.active && product.stock <= 3);

        return matchesSearch && matchesCategory && matchesActive;
    });

    nodes.table.replaceChildren(...products.map(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><img class="thumb" alt=""></td>
            <td><strong></strong><small></small></td>
            <td></td>
            <td></td>
            <td></td>
            <td><span class="status-pill"></span></td>
            <td>
                <div class="row-actions">
                    <button type="button" data-edit>Editar</button>
                    <button class="danger" type="button" data-toggle></button>
                </div>
            </td>
        `;

        const thumb = row.querySelector('.thumb');
        thumb.src = assetUrl(product.image || 'images/materiales/colores.png');
        thumb.alt = product.name;
        thumb.onerror = () => {
            thumb.src = '../images/materiales/colores.png';
        };
        row.querySelector('strong').textContent = product.name;
        row.querySelector('small').textContent = product.brand || 'Sin marca';
        row.children[2].textContent = product.category;
        row.children[3].textContent = money(product.price);
        row.children[4].textContent = String(product.stock);
        row.children[4].classList.toggle('stock-low', product.active && product.stock <= 3);
        row.querySelector('.status-pill').textContent = product.active ? product.status : 'Oculto';
        row.querySelector('[data-edit]').addEventListener('click', () => editProduct(product));
        const toggle = row.querySelector('[data-toggle]');
        toggle.textContent = product.active ? 'Ocultar' : 'Activar';
        toggle.addEventListener('click', () => toggleProduct(product));
        return row;
    }));
}

function editProduct(product) {
    state.editingId = product.id;
    nodes.formTitle.textContent = 'Editar producto';
    const form = nodes.productForm;
    form.id.value = product.id;
    form.name.value = product.name;
    form.category.value = product.category;
    form.brand.value = product.brand;
    form.price.value = product.price;
    form.oldPrice.value = product.oldPrice || '';
    form.stock.value = product.stock;
    form.status.value = product.status || 'Disponible';
    form.image.value = product.image || '';
    form.description.value = product.description || '';
    form.popular.checked = Boolean(product.popular);
    form.active.checked = Boolean(product.active);
    updateImagePreview(product.image);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function toggleProduct(product) {
    const nextActive = !product.active;
    const action = nextActive ? 'activar' : 'ocultar';
    if (!confirm(`Quieres ${action} "${product.name}"?`)) return;

    await api(`/api/products/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        body: { ...product, active: nextActive }
    });
    await loadProducts();
}

function resetForm() {
    state.editingId = null;
    nodes.formTitle.textContent = 'Agregar producto';
    nodes.productForm.reset();
    nodes.productForm.brand.value = 'De Colores';
    nodes.productForm.stock.value = 1;
    nodes.productForm.active.checked = true;
    nodes.imageFile.value = '';
    updateImagePreview('');
}

function formProduct() {
    const form = nodes.productForm;
    return {
        id: form.id.value,
        name: form.name.value,
        category: form.category.value,
        brand: form.brand.value,
        price: form.price.value,
        oldPrice: form.oldPrice.value,
        stock: form.stock.value,
        status: form.status.value,
        image: form.image.value,
        description: form.description.value,
        popular: form.popular.checked,
        active: form.active.checked
    };
}

async function uploadImage() {
    const file = nodes.imageFile.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    setMessage(nodes.productMessage, 'Subiendo imagen...');

    try {
        const response = await fetch('/api/uploads/products', {
            method: 'POST',
            body: formData
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo subir la imagen.');
        nodes.productForm.image.value = data.path;
        updateImagePreview(data.path);
        setMessage(nodes.productMessage, 'Imagen subida. Guarda el producto para aplicar el cambio.');
    } catch (error) {
        setMessage(nodes.productMessage, error.message, true);
        nodes.imageFile.value = '';
    }
}

function updateImagePreview(src) {
    const image = nodes.imagePreview.querySelector('img');
    const caption = nodes.imagePreview.querySelector('figcaption');
    const value = String(src || '').trim();
    nodes.imagePreview.classList.toggle('has-image', Boolean(value));
    image.src = value ? assetUrl(value) : '';
    caption.textContent = value ? value : 'Vista previa de imagen';
}

function assetUrl(src) {
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    if (src.startsWith('../')) return src;
    return `../${src}`;
}

function exportCsv() {
    const headers = ['id', 'name', 'category', 'brand', 'price', 'oldPrice', 'stock', 'status', 'active', 'popular', 'image', 'description'];
    const rows = state.products.map(product => headers.map(header => csvCell(product[header])).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `productos-de-colores-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function parseImport(text) {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => splitCsvLine(line))
        .filter(cols => cols[0] && cols[3])
        .map(cols => ({
            name: cols[0],
            category: cols[1] || 'papeleria',
            brand: cols[2] || 'De Colores',
            price: cols[3],
            stock: cols[4] || 0,
            image: cols[5] || '',
            description: cols[6] || ''
        }));
}

function splitCsvLine(line) {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') quoted = !quoted;
        else if (char === ',' && !quoted) {
            cells.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    cells.push(current.trim());
    return cells;
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Ocurrio un error.');
    return data;
}

function setMessage(node, message, isError = false) {
    node.textContent = message;
    node.classList.toggle('is-error', isError);
}

function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}
