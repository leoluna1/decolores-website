(function () {
    const config = window.DeColoresConfig || {};
    const SPREADSHEET_ID = '17yxiyTmKIrPqKMmDZ8ywvAPjFo703qdmksqoe5ktFtk';
    const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;

    const state = {
        allProducts: [],
        filteredProducts: [],
        currentPage: 1,
        itemsPerPage: 12,
        query: new URLSearchParams(window.location.search).get('q') || '',
        category: new URLSearchParams(window.location.search).get('categoria') || 'all',
        minPrice: '',
        maxPrice: '',
        availability: 'all',
        sort: 'relevance'
    };

    const categoryMeta = {
        all: { name: 'Todos los productos', description: 'Explora toda nuestra selección de papelería.' },
        escolares: { name: 'Útiles escolares', description: 'Cuadernos, mochilas, lápices y básicos para clases.' },
        oficina: { name: 'Oficina', description: 'Archivo, papel, organización y suministros profesionales.' },
        arte: { name: 'Arte y manualidades', description: 'Color, pintura y materiales para proyectos creativos.' },
        papeleria: { name: 'Papelería', description: 'Papel, sobres, etiquetas y productos de uso diario.' },
        tecnologia: { name: 'Tecnología', description: 'Calculadoras, almacenamiento y accesorios.' },
        libros: { name: 'Libros y lectura', description: 'Material educativo y lectura complementaria.' },
        regalos: { name: 'Regalos y decoración', description: 'Detalles, empaques y productos para ocasiones especiales.' }
    };

    const fallbackProducts = (config.featuredProducts || []).map((product, index) => ({
        ...product,
        id: product.id || `fallback-${index}`,
        brand: 'De Colores',
        category: normalizeCategory(product.category),
        popular: true
    }));

    const nodes = {};

    function initNodes() {
        [
            'searchBox',
            'categoryFilter',
            'minPrice',
            'maxPrice',
            'availabilityFilter',
            'sortSelect',
            'itemsSelect',
            'productsGrid',
            'pagination',
            'loading',
            'catalogStatus',
            'productCount',
            'sectionName',
            'sectionDescription',
            'activeFilters'
        ].forEach(id => nodes[id] = document.getElementById(id));
    }

    function clean(text) {
        return String(text || '').replace(/^["']|["']$/g, '').trim().slice(0, 280);
    }

    function normalizeText(value) {
        return clean(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function normalizeCategory(value) {
        const normalized = normalizeText(value);
        const map = {
            escolares: 'escolares',
            escolar: 'escolares',
            utiles: 'escolares',
            oficina: 'oficina',
            articulos: 'oficina',
            arte: 'arte',
            manualidades: 'arte',
            papeleria: 'papeleria',
            tecnologia: 'tecnologia',
            tech: 'tecnologia',
            libros: 'libros',
            lectura: 'libros'
        };

        return map[normalized] || normalized || 'oficina';
    }

    function inferCategory(name) {
        const text = normalizeText(name);
        const groups = [
            ['tecnologia', ['calculadora', 'usb', 'pendrive', 'mouse', 'cable', 'audifono', 'parlante', 'dvd', 'cd ', 'cargador', 'teclado']],
            ['arte', ['pintura', 'acuarela', 'acrilica', 'pincel', 'tempera', 'crayon', 'color', 'colores', 'cartulina', 'foamy', 'fomix', 'plastilina', 'marcador']],
            ['escolares', ['cuaderno', 'lapiz', 'lapices', 'mochila', 'cartuchera', 'regla', 'compas', 'abaco', 'borrador', 'sacapunta', 'escuadra', 'transportador', 'goma']],
            ['oficina', ['archivador', 'carpeta', 'folder', 'grapa', 'grapadora', 'clip', 'perforadora', 'boligrafo', 'resaltador', 'papel bond', 'sobre', 'etiqueta']],
            ['libros', ['libro', 'cuento', 'diccionario', 'atlas', 'lectura']],
            ['papeleria', ['papel', 'carton', 'afiche', 'formulario', 'factura', 'recibo', 'adhesivo']],
            ['regalos', ['adorno', 'regalo', 'navideno', 'navidad', 'globo', 'cinta', 'mono', 'decoracion']]
        ];
        const match = groups.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)));
        return match ? match[0] : 'papeleria';
    }

    function parseMoney(value) {
        const normalized = String(value || '')
            .replace(/\s+/g, '')
            .replace(/\$/g, '')
            .replace(/,/g, '.')
            .replace(/[^\d.-]/g, '');
        const number = Number.parseFloat(normalized);
        return Number.isFinite(number) && number > 0 ? number : null;
    }

    function normalizeHeader(value) {
        return normalizeText(value).replace(/[^a-z0-9]/g, '');
    }

    function parseCSVRows(csvText) {
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i += 1) {
            const char = csvText[i];
            const next = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(cell);
                cell = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
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
        return rows.filter(csvRow => csvRow.some(value => clean(value)));
    }

    function buildHeaderIndex(headers) {
        const normalizedHeaders = headers.map(normalizeHeader);
        const find = (...names) => {
            const targets = names.map(normalizeHeader);
            return normalizedHeaders.findIndex(header => targets.includes(header));
        };
        const findLast = (...names) => {
            const targets = names.map(normalizeHeader);
            for (let i = normalizedHeaders.length - 1; i >= 0; i -= 1) {
                if (targets.includes(normalizedHeaders[i])) return i;
            }
            return -1;
        };

        return {
            detail: find('DETALLE', 'PRODUCTO', 'NOMBRE'),
            brand: find('MARCA'),
            acquisition: find('ADQUISICION'),
            pvp: findLast('PVP'),
            pvpExact: find('P.V.P.'),
            suggestedPrice: find('PVP SUG UNI'),
            provider: find('PROVEEDOR'),
            purchaseDate: find('FECHA DE COMPRA')
        };
    }

    function parseCSV(csvText) {
        const rows = parseCSVRows(csvText);
        if (rows.length < 2) return [];

        const index = buildHeaderIndex(rows[0]);

        return rows
            .slice(1)
            .map((cols, rowIndex) => {
                const name = clean(cols[index.detail]);
                const price = parseMoney(cols[index.pvp]) || parseMoney(cols[index.pvpExact]) || parseMoney(cols[index.suggestedPrice]);

                if (!name || !price) return null;

                const stockValue = Number.parseInt(clean(cols[index.acquisition]), 10);
                const category = inferCategory(name);
                const provider = clean(cols[index.provider]);
                const purchaseDate = clean(cols[index.purchaseDate]);

                return {
                    id: `sheet-${rowIndex + 1}`,
                    name,
                    category,
                    brand: clean(cols[index.brand]) || provider || 'Sin marca',
                    price,
                    oldPrice: null,
                    description: purchaseDate
                        ? `Producto de papelería disponible. Última referencia de compra: ${purchaseDate}.`
                        : 'Producto de papelería disponible para consultar en tienda.',
                    stock: Number.isNaN(stockValue) ? 1 : Math.max(stockValue, 0),
                    popular: rowIndex < 24,
                    image: categoryImage(category)
                };
            })
            .filter(Boolean);
    }

    function categoryImage(category) {
        const item = (config.categories || []).find(cat => cat.id === category);
        return item?.image || 'images/materiales/colores.png';
    }

    function validImage(src) {
        return /^https?:\/\//.test(src) || /^images\//.test(src) || /^uploads\//.test(src) || /^\.\.\/images\//.test(src);
    }

    async function loadData() {
        setLoading(true);
        setStatus('Cargando catálogo actualizado...');

        try {
            const response = await fetch(`/api/products?t=${Date.now()}`, {
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const products = Array.isArray(data.products) ? data.products.map(normalizeApiProduct).filter(Boolean) : [];
            if (!products.length) throw new Error('El admin no devolvió productos activos.');

            state.allProducts = products;
            setStatus('Catálogo actualizado desde el panel admin.');
        } catch (adminError) {
            try {
                const response = await fetch(`${CSV_URL}&t=${Date.now()}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const csvText = await response.text();
                const products = parseCSV(csvText);
                if (!products.length) throw new Error('La hoja no devolvió productos válidos.');

                state.allProducts = products;
                setStatus('Catálogo actualizado desde inventario.');
            } catch (sheetError) {
                state.allProducts = fallbackProducts;
                setStatus('Mostrando productos provisionales. Revisa la conexión con inventario.');
                console.warn('No se pudo cargar el admin:', adminError);
                console.warn('No se pudo cargar Google Sheets:', sheetError);
            }
        }

        hydrateCategories();
        applyFilters();
        setLoading(false);
    }

    function normalizeApiProduct(product) {
        const name = clean(product.name);
        const price = Number(product.price);
        if (!name || !Number.isFinite(price)) return null;

        return {
            id: clean(product.id) || name,
            name,
            category: normalizeCategory(product.category),
            brand: clean(product.brand) || 'De Colores',
            price,
            oldPrice: product.oldPrice == null ? null : Number(product.oldPrice),
            description: clean(product.description) || 'Producto disponible para consultar en tienda.',
            stock: Number.parseInt(product.stock || 0, 10),
            popular: Boolean(product.popular),
            image: clean(product.image) || categoryImage(normalizeCategory(product.category)),
            color: validHexColor(product.color) ? product.color.toLowerCase() : ''
        };
    }

    function hydrateCategories() {
        const categories = new Set(state.allProducts.map(product => product.category));
        nodes.categoryFilter.replaceChildren();

        const all = new Option('Todas las categorías', 'all');
        nodes.categoryFilter.appendChild(all);

        [...categories].sort().forEach(category => {
            const meta = categoryMeta[category] || { name: category };
            nodes.categoryFilter.appendChild(new Option(meta.name, category));
        });

        nodes.categoryFilter.value = state.category;
    }

    function bindControls() {
        nodes.searchBox.value = state.query;

        nodes.searchBox.addEventListener('input', event => {
            state.query = event.target.value;
            state.currentPage = 1;
            applyFilters();
        });

        nodes.categoryFilter.addEventListener('change', event => {
            state.category = event.target.value;
            state.currentPage = 1;
            applyFilters();
        });

        nodes.minPrice.addEventListener('input', event => {
            state.minPrice = event.target.value;
            state.currentPage = 1;
            applyFilters();
        });

        nodes.maxPrice.addEventListener('input', event => {
            state.maxPrice = event.target.value;
            state.currentPage = 1;
            applyFilters();
        });

        nodes.availabilityFilter.addEventListener('change', event => {
            state.availability = event.target.value;
            state.currentPage = 1;
            applyFilters();
        });

        nodes.sortSelect.addEventListener('change', event => {
            state.sort = event.target.value;
            state.currentPage = 1;
            applyFilters();
        });

        nodes.itemsSelect.addEventListener('change', event => {
            state.itemsPerPage = Number(event.target.value);
            state.currentPage = 1;
            render();
        });
    }

    function applyFilters() {
        const query = state.query.trim().toLowerCase();
        const min = Number.parseFloat(state.minPrice);
        const max = Number.parseFloat(state.maxPrice);

        let products = [...state.allProducts].filter(product => {
            const matchesQuery = !query ||
                product.name.toLowerCase().includes(query) ||
                product.description.toLowerCase().includes(query) ||
                product.brand.toLowerCase().includes(query) ||
                String(product.id).toLowerCase().includes(query);

            const matchesCategory = state.category === 'all' || product.category === state.category;
            const matchesMin = Number.isNaN(min) || product.price >= min;
            const matchesMax = Number.isNaN(max) || product.price <= max;
            const matchesAvailability = state.availability === 'all' ||
                (state.availability === 'available' && product.stock > 0) ||
                (state.availability === 'soldout' && product.stock <= 0);

            return matchesQuery && matchesCategory && matchesMin && matchesMax && matchesAvailability;
        });

        products = sortProducts(products);
        state.filteredProducts = products;
        updateUrl();
        render();
    }

    function sortProducts(products) {
        const sorted = [...products];
        const byName = (a, b) => a.name.localeCompare(b.name, 'es');

        if (state.sort === 'price-asc') return sorted.sort((a, b) => a.price - b.price);
        if (state.sort === 'price-desc') return sorted.sort((a, b) => b.price - a.price);
        if (state.sort === 'name') return sorted.sort(byName);
        if (state.sort === 'new') return sorted.sort((a, b) => Number(b.popular) - Number(a.popular) || byName(a, b));

        return sorted.sort((a, b) => Number(b.popular) - Number(a.popular) || byName(a, b));
    }

    function updateUrl() {
        const params = new URLSearchParams();
        if (state.query) params.set('q', state.query);
        if (state.category !== 'all') params.set('categoria', state.category);
        const next = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
        window.history.replaceState(null, '', next);
    }

    function render() {
        const total = state.filteredProducts.length;
        const totalPages = Math.max(Math.ceil(total / state.itemsPerPage), 1);
        state.currentPage = Math.min(state.currentPage, totalPages);

        const start = (state.currentPage - 1) * state.itemsPerPage;
        const pageProducts = state.filteredProducts.slice(start, start + state.itemsPerPage);
        const meta = categoryMeta[state.category] || categoryMeta.all;

        nodes.productCount.textContent = String(total);
        nodes.sectionName.textContent = state.query ? 'Resultados de búsqueda' : meta.name;
        nodes.sectionDescription.textContent = state.query
            ? `Productos relacionados con "${state.query}".`
            : meta.description;
        nodes.activeFilters.textContent = activeFiltersText(total);

        renderProducts(pageProducts);
        renderPagination(totalPages);
    }

    function activeFiltersText(total) {
        const parts = [];
        if (state.category !== 'all') parts.push(categoryMeta[state.category]?.name || state.category);
        if (state.minPrice) parts.push(`desde $${state.minPrice}`);
        if (state.maxPrice) parts.push(`hasta $${state.maxPrice}`);
        if (state.availability !== 'all') parts.push(state.availability === 'available' ? 'disponibles' : 'agotados');
        return parts.length ? `${total} resultados filtrados por ${parts.join(', ')}.` : `${total} productos encontrados.`;
    }

    function renderProducts(products) {
        nodes.productsGrid.replaceChildren();

        if (!products.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            const title = document.createElement('h3');
            title.textContent = 'No encontramos productos';
            const description = document.createElement('p');
            description.textContent = 'Prueba cambiando la búsqueda o limpiando los filtros.';
            empty.append(title, description);
            nodes.productsGrid.appendChild(empty);
            return;
        }

        products.forEach(product => nodes.productsGrid.appendChild(createProductCard(product)));
    }

    function createProductCard(product) {
        const card = document.createElement('article');
        card.className = 'catalog-card';
        card.dataset.category = product.category;
        if (validHexColor(product.color)) {
            card.dataset.imageColor = 'true';
            card.style.setProperty('--card-accent', product.color);
        }

        const imageWrap = document.createElement('div');
        imageWrap.className = 'catalog-card__image';
        imageWrap.dataset.category = product.category;

        const src = validImage(product.image) ? product.image : categoryImage(product.category);
        const image = document.createElement('img');
        image.src = src;
        image.alt = product.name;
        image.loading = 'lazy';
        image.onerror = () => {
            image.remove();
            imageWrap.textContent = product.name.slice(0, 2).toUpperCase();
            imageWrap.classList.add('catalog-card__image--fallback');
        };
        imageWrap.appendChild(image);

        const status = document.createElement('span');
        status.className = product.stock > 0 ? 'product-status product-status--available' : 'product-status product-status--soldout';
        status.textContent = product.stock > 0 ? (product.popular ? 'Destacado' : 'Disponible') : 'Agotado';
        imageWrap.appendChild(status);

        const body = document.createElement('div');
        body.className = 'catalog-card__body';

        const category = document.createElement('p');
        category.className = 'product-category';
        category.textContent = categoryMeta[product.category]?.name || product.category;

        const title = document.createElement('h3');
        title.textContent = product.name;

        const description = document.createElement('p');
        description.textContent = product.description;

        const meta = document.createElement('div');
        meta.className = 'catalog-card__meta';
        meta.append(textSpan(product.brand), textSpan(`Stock: ${Math.max(product.stock, 0)}`));

        const price = document.createElement('div');
        price.className = 'price-row';
        const current = document.createElement('strong');
        current.textContent = `$${product.price.toFixed(2)}`;
        price.appendChild(current);

        if (product.oldPrice && product.oldPrice > product.price) {
            const old = document.createElement('span');
            old.textContent = `$${product.oldPrice.toFixed(2)}`;
            const discount = document.createElement('em');
            discount.textContent = `-${Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%`;
            price.append(old, discount);
        }

        const actions = document.createElement('div');
        actions.className = 'product-actions';

        const buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'buy-button';
        buy.textContent = product.stock > 0 ? 'Comprar' : 'Consultar';
        buy.disabled = product.stock <= 0;
        buy.addEventListener('click', () => window.DeColoresCart?.add(product));

        const whatsapp = document.createElement('a');
        whatsapp.className = 'whatsapp-button';
        whatsapp.textContent = 'WhatsApp';
        whatsapp.href = `https://wa.me/${config.contact?.whatsapp || ''}?text=${encodeURIComponent(`Hola, quiero consultar ${product.name}.`)}`;
        whatsapp.target = '_blank';
        whatsapp.rel = 'noopener noreferrer';

        actions.append(buy, whatsapp);
        body.append(category, title, description, meta, price, actions);
        card.append(imageWrap, body);

        return card;
    }

    function textSpan(text) {
        const span = document.createElement('span');
        span.textContent = text;
        return span;
    }

    function validHexColor(color) {
        return /^#[0-9a-f]{6}$/i.test(String(color || '').trim());
    }

    function renderPagination(totalPages) {
        nodes.pagination.replaceChildren();
        nodes.pagination.hidden = totalPages <= 1;
        if (totalPages <= 1) return;

        const previous = pageButton('Anterior', state.currentPage - 1, state.currentPage === 1);
        nodes.pagination.appendChild(previous);

        for (let page = 1; page <= totalPages; page += 1) {
            if (page > 1 && page < totalPages && Math.abs(page - state.currentPage) > 1) {
                if (!nodes.pagination.lastElementChild?.classList.contains('pagination-gap')) {
                    const gap = document.createElement('span');
                    gap.className = 'pagination-gap';
                    gap.textContent = '...';
                    nodes.pagination.appendChild(gap);
                }
                continue;
            }
            nodes.pagination.appendChild(pageButton(String(page), page, false, page === state.currentPage));
        }

        nodes.pagination.appendChild(pageButton('Siguiente', state.currentPage + 1, state.currentPage === totalPages));
    }

    function pageButton(label, page, disabled, active = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = active ? 'pagination-btn active' : 'pagination-btn';
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener('click', () => {
            state.currentPage = page;
            render();
            document.querySelector('.products-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return button;
    }

    function setLoading(isLoading) {
        nodes.loading.hidden = !isLoading;
        nodes.productsGrid.hidden = isLoading;
    }

    function setStatus(message) {
        nodes.catalogStatus.textContent = message;
    }

    document.addEventListener('DOMContentLoaded', () => {
        initNodes();
        bindControls();
        loadData();
    });
})();
