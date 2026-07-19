(function () {
    const asset = path => path;

    window.DeColoresConfig = {
        brand: {
            name: 'De Colores',
            legalName: 'Papelería De Colores',
            tagline: 'Papelería premium para estudiar, trabajar y crear.',
            primaryColor: '#111827',
            secondaryColor: '#0f766e'
        },
        contact: {
            whatsapp: '593991234567',
            phoneLabel: '+593 99 123 4567',
            email: 'ventas@papeleriadecolores.com',
            address: 'Ibarra, Imbabura, Ecuador',
            schedule: 'Lunes a sábado, 8:00 a 19:00'
        },
        categories: [
            {
                id: 'escolares',
                name: 'Escolares',
                description: 'Listas, cuadernos, mochilas y básicos de regreso a clases.',
                image: asset('images/materiales/mochila-escolar-con-suministros-de-estudiantes.jpg'),
                icon: 'ES'
            },
            {
                id: 'oficina',
                name: 'Oficina',
                description: 'Organización, archivo, escritura y suministros para equipos.',
                image: asset('images/materiales/49-Archivador-Artesco-2.png'),
                icon: 'OF'
            },
            {
                id: 'escritura',
                name: 'Escritura',
                description: 'Lápices, bolígrafos, marcadores y color para cada idea.',
                image: asset('images/materiales/Boligrafos.png'),
                icon: 'ES'
            },
            {
                id: 'cuadernos',
                name: 'Cuadernos',
                description: 'Cuadernos universitarios, libretas y formatos especiales.',
                image: asset('images/materiales/cuaderno-academico-100-hojas-norma-.png'),
                icon: 'CU'
            },
            {
                id: 'arte',
                name: 'Arte',
                description: 'Materiales creativos para proyectos, tareas y manualidades.',
                image: asset('images/materiales/colores.png'),
                icon: 'AR'
            },
            {
                id: 'tecnologia',
                name: 'Tecnología',
                description: 'Calculadoras, almacenamiento y accesorios prácticos.',
                image: asset('images/tecnologia/calculadora-cs-bols-hl-4a-neg.png'),
                icon: 'TE'
            },
            {
                id: 'impresion',
                name: 'Impresión',
                description: 'Copias, impresiones, anillados y acabados para documentos.',
                image: asset('images/materiales/papel bond.png'),
                icon: 'IM'
            },
            {
                id: 'accesorios',
                name: 'Accesorios',
                description: 'Detalles útiles para estudiar, regalar y organizar.',
                image: asset('images/materiales/cartuchera.jpg'),
                icon: 'AC'
            }
        ],
        productNavigation: [
            {
                title: 'Escritura',
                description: 'Herramientas para tomar notas, dibujar y marcar.',
                links: [
                    { label: 'Bolígrafos', href: 'catalogo-productos.html?categoria=oficina&q=boligrafo' },
                    { label: 'Lápices', href: 'catalogo-productos.html?categoria=escolares&q=lapiz' },
                    { label: 'Marcadores', href: 'catalogo-productos.html?q=marcador' },
                    { label: 'Colores', href: 'catalogo-productos.html?categoria=arte&q=colores' }
                ]
            },
            {
                title: 'Corrección y adhesivos',
                description: 'Básicos limpios para clases, oficina y proyectos.',
                links: [
                    { label: 'Borradores', href: 'catalogo-productos.html?q=borrador' },
                    { label: 'Correctores', href: 'catalogo-productos.html?q=corrector' },
                    { label: 'Pegamentos', href: 'catalogo-productos.html?q=pegamento' },
                    { label: 'Cintas y etiquetas', href: 'catalogo-productos.html?q=etiquetas' }
                ]
            },
            {
                title: 'Escolar',
                description: 'Todo para listas escolares y regreso a clases.',
                links: [
                    { label: 'Cuadernos', href: 'productos/materiales-escolares.html' },
                    { label: 'Mochilas', href: 'catalogo-productos.html?q=mochila' },
                    { label: 'Geometría', href: 'catalogo-productos.html?q=regla' },
                    { label: 'Cartucheras', href: 'catalogo-productos.html?q=cartuchera' }
                ]
            },
            {
                title: 'Oficina y servicios',
                description: 'Organización, impresión y atención para equipos.',
                links: [
                    { label: 'Archivadores', href: 'catalogo-productos.html?q=archivador' },
                    { label: 'Papel', href: 'catalogo-productos.html?q=papel' },
                    { label: 'Impresiones', href: 'index.html#servicios' },
                    { label: 'Cotizar por WhatsApp', href: 'index.html#contacto' }
                ]
            }
        ],
        featuredProducts: [
            {
                id: 'kit-regreso-clases',
                name: 'Kit regreso a clases',
                category: 'Escolares',
                price: 24.9,
                oldPrice: 31.5,
                status: 'Oferta',
                description: 'Selección de básicos escolares para iniciar el ciclo con orden.',
                image: asset('images/materiales/mochila-escolar-con-suministros-de-estudiantes.jpg'),
                stock: 12
            },
            {
                id: 'set-colores-premium',
                name: 'Set de color premium',
                category: 'Arte',
                price: 8.75,
                oldPrice: null,
                status: 'Nuevo',
                description: 'Colores intensos para tareas, lettering y proyectos creativos.',
                image: asset('images/materiales/colores.png'),
                stock: 18
            },
            {
                id: 'organizador-oficina',
                name: 'Archivador ejecutivo',
                category: 'Oficina',
                price: 5.5,
                oldPrice: 6.75,
                status: 'Oferta',
                description: 'Organiza documentos de trabajo, estudio o trámites personales.',
                image: asset('images/materiales/49-Archivador-Artesco-2.png'),
                stock: 9
            },
            {
                id: 'calculadora-escolar',
                name: 'Calculadora escolar',
                category: 'Tecnología',
                price: 11.9,
                oldPrice: null,
                status: 'Disponible',
                description: 'Práctica, liviana y lista para clases de matemática y oficina.',
                image: asset('images/tecnologia/calculadora-cs-bols-hl-4a-neg.png'),
                stock: 7
            }
        ]
    };
})();
