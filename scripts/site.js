(function () {
    const config = window.DeColoresConfig || {};
    const documentElement = document.documentElement;
    const CART_KEY = 'decolores-pedido';

    documentElement.classList.add('js');

    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const isProductPage = document.body.classList.contains('product-page');
    const rootPrefix = isProductPage ? '../' : '';

    function formatMoney(value) {
        return `$${Number(value || 0).toFixed(2)}`;
    }

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveCart(items) {
        localStorage.setItem(CART_KEY, JSON.stringify(items));
        updateCartUI();
    }

    function addToCart(product, quantity = 1) {
        if (!product || !product.id) return;

        const items = getCart();
        const existing = items.find(item => item.id === product.id);
        const stock = Number(product.stock || 99);
        const requestedQuantity = Math.max(1, Number(quantity || 1));

        if (existing) {
            existing.quantity = Math.min(existing.quantity + requestedQuantity, Math.max(stock, 1));
        } else {
            items.push({
                id: String(product.id),
                name: String(product.name || 'Producto'),
                price: Number(product.price || 0),
                quantity: Math.min(requestedQuantity, Math.max(stock, 1)),
                stock,
                image: product.image || ''
            });
        }

        saveCart(items);
        showCartToast(`${product.name || 'Producto'} agregado al pedido`);
    }

    function removeFromCart(id) {
        saveCart(getCart().filter(item => item.id !== id));
    }

    function updateQuantity(id, quantity) {
        const nextQuantity = Math.max(1, Number(quantity || 1));
        const items = getCart().map(item => {
            if (item.id !== id) return item;
            return { ...item, quantity: Math.min(nextQuantity, Math.max(Number(item.stock || 99), 1)) };
        });
        saveCart(items);
    }

    function cartTotal(items) {
        return items.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 1), 0);
    }

    function whatsappUrl(items) {
        const phone = config.contact?.whatsapp || '';
        const lines = [
            'Hola, quiero consultar este pedido:',
            '',
            ...items.map(item => `- ${item.name} x${item.quantity}: ${formatMoney(Number(item.price) * Number(item.quantity))}`),
            '',
            `Total estimado: ${formatMoney(cartTotal(items))}`,
            '',
            '¿Me ayudas con disponibilidad y forma de entrega?'
        ];

        return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
    }

    function ensureCartPanel() {
        if (document.querySelector('.cart-panel')) return;

        const panel = document.createElement('aside');
        panel.className = 'cart-panel';
        panel.setAttribute('aria-hidden', 'true');

        const backdrop = document.createElement('div');
        backdrop.className = 'cart-panel__backdrop';
        backdrop.setAttribute('data-cart-close', '');

        const dialog = document.createElement('div');
        dialog.className = 'cart-panel__dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'cartTitle');

        const header = document.createElement('div');
        header.className = 'cart-panel__header';

        const title = document.createElement('h2');
        title.id = 'cartTitle';
        title.textContent = 'Lista de pedido';

        const close = document.createElement('button');
        close.className = 'icon-button';
        close.type = 'button';
        close.textContent = '×';
        close.setAttribute('data-cart-close', '');
        close.setAttribute('aria-label', 'Cerrar pedido');

        const items = document.createElement('div');
        items.className = 'cart-panel__items';
        items.setAttribute('data-cart-items', '');

        const footer = document.createElement('div');
        footer.className = 'cart-panel__footer';

        const total = document.createElement('div');
        total.className = 'cart-total';
        const totalLabel = document.createElement('span');
        totalLabel.textContent = 'Total estimado';
        const totalValue = document.createElement('strong');
        totalValue.textContent = '$0.00';
        totalValue.setAttribute('data-cart-total', '');
        total.append(totalLabel, totalValue);

        const whatsapp = document.createElement('a');
        whatsapp.className = 'cta-button cart-whatsapp';
        whatsapp.href = '#';
        whatsapp.target = '_blank';
        whatsapp.rel = 'noopener noreferrer';
        whatsapp.textContent = 'Enviar por WhatsApp';
        whatsapp.setAttribute('data-cart-whatsapp', '');

        const clear = document.createElement('button');
        clear.className = 'secondary-button';
        clear.type = 'button';
        clear.textContent = 'Vaciar pedido';
        clear.setAttribute('data-cart-clear', '');

        header.append(title, close);
        footer.append(total, whatsapp, clear);
        dialog.append(header, items, footer);
        panel.append(backdrop, dialog);

        document.body.appendChild(panel);

        panel.addEventListener('click', event => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.matches('[data-cart-close]')) closeCart();
            if (target.matches('[data-cart-remove]')) removeFromCart(target.getAttribute('data-cart-remove'));
            if (target.matches('[data-cart-clear]')) saveCart([]);
        });

        panel.addEventListener('input', event => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || !target.matches('[data-cart-qty]')) return;
            updateQuantity(target.getAttribute('data-cart-qty'), target.value);
        });
    }

    function updateCartUI() {
        const items = getCart();
        const count = items.reduce((total, item) => total + Number(item.quantity || 1), 0);

        document.querySelectorAll('[data-cart-count]').forEach(element => {
            element.textContent = String(count);
            element.toggleAttribute('hidden', count === 0);
        });

        const panel = document.querySelector('.cart-panel');
        if (!panel) return;

        const itemsNode = panel.querySelector('[data-cart-items]');
        const totalNode = panel.querySelector('[data-cart-total]');
        const whatsappNode = panel.querySelector('[data-cart-whatsapp]');

        if (items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'cart-empty';
            empty.textContent = 'Tu lista está vacía. Agrega productos para consultar disponibilidad.';
            itemsNode.replaceChildren(empty);
        } else {
            itemsNode.replaceChildren(...items.map(item => {
                const row = document.createElement('article');
                row.className = 'cart-item';

                const title = document.createElement('strong');
                title.textContent = item.name;

                const meta = document.createElement('span');
                meta.textContent = `${formatMoney(item.price)} c/u`;

                const qty = document.createElement('input');
                qty.type = 'number';
                qty.min = '1';
                qty.max = String(Math.max(Number(item.stock || 99), 1));
                qty.value = String(item.quantity || 1);
                qty.setAttribute('data-cart-qty', item.id);
                qty.setAttribute('aria-label', `Cantidad de ${item.name}`);

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'icon-button';
                remove.textContent = '×';
                remove.setAttribute('data-cart-remove', item.id);
                remove.setAttribute('aria-label', `Quitar ${item.name}`);

                const info = document.createElement('div');
                info.append(title, meta);

                row.append(info, qty, remove);
                return row;
            }));
        }

        totalNode.textContent = formatMoney(cartTotal(items));
        whatsappNode.href = items.length ? whatsappUrl(items) : '#';
        whatsappNode.toggleAttribute('aria-disabled', items.length === 0);
    }

    function openCart() {
        ensureCartPanel();
        updateCartUI();
        document.querySelector('.cart-panel')?.classList.add('is-open');
        document.querySelector('.cart-panel')?.setAttribute('aria-hidden', 'false');
    }

    function closeCart() {
        document.querySelector('.cart-panel')?.classList.remove('is-open');
        document.querySelector('.cart-panel')?.setAttribute('aria-hidden', 'true');
    }

    function showCartToast(message) {
        let toast = document.querySelector('.cart-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'cart-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('is-visible');
        window.clearTimeout(showCartToast.timer);
        showCartToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 1800);
    }

    function bindHeader() {
        function syncHeaderState() {
            if (!header) return;
            header.classList.toggle('is-scrolled', window.scrollY > 16);
        }

        syncHeaderState();
        window.addEventListener('scroll', syncHeaderState, { passive: true });

        if (menuToggle && navMenu) {
            menuToggle.addEventListener('click', () => {
                const isOpen = navMenu.classList.toggle('is-open');
                menuToggle.setAttribute('aria-expanded', String(isOpen));
                menuToggle.textContent = isOpen ? 'Cerrar' : 'Menú';
                document.body.classList.toggle('nav-open', isOpen);
            });

            navMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('is-open');
                    menuToggle.setAttribute('aria-expanded', 'false');
                    menuToggle.textContent = 'Menú';
                    document.body.classList.remove('nav-open');
                });
            });
        }
    }

    function resolvePath(href) {
        if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return href;
        if (href.startsWith('../')) return href;
        return `${rootPrefix}${href}`;
    }

    function enhanceProductNavigation() {
        if (document.body.classList.contains('home-page')) return;

        const menu = document.querySelector('.nav-menu');
        const productLink = [...document.querySelectorAll('.nav-menu a')].find(link => {
            const text = link.textContent.trim().toLowerCase();
            return text === 'productos' || text === 'catálogo';
        });

        if (!menu || !productLink || !config.productNavigation?.length) return;

        const item = productLink.closest('li');
        if (!item || item.classList.contains('has-mega-menu')) return;

        item.classList.add('has-mega-menu');

        const trigger = document.createElement('button');
        trigger.className = 'mega-trigger';
        trigger.type = 'button';
        trigger.setAttribute('aria-expanded', 'false');
        trigger.textContent = productLink.textContent.trim() || 'Productos';

        const panel = document.createElement('div');
        panel.className = 'mega-menu';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Subcategorías de productos');

        const intro = document.createElement('div');
        intro.className = 'mega-menu__intro';
        const introLabel = document.createElement('span');
        introLabel.textContent = 'Catálogo De Colores';
        const introTitle = document.createElement('strong');
        introTitle.textContent = 'Compra por familias de producto';
        const introText = document.createElement('p');
        introText.textContent = 'Una navegación ordenada para encontrar rápido útiles escolares, oficina, arte y servicios.';
        const introAction = document.createElement('a');
        introAction.href = resolvePath('catalogo-productos.html');
        introAction.textContent = 'Ver catálogo completo';
        intro.append(introLabel, introTitle, introText, introAction);

        const grid = document.createElement('div');
        grid.className = 'mega-menu__grid';

        config.productNavigation.forEach(group => {
            const column = document.createElement('section');
            column.className = 'mega-menu__group';

            const title = document.createElement('h3');
            title.textContent = group.title;

            const description = document.createElement('p');
            description.textContent = group.description;

            const list = document.createElement('ul');
            group.links.forEach(link => {
                const listItem = document.createElement('li');
                const anchor = document.createElement('a');
                anchor.href = resolvePath(link.href);
                anchor.textContent = link.label;
                listItem.appendChild(anchor);
                list.appendChild(listItem);
            });

            column.append(title, description, list);
            grid.appendChild(column);
        });

        panel.append(intro, grid);
        productLink.replaceWith(trigger);
        item.appendChild(panel);

        trigger.addEventListener('click', event => {
            event.stopPropagation();
            const isOpen = item.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', String(isOpen));
        });

        panel.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                item.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
            });
        });

        document.addEventListener('click', event => {
            if (item.contains(event.target)) return;
            item.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
        });

        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            item.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
        });
    }

    function syncWhatsappLinks(root = document) {
        root.querySelectorAll('[data-whatsapp-link]').forEach(link => {
            const phone = config.contact?.whatsapp;
            if (!phone) return;
            const text = link.getAttribute('data-whatsapp-text') || 'Hola, quiero consultar productos de Papelería De Colores.';
            link.setAttribute('href', `https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
    }

    function resolveImage(src) {
        if (!src) return resolvePath('images/materiales/colores.png');
        if (/^(https?:|data:|blob:)/.test(src)) return src;
        return resolvePath(src);
    }

    function categoryLabel(category) {
        const normalized = String(category || '').toLowerCase();
        const match = (config.categories || []).find(item => item.id === normalized || item.name.toLowerCase() === normalized);
        return match?.name || category || 'Papelería';
    }

    function normalizeHomeProduct(product, index = 0) {
        const name = String(product.name || '').trim();
        const price = Number(product.price || 0);
        if (!name || !Number.isFinite(price)) return null;

        return {
            id: String(product.id || `home-${index}`),
            name,
            category: String(product.category || 'papeleria').toLowerCase(),
            categoryLabel: categoryLabel(product.category),
            brand: product.brand || 'De Colores',
            price,
            oldPrice: product.oldPrice == null ? null : Number(product.oldPrice),
            status: String(product.status || (product.popular ? 'Destacado' : 'Disponible')),
            description: String(product.description || 'Producto disponible para consultar en tienda.'),
            stock: Number.parseInt(product.stock || 1, 10),
            popular: Boolean(product.popular),
            image: product.image || 'images/materiales/colores.png',
            color: /^#[0-9a-f]{6}$/i.test(product.color || '') ? product.color : ''
        };
    }

    async function loadHomeFeaturedProducts() {
        const grid = document.querySelector('[data-home-featured]');
        if (!grid) return;

        let products = [];
        try {
            const response = await fetch(`/api/products?t=${Date.now()}`, {
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            products = (Array.isArray(data.products) ? data.products : [])
                .map(normalizeHomeProduct)
                .filter(Boolean)
                .sort((a, b) => Number(b.popular) - Number(a.popular) || Number(b.stock > 0) - Number(a.stock > 0))
                .slice(0, 6);
        } catch {
            products = (config.featuredProducts || []).map(normalizeHomeProduct).filter(Boolean).slice(0, 4);
        }

        if (!products.length) return;
        grid.replaceChildren(...products.map(createHomeFeaturedCard));
        syncWhatsappLinks(grid);
    }

    function createHomeFeaturedCard(product) {
        const card = document.createElement('article');
        card.className = 'featured-card';
        card.dataset.category = product.category;
        if (product.color) card.style.setProperty('--card-accent', product.color);

        const status = document.createElement('span');
        status.className = `product-status ${productStatusClass(product)}`;
        status.textContent = productStatusLabel(product);

        const favorite = document.createElement('button');
        favorite.className = 'favorite-button';
        favorite.type = 'button';
        favorite.setAttribute('aria-label', `Guardar ${product.name}`);
        favorite.textContent = '♡';

        const image = document.createElement('img');
        image.src = resolveImage(product.image);
        image.alt = product.name;
        image.loading = 'lazy';

        const body = document.createElement('div');
        body.className = 'featured-card__body';

        const category = document.createElement('p');
        category.className = 'product-category';
        category.textContent = product.categoryLabel;

        const title = document.createElement('h3');
        title.textContent = product.name;

        const description = document.createElement('p');
        description.textContent = product.description;

        const price = document.createElement('div');
        price.className = 'price-row';
        const current = document.createElement('strong');
        current.textContent = formatMoney(product.price);
        price.appendChild(current);
        if (product.oldPrice && product.oldPrice > product.price) {
            const old = document.createElement('span');
            old.textContent = formatMoney(product.oldPrice);
            const discount = document.createElement('em');
            discount.textContent = `-${Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%`;
            price.append(old, discount);
        }

        const actions = document.createElement('div');
        actions.className = 'product-actions';

        const buy = document.createElement('button');
        buy.className = 'buy-button';
        buy.type = 'button';
        buy.textContent = product.stock > 0 ? 'Comprar' : 'Consultar';
        buy.disabled = product.stock <= 0;
        buy.setAttribute('data-add-product', '');
        buy.setAttribute('data-product-id', product.id);
        buy.setAttribute('data-product-name', product.name);
        buy.setAttribute('data-product-price', product.price);
        buy.setAttribute('data-product-stock', product.stock || 99);
        buy.setAttribute('data-product-image', product.image);

        const whatsapp = document.createElement('a');
        whatsapp.className = 'whatsapp-button';
        whatsapp.textContent = 'WhatsApp';
        whatsapp.href = '#';
        whatsapp.setAttribute('data-whatsapp-link', '');
        whatsapp.setAttribute('data-whatsapp-text', `Hola, quiero consultar ${product.name}.`);

        actions.append(buy, whatsapp);
        body.append(category, title, description, price, actions);
        card.append(status, favorite, image, body);
        return card;
    }

    function productStatusLabel(product) {
        const status = String(product.status || '').trim();
        if (product.stock <= 0) return 'Agotado';
        if (product.stock <= 3) return 'Bajo stock';
        if (/oferta/i.test(status)) return 'Oferta';
        if (/nuevo/i.test(status)) return 'Nuevo';
        if (product.popular) return 'Más pedido';
        return 'Disponible';
    }

    function productStatusClass(product) {
        const label = productStatusLabel(product);
        if (label === 'Agotado') return 'product-status--soldout';
        if (label === 'Bajo stock') return 'product-status--low';
        if (label === 'Nuevo') return 'product-status--new';
        if (label === 'Más pedido') return 'product-status--popular';
        return 'product-status--available';
    }

    function bindGlobalActions() {
        syncWhatsappLinks();

        document.querySelectorAll('[data-cart-open]').forEach(button => {
            button.addEventListener('click', openCart);
        });

        document.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target.closest('[data-add-product]') : null;
            if (!target) return;

            addToCart({
                id: target.getAttribute('data-product-id'),
                name: target.getAttribute('data-product-name'),
                price: target.getAttribute('data-product-price'),
                stock: target.getAttribute('data-product-stock') || 99,
                image: target.getAttribute('data-product-image') || ''
            });
        });

        document.querySelectorAll('.newsletter-form').forEach(form => {
            form.addEventListener('submit', event => {
                event.preventDefault();
                showCartToast('Gracias. Newsletter pendiente de conectar.');
                form.reset();
            });
        });
    }

    function bindReveal() {
        const revealTargets = document.querySelectorAll(
            '.fade-in, .product-card, .service-item, .contact-info, .product-card-detailed, .premium-card, .category-card, .featured-card, .benefit-card, .promo-card, .product-page [class*="-card"]'
        );

        if ('IntersectionObserver' in window) {
            revealTargets.forEach(element => element.classList.add('reveal'));

            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });

            revealTargets.forEach(element => observer.observe(element));
        } else {
            revealTargets.forEach(element => element.classList.add('is-visible'));
        }
    }

    function initFlowHero() {
        const hero = document.querySelector('.fluid-hero');
        if (!hero) return;

        const headerNode = document.querySelector('.home-page .header');
        const footerNode = document.querySelector('.home-page .footer');
        const badge = hero.querySelector('[data-hero-reveal="badge"]');
        const heading = hero.querySelector('[data-word-reveal="heading"]');
        const subline = hero.querySelector('[data-word-reveal="subline"]');
        const actions = hero.querySelector('.hero-actions');
        const formWrap = hero.querySelector('[data-hero-reveal="form"]');
        const quickLinks = hero.querySelector('[data-hero-reveal="quick"]');
        const waitlistForm = hero.querySelector('.fluid-hero__waitlist');
        const canvas = hero.querySelector('canvas');

        function splitWords(element, baseDelay, stagger, duration, y) {
            if (!element || element.dataset.wordsReady) return;
            const words = element.textContent.trim().split(/\s+/);
            element.textContent = '';
            words.forEach((word, index) => {
                const span = document.createElement('span');
                span.className = 'word';
                span.textContent = word;
                span.style.setProperty('--word-delay', `${baseDelay + index * stagger}ms`);
                span.style.setProperty('--word-duration', `${duration}ms`);
                span.style.setProperty('--word-y', `${y}px`);
                element.appendChild(span);
                if (index < words.length - 1) element.appendChild(document.createTextNode(' '));
            });
            element.dataset.wordsReady = 'true';
        }

        splitWords(heading, 480, 85, 720, 26);
        splitWords(subline, 1150, 22, 600, 14);

        window.setTimeout(() => headerNode?.classList.add('is-hero-visible'), 150);
        window.setTimeout(() => badge?.classList.add('is-visible'), 320);
        window.setTimeout(() => heading?.classList.add('is-visible'), 480);
        window.setTimeout(() => subline?.classList.add('is-visible'), 1150);
        window.setTimeout(() => actions?.classList.add('is-visible'), 1320);
        window.setTimeout(() => formWrap?.classList.add('is-visible'), 1450);
        window.setTimeout(() => quickLinks?.classList.add('is-visible'), 1570);
        window.setTimeout(() => footerNode?.classList.add('is-hero-visible'), 1650);

        waitlistForm?.addEventListener('submit', event => {
            event.preventDefault();
            showCartToast('Gracias. Te avisaremos cuando haya novedades.');
            waitlistForm.reset();
        });

        if (canvas) window.setTimeout(() => fluidFallback(canvas), 220);
    }

    function fluidSimulation(canvas) {
        const gl = canvas.getContext('webgl', {
            alpha: true,
            depth: false,
            stencil: false,
            antialias: true,
            preserveDrawingBuffer: false
        });

        if (!gl) {
            fluidFallback(canvas);
            return;
        }

        const MAX_SPLATS = 42;
        const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false, seeded: false };
        const splats = [];
        let start = performance.now();
        let orbitAngle = 0;
        let virtualSeeded = false;
        let virtualPrevX = 0.5;
        let virtualPrevY = 0.5;
        let lastVirtualColor = 0;
        let virtualColor = [0.05, 0.75, 1.0];
        let rafId = 0;

        const vertexShader = compile(gl.VERTEX_SHADER, `
            attribute vec2 aPosition;
            varying vec2 vUv;
            void main() {
                vUv = aPosition * 0.5 + 0.5;
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `);

        const fragmentShader = compile(gl.FRAGMENT_SHADER, `
            precision highp float;
            varying vec2 vUv;
            uniform vec2 uResolution;
            uniform float uTime;
            uniform int uCount;
            uniform vec4 uSplats[${MAX_SPLATS}];
            uniform vec3 uColors[${MAX_SPLATS}];

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
                    u.y
                );
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 5; i++) {
                    v += a * noise(p);
                    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 0.17;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec2 uv = vUv;
                vec2 centred = uv - 0.5;
                centred.x *= uResolution.x / uResolution.y;

                float baseMist = fbm(uv * 2.4 + vec2(uTime * 0.018, -uTime * 0.012));
                vec3 color = vec3(0.015, 0.019, 0.045) + vec3(0.015, 0.025, 0.06) * baseMist;

                for (int i = 0; i < ${MAX_SPLATS}; i++) {
                    if (i >= uCount) break;
                    vec4 s = uSplats[i];
                    vec2 p = uv - s.xy;
                    p.x *= uResolution.x / uResolution.y;
                    float age = clamp(s.z, 0.0, 1.0);
                    float radius = mix(0.026, 0.19, age) * s.w;
                    float core = exp(-dot(p, p) / max(radius * radius, 0.00008));
                    float ring = exp(-dot(p, p) / max(radius * radius * 6.2, 0.00008));
                    float marble = fbm((uv + s.xy * 2.0) * (5.0 + age * 6.0) + uTime * 0.055);
                    vec3 ink = uColors[i] * (core * 1.65 + ring * 0.42) * (1.15 + marble * 0.6);
                    color += ink * (1.0 - age);
                    color += vec3(0.0, 0.08, 0.16) * ring * (1.0 - age) * 0.16;
                }

                float vignette = smoothstep(1.15, 0.08, length(centred));
                color *= 0.66 + vignette * 0.72;
                color = pow(color, vec3(0.86));
                gl_FragColor = vec4(color, 1.0);
            }
        `);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            fluidFallback(canvas);
            return;
        }

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

        const locations = {
            position: gl.getAttribLocation(program, 'aPosition'),
            resolution: gl.getUniformLocation(program, 'uResolution'),
            time: gl.getUniformLocation(program, 'uTime'),
            count: gl.getUniformLocation(program, 'uCount'),
            splats: gl.getUniformLocation(program, 'uSplats[0]'),
            colors: gl.getUniformLocation(program, 'uColors[0]')
        };

        function compile(type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            return shader;
        }

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
            if (canvas.width === width && canvas.height === height) return;
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }

        function generateColor() {
            const h = 0.5 + Math.random() * 0.42;
            return hsvToRgb(h, 0.95, 1.0).map(value => value * 0.92);
        }

        function hsvToRgb(h, s, v) {
            const i = Math.floor(h * 6);
            const f = h * 6 - i;
            const p = v * (1 - s);
            const q = v * (1 - f * s);
            const t = v * (1 - (1 - f) * s);
            switch (i % 6) {
                case 0: return [v, t, p];
                case 1: return [q, v, p];
                case 2: return [p, v, t];
                case 3: return [p, q, v];
                case 4: return [t, p, v];
                default: return [v, p, q];
            }
        }

        function addSplat(x, y, color, size = 1) {
            splats.unshift({
                x,
                y,
                age: 0,
                size,
                vx: (Math.random() - 0.5) * 0.004,
                vy: (Math.random() - 0.5) * 0.004,
                color
            });
            if (splats.length > MAX_SPLATS) splats.length = MAX_SPLATS;
        }

        function multipleSplats(amount) {
            for (let i = 0; i < amount; i += 1) {
                const color = generateColor().map(value => value * 3.2);
                addSplat(Math.random(), Math.random(), color, 0.86 + Math.random() * 1.35);
            }
        }

        function pointerPos(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (clientX - rect.left) / rect.width,
                y: 1 - ((clientY - rect.top) / rect.height)
            };
        }

        function stir(clientX, clientY) {
            const pos = pointerPos(clientX, clientY);
            if (!pointer.seeded) {
                pointer.seeded = true;
                pointer.x = pos.x;
                pointer.y = pos.y;
                pointer.px = pos.x;
                pointer.py = pos.y;
                return;
            }
            const speed = Math.hypot(pos.x - pointer.x, pos.y - pointer.y);
            pointer.px = pointer.x;
            pointer.py = pointer.y;
            pointer.x = pos.x;
            pointer.y = pos.y;
            if (speed > 0.001) addSplat(pos.x, pos.y, generateColor().map(value => value * 2.6), 0.8 + Math.min(speed * 10, 1.4));
        }

        function driveVirtualPointer(now) {
            if (now - start < 700) return;
            const aspect = canvas.width / Math.max(canvas.height, 1);
            const base = Math.min(300, canvas.width * 0.35, canvas.height * 0.35);
            const radiusX = (base / canvas.width) * (0.72 + 0.28 * Math.sin(orbitAngle * 0.37));
            const radiusY = (base / canvas.height) * (0.72 + 0.28 * Math.sin(orbitAngle * 0.37));
            orbitAngle += 0.026;
            const x = 0.5 + Math.cos(orbitAngle) * radiusX;
            const y = 0.5 + Math.sin(orbitAngle) * radiusY * aspect;
            if (!virtualSeeded) {
                virtualSeeded = true;
                virtualPrevX = x;
                virtualPrevY = y;
                return;
            }
            if (now - lastVirtualColor > 120) {
                virtualColor = generateColor().map(value => value * 3.2);
                lastVirtualColor = now;
            }
            const speed = Math.hypot(x - virtualPrevX, y - virtualPrevY);
            virtualPrevX = x;
            virtualPrevY = y;
            addSplat(x, y, virtualColor, 0.9 + Math.min(speed * 20, 1.3));
        }

        function render(now) {
            resize();
            driveVirtualPointer(now);

            for (const splat of splats) {
                splat.age += 0.0065;
                splat.x += splat.vx + Math.sin(now * 0.001 + splat.y * 9.0) * 0.0007;
                splat.y += splat.vy + Math.cos(now * 0.001 + splat.x * 9.0) * 0.0007;
            }

            for (let i = splats.length - 1; i >= 0; i -= 1) {
                if (splats[i].age >= 1) splats.splice(i, 1);
            }

            const splatData = new Float32Array(MAX_SPLATS * 4);
            const colorData = new Float32Array(MAX_SPLATS * 3);
            splats.forEach((splat, index) => {
                splatData[index * 4] = splat.x;
                splatData[index * 4 + 1] = splat.y;
                splatData[index * 4 + 2] = splat.age;
                splatData[index * 4 + 3] = splat.size;
                colorData[index * 3] = splat.color[0];
                colorData[index * 3 + 1] = splat.color[1];
                colorData[index * 3 + 2] = splat.color[2];
            });

            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(locations.position);
            gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(locations.resolution, canvas.width, canvas.height);
            gl.uniform1f(locations.time, (now - start) / 1000);
            gl.uniform1i(locations.count, splats.length);
            gl.uniform4fv(locations.splats, splatData);
            gl.uniform3fv(locations.colors, colorData);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            rafId = requestAnimationFrame(render);
        }

        window.addEventListener('mousemove', event => stir(event.clientX, event.clientY), { passive: true });
        window.addEventListener('touchmove', event => {
            for (const touch of event.targetTouches) stir(touch.clientX, touch.clientY);
        }, { passive: true });

        resize();
        multipleSplats(34);
        for (let i = 0; i < 8; i += 1) window.setTimeout(() => multipleSplats(10 + Math.floor(Math.random() * 10)), i * 48);
        rafId = requestAnimationFrame(render);

        window.addEventListener('pagehide', () => {
            if (rafId) cancelAnimationFrame(rafId);
        }, { once: true });
    }

    function fluidFallback(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const particles = [];
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let orbit = 0;
        let width = 0;
        let height = 0;
        let rafId = 0;
        let lastFrame = 0;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.max(1, Math.floor(width * dpr));
            canvas.height = Math.max(1, Math.floor(height * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function color() {
            return `${180 + Math.random() * 150} 95% 58%`;
        }

        function add(x, y, radius = 120, force = 1) {
            particles.unshift({
                x,
                y,
                radius,
                age: 0,
                color: color(),
                vx: (Math.random() - 0.5) * 0.42 * force,
                vy: (Math.random() - 0.5) * 0.42 * force
            });
            if (particles.length > 30) particles.length = 30;
        }

        function paintBase() {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#04050c';
            ctx.fillRect(0, 0, width, height);
            const base = ctx.createRadialGradient(width * 0.22, height * 0.15, 0, width * 0.22, height * 0.15, Math.max(width, height) * 0.72);
            base.addColorStop(0, 'rgba(45, 212, 191, 0.34)');
            base.addColorStop(0.42, 'rgba(168, 85, 247, 0.24)');
            base.addColorStop(1, 'rgba(4, 5, 12, 0)');
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, width, height);
        }

        function draw(now = 0) {
            if (now - lastFrame < 33 && !reducedMotion) {
                rafId = requestAnimationFrame(draw);
                return;
            }
            lastFrame = now;
            paintBase();
            orbit += 0.026;
            if (!reducedMotion) add(
                width / 2 + Math.cos(orbit) * Math.min(220, width * 0.28),
                height / 2 + Math.sin(orbit) * Math.min(180, height * 0.28),
                64,
                0.55
            );
            ctx.globalCompositeOperation = 'lighter';
            particles.forEach(particle => {
                particle.age += reducedMotion ? 0.04 : 0.018;
                particle.x += particle.vx;
                particle.y += particle.vy;
                const alpha = Math.max(0, 1 - particle.age);
                const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius * (1 + particle.age));
                gradient.addColorStop(0, `hsl(${particle.color} / ${alpha * 0.82})`);
                gradient.addColorStop(0.45, `hsl(${particle.color} / ${alpha * 0.22})`);
                gradient.addColorStop(1, 'rgba(4,5,12,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius * (1 + particle.age), 0, Math.PI * 2);
                ctx.fill();
            });
            for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].age >= 1) particles.splice(i, 1);
            if (!reducedMotion) rafId = requestAnimationFrame(draw);
        }

        resize();
        for (let i = 0; i < 16; i += 1) add(Math.random() * width, Math.random() * height, 70 + Math.random() * 130, 0.8);
        window.addEventListener('resize', resize, { passive: true });
        window.addEventListener('mousemove', event => add(event.clientX, event.clientY, 74, 1), { passive: true });
        window.addEventListener('touchmove', event => {
            const touch = event.targetTouches[0];
            if (touch) add(touch.clientX, touch.clientY, 74, 1);
        }, { passive: true });
        draw();
        window.addEventListener('pagehide', () => {
            if (rafId) cancelAnimationFrame(rafId);
        }, { once: true });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', event => {
            const selector = anchor.getAttribute('href');
            if (!selector || selector === '#') return;

            const target = document.querySelector(selector);
            if (!target) return;

            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    initFlowHero();
    bindHeader();
    enhanceProductNavigation();
    bindGlobalActions();
    loadHomeFeaturedProducts();
    bindReveal();
    ensureCartPanel();
    updateCartUI();

    window.DeColoresCart = {
        add: addToCart,
        open: openCart,
        getItems: getCart
    };
})();
