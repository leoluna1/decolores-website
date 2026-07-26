const state = {
    products: [],
    editingId: null,
    search: '',
    category: 'all',
    active: 'all',
    sort: 'updated'
};

const CATEGORY_LABELS = {
    escolares: 'Escolares',
    oficina: 'Oficina',
    arte: 'Arte',
    papeleria: 'Papeleria',
    tecnologia: 'Tecnologia',
    libros: 'Libros',
    regalos: 'Regalos',
    impresion: 'Impresion',
    accesorios: 'Accesorios'
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
    sortFilter: document.querySelector('[data-sort-filter]'),
    clearFilters: document.querySelector('[data-clear-filters]'),
    quickFilters: document.querySelectorAll('[data-quick-filter]'),
    resultCount: document.querySelector('[data-result-count]'),
    statView: document.querySelector('[data-stat-view]'),
    csvUrl: document.querySelector('[data-csv-url]'),
    csvMessage: document.querySelector('[data-csv-message]'),
    saveCsvUrl: document.querySelector('[data-save-csv-url]'),
    syncCsv: document.querySelector('[data-sync-csv]'),
    importText: document.querySelector('[data-import-text]'),
    importMessage: document.querySelector('[data-import-message]'),
    imageFile: document.querySelector('[data-image-file]'),
    removeBg: document.querySelector('[data-remove-bg]'),
    processImageUrl: document.querySelector('[data-process-image-url]'),
    colorSwatch: document.querySelector('[data-color-swatch]'),
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
        state.search = event.target.value;
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

    nodes.sortFilter.addEventListener('change', event => {
        state.sort = event.target.value;
        renderProducts();
    });

    nodes.clearFilters.addEventListener('click', clearFilters);

    nodes.quickFilters.forEach(button => {
        button.addEventListener('click', () => {
            state.active = button.dataset.quickFilter || 'all';
            nodes.activeFilter.value = state.active;
            renderProducts();
        });
    });

    document.addEventListener('keydown', event => {
        const target = event.target;
        const isTyping = target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement;

        if ((event.key === '/' && !isTyping) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
            event.preventDefault();
            nodes.search.focus();
            nodes.search.select();
        }

        if (event.key === 'Escape' && document.activeElement === nodes.search && nodes.search.value) {
            event.preventDefault();
            nodes.search.value = '';
            state.search = '';
            renderProducts();
        }
    });

    nodes.productForm.image.addEventListener('input', () => updateImagePreview(nodes.productForm.image.value));
    nodes.productForm.color.addEventListener('input', () => updateColorSwatch(nodes.productForm.color.value));
    nodes.imageFile.addEventListener('change', uploadImage);
    nodes.processImageUrl.addEventListener('click', processImageUrl);
    document.querySelector('[data-export-csv]').addEventListener('click', exportCsv);

    nodes.saveCsvUrl.addEventListener('click', saveCsvUrl);
    nodes.syncCsv.addEventListener('click', syncCsvSource);

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
    await loadCsvSource();
    await loadProducts();
}

async function loadCsvSource() {
    try {
        const source = await api('/api/products/csv-source');
        nodes.csvUrl.value = source.url || '';
        if (source.envUrlConfigured) {
            nodes.csvUrl.disabled = true;
            nodes.saveCsvUrl.disabled = true;
            setMessage(nodes.csvMessage, 'Link configurado por variable de entorno en el servidor.');
        } else if (source.lastSyncSummary) {
            setMessage(nodes.csvMessage, `${source.lastSyncSummary} Ultima sincronizacion: ${formatDateTime(source.lastSync)}.`);
        }
    } catch (error) {
        setMessage(nodes.csvMessage, error.message, true);
    }
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

async function saveCsvUrl() {
    setMessage(nodes.csvMessage, 'Guardando link CSV...');
    try {
        const result = await api('/api/products/csv-source', {
            method: 'POST',
            body: { url: nodes.csvUrl.value.trim() }
        });
        nodes.csvUrl.value = result.url || '';
        setMessage(nodes.csvMessage, result.url ? 'Link CSV guardado.' : 'Link CSV eliminado.');
    } catch (error) {
        setMessage(nodes.csvMessage, error.message, true);
    }
}

async function syncCsvSource() {
    setMessage(nodes.csvMessage, 'Sincronizando productos desde CSV...');
    nodes.syncCsv.disabled = true;
    try {
        const result = await api('/api/products/sync-csv', {
            method: 'POST',
            body: { url: nodes.csvUrl.disabled ? undefined : nodes.csvUrl.value.trim() }
        });
        setMessage(nodes.csvMessage, result.summary || `Sincronizacion lista. Creados: ${result.created}. Actualizados: ${result.updated}.`);
        await loadProducts();
    } catch (error) {
        setMessage(nodes.csvMessage, error.message, true);
    } finally {
        nodes.syncCsv.disabled = false;
    }
}

function renderProducts() {
    const products = sortProducts(state.products.filter(product => {
        const terms = searchTerms();
        const matchesSearch = !terms.length || terms.every(term => searchIndex(product).includes(term));
        const matchesCategory = state.category === 'all' || product.category === state.category;
        const matchesActive = state.active === 'all' ||
            (state.active === 'active' && product.active) ||
            (state.active === 'hidden' && !product.active) ||
            (state.active === 'low' && product.active && product.stock <= 3) ||
            (state.active === 'offer' && product.active && /oferta/i.test(product.status)) ||
            (state.active === 'popular' && product.active && product.popular);

        return matchesSearch && matchesCategory && matchesActive;
    }));

    updateInventoryMeta(products.length);
    syncQuickFilters();

    if (!products.length) {
        const row = document.createElement('tr');
        row.className = 'empty-row';
        row.innerHTML = '<td colspan="7">No hay productos con esos filtros.</td>';
        nodes.table.replaceChildren(row);
        return;
    }

    nodes.table.replaceChildren(...products.map(product => {
        const row = document.createElement('tr');
        row.dataset.productId = product.id;
        row.innerHTML = `
            <td><img class="thumb" alt=""></td>
            <td><strong></strong><small></small><span class="product-code"></span><div class="product-tags"></div></td>
            <td></td>
            <td></td>
            <td></td>
            <td><span class="status-pill"></span></td>
            <td>
                <div class="row-actions">
                    <button type="button" data-edit>Editar</button>
                    <button class="soft" type="button" data-duplicate>Duplicar</button>
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
        row.querySelector('.product-code').textContent = product.id ? `Codigo: ${product.id}` : '';
        renderTags(row.querySelector('.product-tags'), product);
        row.children[2].textContent = CATEGORY_LABELS[product.category] || product.category;
        row.children[3].textContent = money(product.price);
        row.children[4].textContent = String(product.stock);
        row.children[4].classList.toggle('stock-low', product.active && product.stock <= 3);
        const pill = row.querySelector('.status-pill');
        pill.textContent = product.active ? product.status : 'Oculto';
        pill.classList.toggle('is-hidden', !product.active);
        pill.classList.toggle('is-offer', product.active && /oferta/i.test(product.status));
        pill.classList.toggle('is-popular', product.active && product.popular && !/oferta/i.test(product.status));
        row.querySelector('[data-edit]').addEventListener('click', () => editProduct(product));
        row.querySelector('[data-duplicate]').addEventListener('click', () => duplicateProduct(product));
        const toggle = row.querySelector('[data-toggle]');
        toggle.textContent = product.active ? 'Ocultar' : 'Activar';
        toggle.addEventListener('click', () => toggleProduct(product));
        return row;
    }));
}

function searchTerms() {
    return normalizeSearch(state.search).split(/\s+/).filter(Boolean);
}

function normalizeSearch(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, ' ')
        .trim();
}

function searchIndex(product) {
    return normalizeSearch([
        product.id,
        product.name,
        product.category,
        CATEGORY_LABELS[product.category],
        product.brand,
        product.status,
        product.description,
        product.price,
        money(product.price),
        product.stock,
        product.active ? 'activo visible disponible' : 'oculto inactivo',
        product.popular ? 'destacado popular' : ''
    ].join(' '));
}

function sortProducts(products) {
    const sorted = [...products];
    const terms = searchTerms();
    const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' });
    const byUpdated = (a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt) || byName(a, b);

    if (terms.length) {
        sorted.sort((a, b) => scoreProduct(b, terms) - scoreProduct(a, terms) || byUpdated(a, b));
        if (state.sort === 'updated') return sorted;
    }

    if (state.sort === 'name') return sorted.sort(byName);
    if (state.sort === 'price-desc') return sorted.sort((a, b) => Number(b.price) - Number(a.price) || byName(a, b));
    if (state.sort === 'price-asc') return sorted.sort((a, b) => Number(a.price) - Number(b.price) || byName(a, b));
    if (state.sort === 'stock-asc') return sorted.sort((a, b) => Number(a.stock) - Number(b.stock) || byName(a, b));
    return sorted.sort(byUpdated);
}

function scoreProduct(product, terms) {
    const name = normalizeSearch(product.name);
    const brand = normalizeSearch(product.brand);
    const id = normalizeSearch(product.id);
    return terms.reduce((score, term) => {
        if (id === term) return score + 80;
        if (name === term) return score + 60;
        if (name.startsWith(term)) return score + 35;
        if (brand.startsWith(term)) return score + 20;
        if (id.includes(term)) return score + 16;
        if (searchIndex(product).includes(term)) return score + 8;
        return score;
    }, 0);
}

function dateValue(value) {
    const parsed = Date.parse(String(value || '').replace(' ', 'T'));
    return Number.isFinite(parsed) ? parsed : 0;
}

function updateInventoryMeta(visible) {
    const total = state.products.length;
    const search = state.search.trim();
    const category = state.category === 'all' ? '' : (CATEGORY_LABELS[state.category] || state.category);
    const status = {
        active: 'activos',
        hidden: 'ocultos',
        low: 'con bajo stock',
        offer: 'en oferta',
        popular: 'destacados'
    }[state.active] || '';
    const filters = [search && `busqueda "${search}"`, category, status].filter(Boolean);

    nodes.statView.textContent = String(visible);
    nodes.resultCount.textContent = filters.length
        ? `${visible} de ${total} productos filtrados por ${filters.join(', ')}.`
        : `${total} productos cargados. Usa / o Cmd+K para buscar rapido.`;
}

function syncQuickFilters() {
    nodes.quickFilters.forEach(button => {
        button.classList.toggle('is-active', button.dataset.quickFilter === state.active);
    });
}

function renderTags(node, product) {
    const tags = [];
    if (product.popular) tags.push('Destacado');
    if (product.active && product.stock <= 3) tags.push('Bajo stock');
    if (!product.active) tags.push('Oculto');

    node.replaceChildren(...tags.map(text => {
        const tag = document.createElement('span');
        tag.className = 'mini-tag';
        tag.textContent = text;
        return tag;
    }));
}

function clearFilters() {
    state.search = '';
    state.category = 'all';
    state.active = 'all';
    state.sort = 'updated';
    nodes.search.value = '';
    nodes.categoryFilter.value = state.category;
    nodes.activeFilter.value = state.active;
    nodes.sortFilter.value = state.sort;
    renderProducts();
    nodes.search.focus();
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
    form.color.value = product.color || '';
    form.description.value = product.description || '';
    form.popular.checked = Boolean(product.popular);
    form.active.checked = Boolean(product.active);
    updateColorSwatch(product.color);
    updateImagePreview(product.image);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function duplicateProduct(product) {
    state.editingId = null;
    nodes.formTitle.textContent = 'Duplicar producto';
    const form = nodes.productForm;
    form.id.value = '';
    form.name.value = `${product.name} copia`;
    form.category.value = product.category;
    form.brand.value = product.brand;
    form.price.value = product.price;
    form.oldPrice.value = product.oldPrice || '';
    form.stock.value = product.stock;
    form.status.value = product.status || 'Disponible';
    form.image.value = product.image || '';
    form.color.value = product.color || '';
    form.description.value = product.description || '';
    form.popular.checked = Boolean(product.popular);
    form.active.checked = Boolean(product.active);
    nodes.imageFile.value = '';
    updateColorSwatch(product.color);
    updateImagePreview(product.image);
    setMessage(nodes.productMessage, 'Copia preparada. Revisa el nombre y guarda para crear otro producto.');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.name.focus();
    form.name.select();
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
    updateColorSwatch('');
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
        color: form.color.value,
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
    formData.append('removeBackground', nodes.removeBg.checked ? '1' : '0');
    setMessage(nodes.productMessage, 'Subiendo imagen...');

    try {
        const response = await fetch('/api/uploads/products', {
            method: 'POST',
            body: formData
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo subir la imagen.');
        nodes.productForm.image.value = data.path;
        if (data.dominantColor) nodes.productForm.color.value = data.dominantColor;
        updateColorSwatch(nodes.productForm.color.value);
        updateImagePreview(data.path);
        const detail = data.backgroundRemoved ? ' Fondo blanco removido.' : '';
        const colorDetail = data.dominantColor ? ` Color detectado: ${data.dominantColor}.` : '';
        setMessage(nodes.productMessage, `Imagen subida.${detail}${colorDetail} Guarda el producto para aplicar el cambio.`);
    } catch (error) {
        setMessage(nodes.productMessage, error.message, true);
        nodes.imageFile.value = '';
    }
}

async function processImageUrl() {
    const url = nodes.productForm.image.value.trim();
    if (!url) {
        setMessage(nodes.productMessage, 'Pega primero un link de imagen.', true);
        return;
    }

    if (!/^https?:\/\//i.test(url)) {
        setMessage(nodes.productMessage, 'El link debe empezar con http:// o https://.', true);
        return;
    }

    nodes.processImageUrl.disabled = true;
    setMessage(nodes.productMessage, 'Procesando link de imagen...');

    try {
        const data = await api('/api/uploads/products/from-url', {
            method: 'POST',
            body: {
                url,
                removeBackground: nodes.removeBg.checked ? '1' : '0'
            }
        });
        nodes.productForm.image.value = data.path;
        if (data.dominantColor) nodes.productForm.color.value = data.dominantColor;
        updateColorSwatch(nodes.productForm.color.value);
        updateImagePreview(data.path);
        const detail = data.backgroundRemoved ? ' Fondo blanco removido.' : '';
        const colorDetail = data.dominantColor ? ` Color detectado: ${data.dominantColor}.` : '';
        setMessage(nodes.productMessage, `Link procesado.${detail}${colorDetail} Guarda el producto para aplicar el cambio.`);
    } catch (error) {
        setMessage(nodes.productMessage, error.message, true);
    } finally {
        nodes.processImageUrl.disabled = false;
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

function updateColorSwatch(value) {
    const color = String(value || '').trim();
    const isHex = /^#[0-9a-f]{6}$/i.test(color);
    nodes.colorSwatch.style.background = isHex ? color : 'linear-gradient(135deg, #ef4444, #f6c343, #06b6d4)';
    nodes.colorSwatch.title = isHex ? color : 'Sin color automatico';
}

function assetUrl(src) {
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    if (src.startsWith('../')) return src;
    return `../${src}`;
}

function exportCsv() {
    const headers = ['id', 'name', 'category', 'brand', 'price', 'oldPrice', 'stock', 'status', 'active', 'popular', 'image', 'color', 'description'];
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
        .map(cols => {
            const hasColor = /^#[0-9a-f]{6}$/i.test(cols[6] || '');
            return {
                name: cols[0],
                category: cols[1] || 'papeleria',
                brand: cols[2] || 'De Colores',
                price: cols[3],
                stock: cols[4] || 0,
                image: cols[5] || '',
                color: hasColor ? cols[6] : '',
                description: hasColor ? (cols[7] || '') : (cols[6] || '')
            };
        });
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

function formatDateTime(value) {
    if (!value) return 'sin registro';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}
