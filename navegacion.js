// navegacion.js - Sistema de navegación global para Papelería De Colores

// Estructura de páginas del sitio
const sitemap = {
    'index.html': {
        title: 'Inicio',
        name: 'Papelería De Colores'
    },
    'productos/materiales-escolares.html': {
        title: 'Materiales Escolares',
        parent: '../index.html'
    },
    'productos/arte-manualidades.html': {
        title: 'Arte y Manualidades', 
        parent: '../index.html'
    },
    'productos/articulos-oficina.html': {
        title: 'Artículos de Oficina',
        parent: '../index.html'
    },
    'productos/regalos-decoracion.html': {
        title: 'Regalos y Decoración',
        parent: '../index.html'
    },
    'productos/tecnologia-educativa.html': {
        title: 'Tecnología Educativa',
        parent: '../index.html'
    },
    'productos/libros-lectura.html': {
        title: 'Libros y Lectura',
        parent: '../index.html'
    },
    'catalogo-productos.html': {
        title: 'Catálogo Completo',
        parent: 'index.html'
    }
};

// Detectar si estamos en una subcarpeta
function getBasePath() {
    const currentPath = window.location.pathname;
    return currentPath.includes('/productos/') ? '../' : '';
}

// Función para crear breadcrumbs automáticos
function createBreadcrumbs() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';
    const fullPath = currentPath.includes('/productos/') ? 
        'productos/' + currentPage : 
        currentPage;
    
    const breadcrumbContainer = document.createElement('div');
    breadcrumbContainer.className = 'breadcrumb-container';
    breadcrumbContainer.style.cssText = `
        background: rgba(255,255,255,0.9);
        padding: 1rem 2rem;
        margin-top: 80px;
        border-bottom: 1px solid #e9ecef;
        backdrop-filter: blur(10px);
    `;

    let breadcrumbHTML = '<nav class="breadcrumb" style="font-size: 0.9rem;">';
    
    const basePath = getBasePath();
    
    // Agregar enlace al inicio
    if (currentPage !== 'index.html') {
        breadcrumbHTML += `<a href="${basePath}index.html" style="color: #007bff; text-decoration: none; transition: color 0.3s;">🏠 Inicio</a>`;
        breadcrumbHTML += ' <span style="color: #6c757d; margin: 0 0.5rem;">></span> ';
    }
    
    // Agregar página actual
    const pageInfo = sitemap[fullPath];
    if (pageInfo) {
        breadcrumbHTML += `<span style="color: #6c757d; font-weight: 600;">${pageInfo.title}</span>`;
    }
    
    breadcrumbHTML += '</nav>';
    breadcrumbContainer.innerHTML = breadcrumbHTML;
    
    // Agregar hover effect a los enlaces
    breadcrumbContainer.querySelectorAll('a').forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.color = '#ff6b6b';
        });
        link.addEventListener('mouseleave', function() {
            this.style.color = '#007bff';
        });
    });
    
    // Insertar después del header
    const header = document.querySelector('.header');
    if (header && header.nextSibling) {
        header.parentNode.insertBefore(breadcrumbContainer, header.nextSibling);
    }
}

// Función para actualizar el título de la página
function updatePageTitle() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const pageInfo = sitemap[currentPage];
    
    if (pageInfo && pageInfo.title !== 'Inicio') {
        document.title = `${pageInfo.title} - Papelería De Colores`;
    }
}

// Función para crear navegación entre productos
function createProductNavigation() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Solo agregar en páginas de productos
    const productPages = [
        'materiales-escolares.html',
        'arte-manualidades.html', 
        'articulos-oficina.html',
        'regalos-decoracion.html',
        'tecnologia-educativa.html',
        'libros-lectura.html'
    ];
    
    if (productPages.includes(currentPage)) {
        const currentIndex = productPages.indexOf(currentPage);
        const prevPage = currentIndex > 0 ? productPages[currentIndex - 1] : null;
        const nextPage = currentIndex < productPages.length - 1 ? productPages[currentIndex + 1] : null;
        
        const navContainer = document.createElement('div');
        navContainer.className = 'product-navigation';
        navContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            padding: 2rem;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            margin-top: 2rem;
        `;
        
        let navHTML = '';
        
        if (prevPage) {
            const prevInfo = sitemap[prevPage];
            navHTML += `
                <a href="${prevPage}" class="nav-btn prev-btn" style="
                    background: linear-gradient(45deg, #ff6b6b, #feca57);
                    color: white;
                    padding: 1rem 2rem;
                    border-radius: 50px;
                    text-decoration: none;
                    font-weight: bold;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                ">
                    ← ${prevInfo.title}
                </a>
            `;
        } else {
            navHTML += '<div></div>';
        }
        
        if (nextPage) {
            const nextInfo = sitemap[nextPage];
            navHTML += `
                <a href="${nextPage}" class="nav-btn next-btn" style="
                    background: linear-gradient(45deg, #4ecdc4, #45b7d1);
                    color: white;
                    padding: 1rem 2rem;
                    border-radius: 50px;
                    text-decoration: none;
                    font-weight: bold;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                ">
                    ${nextInfo.title} →
                </a>
            `;
        } else {
            navHTML += '<div></div>';
        }
        
        navContainer.innerHTML = navHTML;
        
        // Agregar hover effects
        navContainer.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-3px) scale(1.05)';
                this.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
            });
            
            btn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = 'none';
            });
        });
        
        // Insertar antes del footer
        const footer = document.querySelector('.footer');
        if (footer) {
            footer.parentNode.insertBefore(navContainer, footer);
        }
    }
}

// Función para crear un botón flotante de "Volver arriba"
function createBackToTop() {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '↑';
    backToTopBtn.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: linear-gradient(45deg, #ff6b6b, #feca57);
        color: white;
        border: none;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        font-size: 1.5rem;
        font-weight: bold;
        cursor: pointer;
        z-index: 1000;
        opacity: 0;
        transition: all 0.3s;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    
    // Mostrar/ocultar según scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.transform = 'scale(1)';
        } else {
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.transform = 'scale(0.8)';
        }
    });
    
    // Función de scroll suave al top
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Hover effect
    backToTopBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
    });
    
    backToTopBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(backToTopBtn);
}

// Función para mejorar la navegación móvil
function enhanceMobileNavigation() {
    const logo = document.querySelector('.logo');
    const navMenu = document.querySelector('.nav-menu');
    
    if (window.innerWidth <= 768 && logo && navMenu) {
        // Crear botón hamburguesa
        const hamburger = document.createElement('button');
        hamburger.innerHTML = '☰';
        hamburger.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            display: block;
        `;
        
        // Insertar botón hamburguesa
        const navContainer = document.querySelector('.nav-container');
        navContainer.appendChild(hamburger);
        
        // Ocultar menú por defecto en móvil
        navMenu.style.display = 'none';
        
        let mobileMenuOpen = false;
        
        hamburger.addEventListener('click', function() {
            mobileMenuOpen = !mobileMenuOpen;
            
            if (mobileMenuOpen) {
                navMenu.style.display = 'flex';
                navMenu.style.flexDirection = 'column';
                navMenu.style.position = 'absolute';
                navMenu.style.top = '100%';
                navMenu.style.left = '0';
                navMenu.style.right = '0';
                navMenu.style.background = 'rgba(102, 126, 234, 0.95)';
                navMenu.style.padding = '1rem';
                navMenu.style.backdropFilter = 'blur(15px)';
                navMenu.style.zIndex = '999';
                this.innerHTML = '✕';
            } else {
                navMenu.style.display = 'none';
                this.innerHTML = '☰';
            }
        });
        
        // Cerrar menú al hacer click en un enlace
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.style.display = 'none';
                hamburger.innerHTML = '☰';
                mobileMenuOpen = false;
            });
        });
    }
}

// Función para crear indicador de progreso de lectura
function createReadingProgress() {
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #feca57);
        z-index: 1001;
        transition: width 0.3s;
    `;
    
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        
        progressBar.style.width = Math.min(scrollPercent, 100) + '%';
    });
}

// Inicializar navegación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    updatePageTitle();
    createBreadcrumbs();
    createProductNavigation();
    createBackToTop();
    createReadingProgress();
    
    // Mejorar navegación móvil después de un pequeño delay
    setTimeout(enhanceMobileNavigation, 100);
});

// Funciones utilitarias para transiciones entre páginas
function smoothPageTransition(targetUrl) {
    // Fade out effect
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity = '0';
    
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 300);
}

// Mejorar todos los enlaces internos con transiciones suaves
document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href && link.href.includes(window.location.hostname)) {
        // Solo aplicar a enlaces internos que no sean anclas
        if (!link.href.includes('#') && !link.href.includes('mailto:') && !link.href.includes('tel:')) {
            e.preventDefault();
            smoothPageTransition(link.href);
        }
    }
});

// Animación de entrada de página
window.addEventListener('load', function() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

console.log('🌈 Sistema de navegación De Colores cargado correctamente');