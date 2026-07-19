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
        category: 'all',
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
        libros: { name: 'Libros y lectura', description: 'Material educativo y lectura complementaria.' }
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

    function normalizeCategory(value) {
        const normalized = clean(value).toLowerCase();
        const map = {
            escolares: 'escolares',
            escolar: 'escolares',
            'útiles': 'escolares',
            oficina: 'oficina',
            'artículos': 'oficina',
            arte: 'arte',
            manualidades: 'arte',
            papeleria: 'papeleria',
            'papelería': 'papeleria',
            tecnologia: 'tecnologia',
            'tecnología': 'tecnologia',
            tech: 'tecnologia',
            libros: 'libros',
            lectura: 'libros'
        };

        return map[normalized] || normalized || 'oficina';
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }

    function parseCSV(csvText) {
        return csvText
            .split('\n')
            .filter(line => line.trim())
            .slice(1)
            .map((line, index) => {
                const cols = parseCSVLine(line);
                const name = clean(cols[0]);
                const price = Number.parseFloat(clean(cols[3]));

                if (!name || Number.isNaN(price) || price <= 0) return null;

                const stockValue = Number.parseInt(clean(cols[6]), 10);

                return {
                    id: `sheet-${index + 1}`,
                    name,
                    category: normalizeCategory(cols[1]),
                    brand: clean(cols[2]) || 'Sin marca',
                    price,
                    oldPrice: Number.parseFloat(clean(cols[4])) || null,
                    description: clean(cols[5]) || 'Producto de calidad disponible en tienda.',
                    stock: Number.isNaN(stockValue) ? 1 : Math.max(stockValue, 0),
                    popular: clean(cols[7]).toLowerCase() === 'si',
                    image: clean(cols[8])
                };
            })
            .filter(Boolean);
    }

    function categoryImage(category) {
        const item = (config.categories || []).find(cat => cat.id === category);
        return item?.image || 'images/materiales/colores.png';
    }

    function validImage(src) {
        return /^https?:\/\//.test(src) || /^images\//.test(src) || /^\.\.\/images\//.test(src);
    }

    async function loadData() {
        setLoading(true);
        setStatus('Cargando catálogo actualizado...');

        try {
            const response = await fetch(`${CSV_URL}&t=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const csvText = await response.text();
            const products = parseCSV(csvText);
            if (!products.length) throw new Error('La hoja no devolvió productos válidos.');

            state.allProducts = products;
            setStatus('Catálogo actualizado desde inventario.');
        } catch (error) {
            state.allProducts = fallbackProducts;
            setStatus('Mostrando productos provisionales. Revisa la conexión con inventario.');
            console.warn('No se pudo cargar Google Sheets:', error);
        }

        hydrateCategories();
        applyFilters();
        setLoading(false);
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

        const imageWrap = document.createElement('div');
        imageWrap.className = 'catalog-card__image';

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
