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

    function addToCart(product) {
        if (!product || !product.id) return;

        const items = getCart();
        const existing = items.find(item => item.id === product.id);
        const stock = Number(product.stock || 99);

        if (existing) {
            existing.quantity = Math.min(existing.quantity + 1, Math.max(stock, 1));
        } else {
            items.push({
                id: String(product.id),
                name: String(product.name || 'Producto'),
                price: Number(product.price || 0),
                quantity: 1,
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

    function bindGlobalActions() {
        document.querySelectorAll('[data-whatsapp-link]').forEach(link => {
            const phone = config.contact?.whatsapp;
            if (!phone) return;
            const text = link.getAttribute('data-whatsapp-text') || 'Hola, quiero consultar productos de Papelería De Colores.';
            link.setAttribute('href', `https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

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

    bindHeader();
    enhanceProductNavigation();
    bindGlobalActions();
    bindReveal();
    ensureCartPanel();
    updateCartUI();

    window.DeColoresCart = {
        add: addToCart,
        open: openCart,
        getItems: getCart
    };
})();
