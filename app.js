const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');

const app = express();

// 📂 CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS
app.use(express.static(__dirname + '/public'));

// 🛠️ UTILIDADES
function getFechaChile() {
    return new Date().toLocaleString('es-CL', {
        timeZone: 'America/Santiago',
        hour12: false
    });
}

function layout(title, content, scripts = '', showSidebar = true) {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} | Ferretería</title>
        <link rel="stylesheet" href="/style.css">
    </head>
    <body>

        ${showSidebar ? `
        <aside class="sidebar">
            <div class="sidebar-brand">
                <div class="sidebar-logo">⚙️</div>
                <div>
                    <h3>FERRETERÍA</h3>
                    <span>CENTRAL ERP</span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <a href="/">🏠 Inicio</a>
                <a href="/inventario">📦 Inventario</a>
                <a href="/productos">📊 Productos</a>
                <a href="/ventas">💰 Ventas</a>
                <a href="/reportes">📈 Reportes</a>
                <a href="/despacho">🚚 Despachos</a>
                <a href="/proveedores">👷 Proveedores</a>
            </nav>

            <div class="sidebar-bottom">
                <a href="/logout">⛔ Cerrar sesión</a>
            </div>
        </aside>
        ` : ''}

        <main class="${showSidebar ? 'main-content' : 'main-wrapper'}">
            ${content}
        </main>
<script>
    const pathActual = window.location.pathname;

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        const href = link.getAttribute('href');

        if (
            href === pathActual ||
            (href !== '/' && pathActual.startsWith(href))
        ) {
            link.classList.add('active');
        }
    });
</script>
        ${scripts}
    </body>
    </html>`;
}

// 🔥 MIDDLEWARE & BODY PARSER
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔐 SESIONES
app.use(session({
    secret: 'ferreteria-secreta',
    resave: false,
    saveUninitialized: false
}));

const USER = { username: "admin", password: "1234" };

// 🔌 CONEXIÓN BASE DE DATOS
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && !isLocal ? { rejectUnauthorized: false } : false
});

pool.connect()
    .then(() => console.log("✅ DB conectada"))
    .catch(err => console.error("❌ Error DB:", err.message));

// ---------------------------------------------------------
// 🏗️ INICIALIZACIÓN DE TABLAS
// ---------------------------------------------------------
(async () => {
    try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS productos (
            id SERIAL PRIMARY KEY, nombre TEXT, precio INTEGER, stock INTEGER
        )`);
        
        await pool.query(`
        CREATE TABLE IF NOT EXISTS despachos (
            id SERIAL PRIMARY KEY, cliente TEXT, direccion TEXT, pedido TEXT, 
            estado TEXT DEFAULT 'Pendiente', fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`ALTER TABLE despachos ADD COLUMN IF NOT EXISTS venta_id INTEGER;`);
        await pool.query(`ALTER TABLE despachos ADD COLUMN IF NOT EXISTS fecha_entrega DATE;`);
        await pool.query(`ALTER TABLE despachos ADD COLUMN IF NOT EXISTS contacto TEXT;`);

        await pool.query(`
        CREATE TABLE IF NOT EXISTS ventas (
            id SERIAL PRIMARY KEY, fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP, total INTEGER
        )`);

        await pool.query(`
        CREATE TABLE IF NOT EXISTS detalle_ventas (
            id SERIAL PRIMARY KEY, venta_id INTEGER, producto_id INTEGER, 
            nombre TEXT, precio INTEGER, cantidad INTEGER
        )`);

        await pool.query(`
        CREATE TABLE IF NOT EXISTS proveedores (
            id SERIAL PRIMARY KEY, nombre TEXT, empresa TEXT, 
            telefono TEXT, observacion TEXT
        )`);
        console.log("✅ Estructura de tablas verificada");
    } catch (err) {
        console.error("❌ Error iniciando tablas:", err.message);
    }
})();

// ---------------------------------------------------------
// 🛡️ RUTAS DE AUTENTICACIÓN
// ---------------------------------------------------------

app.get('/login', (req, res) => {
    const content = `
    <div class="login-box">
        <header>
            <h2>🔐 Acceso al Sistema</h2>
            <p>Ingresa tus credenciales para continuar</p>
        </header>
        <form method="POST">
            <div class="form-group">
                <input name="username" placeholder="Usuario" required autocomplete="off">
            </div>
            <div class="form-group">
                <input name="password" type="password" placeholder="Contraseña" required>
            </div>
            <button class="btn-primary" style="width: 100%;">Ingresar al Panel</button>
        </form>
    </div>`;
    res.send(layout('Login', content, '', false));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === USER.username && password === USER.password) {
        req.session.user = username;
        return res.redirect('/');
    }
    res.send("❌ Credenciales incorrectas");
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

app.use((req, res, next) => {
    if (req.path === '/login') return next();
    if (!req.session.user) return res.redirect('/login');
    next();
});

// ---------------------------------------------------------
// 🏠 DASHBOARD PRINCIPAL
// ---------------------------------------------------------

app.get('/', async (req, res) => {
    const { rows: productos } = await pool.query("SELECT COUNT(*) AS total FROM productos");
    const { rows: stockCritico } = await pool.query("SELECT COUNT(*) AS total FROM productos WHERE stock <= 5");
    const { rows: despachosPendientes } = await pool.query("SELECT COUNT(*) AS total FROM despachos WHERE estado != 'Entregado'");
    const { rows: ventasHoy } = await pool.query(`
        SELECT COALESCE(SUM(total), 0) AS total 
        FROM ventas 
        WHERE DATE(fecha) = CURRENT_DATE
    `);
    const { rows: listaStockCritico } = await pool.query(`
    SELECT nombre, stock 
    FROM productos 
    WHERE stock <= 5 
    ORDER BY stock ASC 
    LIMIT 5
`);

const { rows: listaDespachos } = await pool.query(`
    SELECT cliente, estado, fecha_entrega 
    FROM despachos 
    WHERE estado != 'Entregado' 
    ORDER BY id DESC 
    LIMIT 5
`);

const { rows: ultimasVentas } = await pool.query(`
    SELECT id, fecha, total 
    FROM ventas 
    ORDER BY fecha DESC 
    LIMIT 5
`);

    const content = `
    <div class="container">

        <header class="topbar">
            <div class="brand">
                <h1>🔧 Ferretería Central</h1>
                <p>Dashboard Gerencial · Panel de Administración</p>
            </div>
            <a href="/logout" class="btn-volver">Cerrar sesión</a>
        </header>

        <section class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-icon">💰</span>
                <p>Ventas Hoy</p>
                <h2>$${Number(ventasHoy[0].total).toLocaleString('es-CL')}</h2>
            </div>

            <div class="kpi-card">
                <span class="kpi-icon">📦</span>
                <p>Productos</p>
                <h2>${productos[0].total}</h2>
            </div>

            <div class="kpi-card alerta">
                <span class="kpi-icon">⚠️</span>
                <p>Stock Crítico</p>
                <h2>${stockCritico[0].total}</h2>
            </div>

            <div class="kpi-card">
                <span class="kpi-icon">🚚</span>
                <p>Despachos Pendientes</p>
                <h2>${despachosPendientes[0].total}</h2>
            </div>
        </section>

<section class="dashboard-panel">

    <div class="panel-card">
        <div class="panel-header">
            <h3>⚠️ Stock Crítico</h3>
            <a href="/reportes/stock">Ver todos</a>
        </div>

        <div class="mini-list">
            ${listaStockCritico.length ? listaStockCritico.map(p => `
                <div class="mini-row">
                    <span>${p.nombre}</span>
                    <strong class="danger">${p.stock}</strong>
                </div>
            `).join('') : `<p class="empty-text">Sin productos críticos.</p>`}
        </div>
    </div>

    <div class="panel-card">
        <div class="panel-header">
            <h3>🚚 Despachos Pendientes</h3>
            <a href="/despacho">Ver despachos</a>
        </div>

        <div class="mini-list">
            ${listaDespachos.length ? listaDespachos.map(d => `
                <div class="mini-row">
                    <span>${d.cliente || 'Sin cliente'}</span>
                    <strong>${d.estado}</strong>
                </div>
            `).join('') : `<p class="empty-text">Sin despachos pendientes.</p>`}
        </div>
    </div>

    <div class="panel-card">
        <div class="panel-header">
            <h3>💰 Últimas Ventas</h3>
            <a href="/reportes/detalle">Ver ventas</a>
        </div>

        <div class="mini-list">
            ${ultimasVentas.length ? ultimasVentas.map(v => `
                <div class="mini-row">
                    <span>Venta #${v.id}</span>
                    <strong>$${Number(v.total).toLocaleString('es-CL')}</strong>
                </div>
            `).join('') : `<p class="empty-text">Aún no hay ventas.</p>`}
        </div>
    </div>

</section>

    </div>`;

    res.send(layout('Dashboard', content));
});

// ---------------------------------------------------------
// 📦 GESTIÓN DE PRODUCTOS E INVENTARIO
// ---------------------------------------------------------

app.get('/inventario', async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM productos ORDER BY id ASC");
    
    let rowsHtml = rows.map(p => `
        <tr>
            <td><strong>#${p.id}</strong></td>
            <td>${p.nombre}</td>
            <td class="text-price">$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td><span class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock}</span></td>
            <td class="actions">
                <form method="GET" action="/editar/${p.id}" style="display:inline;">
                    <button style="padding: 6px 12px; font-size: 13px;">✏️ Editar</button>
                </form>
                <form method="POST" action="/eliminar/${p.id}" style="display:inline;" onsubmit="return confirm('¿Eliminar producto?')">
                    <button style="padding: 6px 12px; font-size: 13px; background: #ef4444;">🗑️</button>
                </form>
            </td>
        </tr>`).join('');

    const content = `
    <div class="container">
        <header class="topbar">
            <h2>📦 Gestión de Productos</h2>
            <a href="/" class="btn-volver">⬅ Volver al Inicio</a>
        </header>

        <section style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; margin-bottom: 20px; padding-bottom: 15px; position: sticky; top: 115px; z-index: 90; background: #f1f5f9;">
            
            <div style="flex: 1; min-width: 250px;">
                <input id="buscar" placeholder="🔍 Buscar producto..." style="width: 100%;">
            </div>

            <div style="flex: 2; min-width: 300px; background: #fff; padding: 15px; border-radius: 12px; border: 2px solid #1e293b; box-shadow: 4px 4px 0px #1e293b;">
                <h4 style="margin: 0 0 10px 0;">+ Nuevo Producto</h4>
                <form method="POST" action="/agregar" autocomplete="off" style="display: flex; gap: 10px; flex-wrap: wrap;" onsubmit="setTimeout(()=>this.reset(),100)">
                    <input name="nombre" placeholder="Nombre" required style="flex: 2; min-width: 120px;">
                    <input name="precio" type="number" placeholder="Precio" required style="flex: 1; min-width: 80px;">
                    <input name="stock" type="number" placeholder="Stock" required style="flex: 1; min-width: 80px;">
                    <button style="margin: 5px 0;">Añadir</button>
                </form>
            </div>

        </section>

        <div class="tabla-container">
            <table id="tabla">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Descripción</th>
                        <th>Precio Unit.</th>
                        <th>Stock</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    </div>`;

    const script = `
    <script>
        document.getElementById("buscar").onkeyup = function(){
            let f = this.value.toLowerCase();
            document.querySelectorAll("#tabla tbody tr").forEach(r => {
                r.style.display = r.innerText.toLowerCase().includes(f) ? "" : "none";
            });
        };
    </script>`;

    res.send(layout('Inventario', content, script));
});

app.post('/agregar', async (req,res)=>{
    const {nombre,precio,stock}=req.body;
    await pool.query("INSERT INTO productos (nombre,precio,stock) VALUES ($1,$2,$3)",[nombre,precio,stock]);
    res.redirect('/inventario');
});

app.post('/eliminar/:id', async (req,res)=>{
    await pool.query("DELETE FROM productos WHERE id=$1",[req.params.id]);
    res.redirect('/inventario');
});

app.get('/editar/:id', async (req,res)=>{
    const { rows } = await pool.query("SELECT * FROM productos WHERE id=$1",[req.params.id]);
    const p = rows[0];

    const content = `
    <div class="container" style="max-width: 500px;">
        <header class="topbar">
            <h2>✏️ Editar Producto</h2>
            <a href="/inventario" class="btn-volver">⬅ Volver</a>
        </header>
        <form method="POST" style="background: #fff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <label style="font-weight: bold; color: #475569;">Nombre:</label>
            <input name="nombre" value="${p.nombre}" required style="width: 100%; margin-bottom: 15px;">
            <label style="font-weight: bold; color: #475569;">Precio:</label>
            <input name="precio" type="number" value="${p.precio}" required style="width: 100%; margin-bottom: 15px;">
            <label style="font-weight: bold; color: #475569;">Stock:</label>
            <input name="stock" type="number" value="${p.stock}" required style="width: 100%; margin-bottom: 20px;">
            <button style="width: 100%;">Guardar Cambios</button>
        </form>
    </div>`;
    res.send(layout('Editar Producto', content));
});

app.post('/editar/:id', async (req,res)=>{
    const {nombre,precio,stock}=req.body;
    await pool.query("UPDATE productos SET nombre=$1,precio=$2,stock=$3 WHERE id=$4", [nombre,precio,stock,req.params.id]);
    res.redirect('/inventario');
});

app.get('/productos', async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM productos");
    
    let rowsHtml = rows.map(p => `
        <tr>
            <td>${p.id}</td><td>${p.nombre}</td>
            <td>$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td><span class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock}</span></td>
        </tr>`).join('');

    const content = `
    <div class="container">
        <header class="topbar">
            <h2>📊 Vista de Inventario</h2>
            <a href="/" class="btn-volver">⬅ Volver</a>
        </header>
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; padding-bottom: 15px; position: sticky; top: 115px; z-index: 90; background: #f1f5f9;"">
            <input id="buscar" placeholder="🔍 Buscar..." style="flex: 1; min-width: 200px;">
            <button onclick="excel()" style="background: #10b981;">📥 Exportar Excel</button>
        </div>
        <div class="tabla-container">
            <table id="tabla">
                <thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    </div>`;

    const scripts = `
    <script>
        document.getElementById("buscar").onkeyup = function(){
            let f = this.value.toLowerCase();
            document.querySelectorAll("#tabla tbody tr").forEach(r => {
                r.style.display = r.innerText.toLowerCase().includes(f) ? "" : "none";
            });
        };
        function excel(){
            let blob = new Blob([document.getElementById("tabla").outerHTML], {type:"application/vnd.ms-excel"});
            let a = document.createElement("a");
            a.href = URL.createObjectURL(blob); a.download = "inventario.xls"; a.click();
        }
    </script>`;

    res.send(layout('Vista Inventario', content, scripts));
});

// ---------------------------------------------------------
// 💰 PUNTO DE VENTA (CARRITO)
// ---------------------------------------------------------

app.get('/ventas', async (req, res) => {
    const { rows: productos } = await pool.query("SELECT * FROM productos WHERE stock > 0 ORDER BY nombre ASC");

    const productosHtml = productos.map(p => `
        <tr onclick='seleccionar(${p.id}, ${JSON.stringify(p.nombre)}, ${p.precio}, ${p.stock})' style="cursor:pointer;">
            <td>${p.id}</td><td>${p.nombre}</td>
            <td>$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td><span class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock}</span></td>
        </tr>`).join('');

    const content = `
    <div class="container">
        <header class="topbar">
            <h2>💰 Punto de Venta</h2>
            <a href="/" class="btn-volver">⬅ Salir</a>
        </header>

        <div style="display: flex; flex-wrap: wrap; gap: 25px;">
            <div style="flex: 1; min-width: 300px;">
                <input id="buscar" placeholder="🔍 Buscar producto..." style="width: 100%; margin-bottom: 10px;">
                <div class="tabla-container" style="max-height: 400px; margin-top: 0;">
                    <table id="tabla">
                        <thead><tr><th>ID</th><th>Producto</th><th>Precio</th><th>Stock</th></tr></thead>
                        <tbody>${productosHtml}</tbody>
                    </table>
                </div>
            </div>

            <div style="flex: 1; min-width: 300px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column;">
                <h3 style="margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">🛒 Detalle de Transacción</h3>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e2e8f0;">
                    <div id="selection-display" style="color: #64748b; text-align: center; font-size: 14px;">
                        Haz clic en un producto de la tabla para agregarlo
                    </div>
                    <div id="pos-controls" style="display:none; flex-wrap: wrap; gap: 10px; align-items: center;">
                        <input id="nombre" disabled style="flex: 2; min-width: 150px; background: #e2e8f0;">
                        <input id="precio" disabled style="flex: 1; min-width: 80px; background: #e2e8f0;">
                        <input id="cantidad" type="number" min="1" placeholder="Cant." style="flex: 1; min-width: 70px;">
                        <button onclick="agregarAlCarrito()" style="flex: 1; min-width: 90px; margin: 5px 0;">Añadir</button>
                    </div>
                </div>

                <div class="tabla-container" style="margin-top: 0; flex-grow: 1; max-height: 300px;">
                    <table id="carrito">
                        <thead><tr><th>Prod.</th><th>Cant.</th><th>$ Sub</th><th></th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>

                <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 15px; text-align: right;">
                    <span style="font-size: 16px; color: #64748b;">TOTAL A PAGAR</span><br>
                    <strong id="total" style="font-size: 28px; color: #2563eb;">$0</strong>
                </div>
                <button onclick="confirmarVenta()" style="width: 100%; margin-top: 15px; padding: 15px; font-size: 16px;">Finalizar Venta</button>
            </div>
        </div>
    </div>`;

    const scripts = `
    <script>
        let carrito = [];
        let productoSeleccionado = null;

        function seleccionar(id, nombre, precio, stock){
            productoSeleccionado = {id, nombre, precio, stock};
            document.getElementById("selection-display").style.display = "none";
            document.getElementById("pos-controls").style.display = "flex";
            document.getElementById("nombre").value = nombre;
            document.getElementById("precio").value = "$"+precio.toLocaleString('es-CL');
            document.getElementById("cantidad").value = "1";
            document.getElementById("cantidad").focus();
        }

        function agregarAlCarrito(){
            let cant = parseInt(document.getElementById("cantidad").value) || 0;
            if(!productoSeleccionado) return;
            if(cant <= 0) return alert("Cantidad inválida");
            if(cant > productoSeleccionado.stock) return alert("Stock insuficiente. Quedan " + productoSeleccionado.stock);

            let existente = carrito.find(p => p.id === productoSeleccionado.id);
            if(existente){
                if(existente.cantidad + cant > productoSeleccionado.stock) return alert("Excede stock");
                existente.cantidad += cant;
            } else {
                carrito.push({...productoSeleccionado, cantidad: cant});
            }

            actualizarVista();
            document.getElementById("pos-controls").style.display = "none";
            document.getElementById("selection-display").style.display = "block";
            productoSeleccionado = null;
        }

        function actualizarVista(){
            let tbody = document.querySelector("#carrito tbody");
            tbody.innerHTML = '';
            let total = 0;

            carrito.forEach((p, i) => {
                let sub = p.precio * p.cantidad;
                total += sub;
                tbody.innerHTML += \`
                <tr>
                    <td>\${p.nombre}</td>
                    <td class="right">\${p.cantidad}</td>
                    <td class="right">$\${sub.toLocaleString('es-CL')}</td>
                    <td><button onclick="eliminar(\${i})" style="padding: 4px 8px; font-size: 12px; background: #ef4444;">✕</button></td>
                </tr>\`;
            });
            document.getElementById("total").innerText = "$" + total.toLocaleString('es-CL');
        }

        function eliminar(i){
            carrito.splice(i, 1);
            actualizarVista();
        }

        function confirmarVenta(){
            if(carrito.length === 0) return alert("El carrito está vacío");
            let form = document.createElement("form");
            form.method = "POST";
            form.action = "/ventas";
            carrito.forEach(p => {
                let id = document.createElement("input");
                id.type = "hidden"; id.name = "producto_id[]"; id.value = p.id;
                form.appendChild(id);
                let c = document.createElement("input");
                c.type = "hidden"; c.name = "cantidad[]"; c.value = p.cantidad;
                form.appendChild(c);
            });
            document.body.appendChild(form);
            form.submit();
        }

        document.getElementById("buscar").onkeyup = function(){
            let f = this.value.toLowerCase();
            document.querySelectorAll("#tabla tbody tr").forEach(r => {
                r.style.display = r.innerText.toLowerCase().includes(f) ? "" : "none";
            });
        };
    </script>`;

    res.send(layout('Ventas', content, scripts));
});

app.post('/ventas', async (req,res)=>{
    const ids = Array.isArray(req.body.producto_id) ? req.body.producto_id : [req.body.producto_id];
    const cant = Array.isArray(req.body.cantidad) ? req.body.cantidad : [req.body.cantidad];
    let detalles = [];

    const ventaResult = await pool.query("INSERT INTO ventas (total) VALUES ($1) RETURNING id", [0]);
    const ventaId = ventaResult.rows[0].id;

    for (let i = 0; i < ids.length; i++) {
        const { rows } = await pool.query("SELECT * FROM productos WHERE id = $1", [ids[i]]);
        const p = rows[0];
        if (!p) continue;

        let cantidad = parseInt(cant[i]);
        if(cantidad > p.stock) cantidad = p.stock;

        await pool.query("UPDATE productos SET stock = stock - $1 WHERE id = $2", [cantidad, ids[i]]);
        await pool.query(
            `INSERT INTO detalle_ventas (venta_id, producto_id, nombre, precio, cantidad) VALUES ($1,$2,$3,$4,$5)`,
            [ventaId, p.id, p.nombre, p.precio, cantidad]
        );
        detalles.push({ nombre: p.nombre, precio: p.precio, cantidad });
    }

    let totalBoleta = 0;
    detalles.forEach(d=>{ totalBoleta += d.precio * d.cantidad; });
    await pool.query("UPDATE ventas SET total = $1 WHERE id = $2", [totalBoleta, ventaId]);

    res.redirect(`/boleta/${ventaId}`);
});

app.get('/boleta/:id', async (req,res)=>{
    const ventaId = req.params.id;
    const { rows: detalles } = await pool.query("SELECT * FROM detalle_ventas WHERE venta_id=$1", [ventaId]);

    let totalBoleta = 0;
    detalles.forEach(d=>{ totalBoleta += d.precio * d.cantidad; });

    let subtotal = Math.round(totalBoleta / 1.19);
    let iva = totalBoleta - subtotal;

    let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Boleta ${ventaId}</title>
        <style>
            body { font-family: monospace; max-width: 300px; margin:auto; padding:20px 10px; color: #000; }
            h2, h3, p { text-align:center; margin:3px 0; }
            hr { border: none; border-top: 1px dashed #000; margin:10px 0; }
            table { width:100%; border-collapse: collapse; font-size:12px; }
            th, td { padding:4px 2px; }
            td.right, th.right { text-align:right; }
            .totales p { display:flex; justify-content:space-between; margin:4px 0; font-size:13px; }
            .gracias { text-align:center; margin-top:15px; font-size:13px; font-weight: bold; }
            .btn-print { padding: 10px; background: #000; color: #fff; border: none; width: 100%; border-radius: 5px; margin-top: 15px; cursor: pointer;}
            .btn-outline { padding: 10px; background: transparent; border: 1px solid #000; color: #000; width: 100%; border-radius: 5px; margin-top: 10px; cursor: pointer; text-decoration: none; display: block; text-align: center; box-sizing: border-box;}
            @media print { .no-print { display:none; } }
        </style>
    </head>
    <body>
        <h2>🔧 FERRETERÍA</h2>
        <p>Tel: +56 9 1234 5678</p>
        <p>Dirección: Calle Principal 123</p>
        <hr>
        <h3>BOLETA N° ${ventaId}</h3>
        <p>${getFechaChile()}</p>
        <hr>
        <table>
            <tr><th style="text-align: left;">Prod</th><th class="right">Cant</th><th class="right">Total</th></tr>
            ${detalles.map(d => `<tr><td>${d.nombre}</td><td class="right">${d.cantidad}</td><td class="right">$${(d.precio * d.cantidad).toLocaleString('es-CL')}</td></tr>`).join('')}
        </table>
        <hr>
        <div class="totales">
            <p><span>Subtotal</span><span>$${subtotal.toLocaleString('es-CL')}</span></p>
            <p><span>IVA</span><span>$${iva.toLocaleString('es-CL')}</span></p>
            <p><strong>Total</strong><strong>$${totalBoleta.toLocaleString('es-CL')}</strong></p>
        </div>
        <hr>
        <div class="gracias">¡Gracias por su compra!</div>
        
        <div class="no-print">
            <button class="btn-print" onclick="window.print()">🖨 Imprimir Ticket</button>
            <form method="POST" action="/crear-despacho" style="margin-top: 10px;">
                <input type="hidden" name="venta_id" value="${ventaId}">
                <button class="btn-outline">🚚 Generar Despacho</button>
            </form>
            <br>
            <a href="/ventas" class="btn-outline" style="border-color: #64748b; color: #64748b;">🔙 Volver a Ventas</a>
        </div>
    </body>
    </html>`;
    res.send(html);
});

// ---------------------------------------------------------
// 📈 REPORTES
// ---------------------------------------------------------

app.get('/reportes', async (req, res) => {
    const content = `
    <div class="container">
        <header class="topbar">
            <h2>📈 Centro de Reportes</h2>
            <a href="/" class="btn-volver">⬅ Volver</a>
        </header>
        <div class="grid">
            <a class="card" href="/reportes/detalle">📋<br>Detalle de Ventas</a>
            <a class="card" href="/reportes/productos">🏆<br>Más Vendidos</a>
            <a class="card" href="/reportes/stock">⚠️<br>Stock Crítico</a>
        </div>
    </div>`;
    res.send(layout('Reportes', content));
});

app.get('/reportes/detalle', async (req,res)=>{
    const { fecha, mes } = req.query;
    let query = `SELECT v.id, v.fecha, v.total FROM ventas v WHERE 1=1`;
    let params = [];

    if (fecha) {
        params.push(fecha);
        query += ` AND DATE(v.fecha) = $${params.length}`;
    }
    if (mes) {
        params.push(mes);
        query += ` AND TO_CHAR(v.fecha, 'YYYY-MM') = $${params.length}`;
    }

    query += ` ORDER BY v.fecha DESC LIMIT 50`;
    const { rows } = await pool.query(query, params);

    let totalGeneral = 0;
    let rowsHtml = rows.map(v => {
        totalGeneral += Number(v.total);
        return `<tr><td>${v.id}</td><td>${new Date(v.fecha).toLocaleString('es-CL')}</td><td class="right">$${Number(v.total).toLocaleString('es-CL')}</td></tr>`;
    }).join('');

    const content = `
    <div class="container">
        <header class="topbar">
            <h2>📋 Detalle de Ventas</h2>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <form method="GET" action="/reportes/detalle" style="display:flex; gap:10px; margin:0;">
                    <input type="date" name="fecha" value="${fecha || ''}" style="margin:0;">
                    <input type="month" name="mes" value="${mes || ''}" style="margin:0;">
                    <button style="margin:0;">Filtrar</button>
                </form>
                <a href="/reportes" class="btn-volver">⬅ Volver</a>
            </div>
        </header>
        <div class="tabla-container">
            <table>
                <thead><tr><th>ID</th><th>Fecha</th><th class="right">Total</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr class="fila-total">
                        <td></td>
                        <td class="right"><strong>TOTAL</strong></td>
                        <td class="right"><strong>$${totalGeneral.toLocaleString('es-CL')}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>`;
    res.send(layout('Detalle Ventas', content));
});

app.get('/reportes/productos', async (req,res)=>{
    const { rows } = await pool.query(`
        SELECT nombre, SUM(cantidad) as total_vendidos FROM detalle_ventas 
        GROUP BY nombre ORDER BY total_vendidos DESC LIMIT 10
    `);
    let rowsHtml = rows.map(r => `<tr><td>${r.nombre}</td><td>${r.total_vendidos}</td></tr>`).join('');
    const content = `
    <div class="container" style="max-width: 800px;">
        <header class="topbar">
            <h2>🏆 Top 10 Más Vendidos</h2>
            <a href="/reportes" class="btn-volver">⬅ Volver</a>
        </header>
        <div class="tabla-container">
            <table>
                <thead><tr><th>Producto</th><th>Cantidad Vendida</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    </div>`;
    res.send(layout('Top Vendidos', content));
});

app.get('/reportes/stock', async (req,res)=>{
    const { rows } = await pool.query("SELECT * FROM productos WHERE stock <= 5 ORDER BY stock ASC");
    let rowsHtml = rows.map(p => `<tr><td>${p.nombre}</td><td><span class="stock-bajo">${p.stock}</span></td></tr>`).join('');
    const content = `
    <div class="container" style="max-width: 800px;">
        <header class="topbar">
            <h2>⚠️ Alerta de Stock Crítico</h2>
            <a href="/reportes" class="btn-volver">⬅ Volver</a>
        </header>
        <div class="tabla-container">
            <table>
                <thead><tr><th>Producto</th><th>Stock Disponible</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    </div>`;
    res.send(layout('Stock Crítico', content));
});

// ---------------------------------------------------------
// 🚚 LOGÍSTICA Y DESPACHOS
// ---------------------------------------------------------

app.get('/despacho', async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM despachos ORDER BY id DESC");

    let rowsHtml = rows.map(d => `
        <tr>
            <td>${d.id}</td>
            <td><strong>${d.cliente}</strong></td>
            <td>${d.direccion}<br><small style="color:#64748b;">📞 ${d.contacto || '-'}</small></td>
            <td>${d.fecha_entrega ? new Date(d.fecha_entrega).toLocaleDateString('es-CL') : '-'}</td>
            <td>${d.venta_id ? `<a href="/boleta/${d.venta_id}" target="_blank" style="color:#2563eb; text-decoration:none;">📄 Ver Boleta</a>` : d.pedido}</td>
            <td><span class="${d.estado === 'Pendiente' ? 'estado-pendiente' : d.estado === 'En ruta' ? 'estado-ruta' : 'estado-entregado'}">${d.estado}</span></td>
            <td style="white-space: nowrap;">
                <form method="POST" action="/despacho/estado/${d.id}" style="display:inline;">
                    <button style="padding:6px 10px; font-size:12px; background:#64748b;">Cambiar</button>
                </form>
                <form method="GET" action="/despacho/editar/${d.id}" style="display:inline;">
                    <button style="padding:6px 10px; font-size:12px; background:#f59e0b;">Editar</button>
                </form>
            </td>
        </tr>`).join('');

    const content = `
    <div class="container">
        <header class="topbar">
            <h2>🚚 Panel de Despachos</h2>
            <a href="/" class="btn-volver">⬅ Volver</a>
        </header>

        <section style="background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;padding-bottom: 15px; position: sticky; top: 115px; z-index: 90; background: #f1f5f9;""">
            <h4 style="margin: 0 0 15px 0;">+ Registrar Nuevo Despacho Manual</h4>
            <form method="POST" action="/despacho" onsubmit="setTimeout(()=>this.reset(),100)" style="display:flex; flex-wrap:wrap; gap:10px; align-items: center;">
                <input name="cliente" placeholder="Nombre del Cliente" required style="flex:1; min-width: 200px;">
                <input name="contacto" placeholder="Teléfono" style="flex:1; min-width: 150px;">
                <input name="direccion" placeholder="Dirección completa" required style="flex:2; min-width: 250px;">
                <input name="pedido" placeholder="Detalle (Ej: 2x Clavos)" required style="flex:2; min-width: 250px;">
                <input type="date" name="fecha_entrega" style="flex:1; min-width: 150px;">
                <button style="margin: 0;">Guardar Despacho</button>
            </form>
        </section>

        <div class="tabla-container">
            <table>
                <thead>
                    <tr><th>ID</th><th>Cliente</th><th>Destino</th><th>Fecha Entrega</th><th>Pedido</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    </div>`;
    res.send(layout('Despachos', content));
});

app.post('/despacho', async (req,res)=>{
    const { cliente, contacto, direccion, pedido, fecha_entrega } = req.body;
    await pool.query(
        "INSERT INTO despachos (cliente, contacto, direccion, pedido, fecha_entrega) VALUES ($1,$2,$3,$4,$5)",
        [cliente, contacto, direccion, pedido, fecha_entrega || null]
    );
    res.redirect('/despacho');
});

app.post('/despacho/estado/:id', async (req,res)=>{
    const { rows } = await pool.query("SELECT estado FROM despachos WHERE id=$1", [req.params.id]);
    let estado = rows[0].estado;
    if (estado === "Pendiente") estado = "En ruta";
    else if (estado === "En ruta") estado = "Entregado";
    else estado = "Pendiente";
    await pool.query("UPDATE despachos SET estado=$1 WHERE id=$2", [estado, req.params.id]);
    res.redirect('/despacho');
});

app.post('/crear-despacho', async (req,res)=>{
    const { venta_id } = req.body;
    const { rows } = await pool.query("SELECT nombre, cantidad FROM detalle_ventas WHERE venta_id = $1", [venta_id]);
    let pedido = rows.map(p => `${p.nombre} x${p.cantidad}`).join(', ');
    await pool.query("INSERT INTO despachos (venta_id, pedido, estado) VALUES ($1,$2,'Pendiente')", [venta_id, pedido]);
    res.redirect('/despacho');
});

app.get('/despacho/editar/:id', async (req,res)=>{
    const { rows } = await pool.query("SELECT * FROM despachos WHERE id=$1", [req.params.id]);
    const d = rows[0];
    const content = `
    <div class="container" style="max-width: 500px;">
        <header class="topbar">
            <h2>✏️ Editar Despacho</h2>
            <a href="/despacho" class="btn-volver">⬅ Volver</a>
        </header>
        <form method="POST" style="background: #fff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <label style="font-weight:bold; color:#475569;">Cliente:</label>
            <input name="cliente" value="${d.cliente || ''}" style="width:100%; margin-bottom:10px;">
            <label style="font-weight:bold; color:#475569;">Teléfono:</label>
            <input name="contacto" value="${d.contacto || ''}" style="width:100%; margin-bottom:10px;">
            <label style="font-weight:bold; color:#475569;">Dirección:</label>
            <input name="direccion" value="${d.direccion || ''}" style="width:100%; margin-bottom:10px;">
            <label style="font-weight:bold; color:#475569;">Pedido:</label>
            <input name="pedido" value="${d.pedido || ''}" style="width:100%; margin-bottom:10px;">
            <label style="font-weight:bold; color:#475569;">Fecha de Entrega:</label>
            <input type="date" name="fecha_entrega" value="${d.fecha_entrega ? d.fecha_entrega.toISOString().split('T')[0] : ''}" style="width:100%; margin-bottom:10px;">
            <label style="font-weight:bold; color:#475569;">Estado:</label>
            <select name="estado" style="width:100%; margin-bottom:20px;">
                <option ${d.estado==='Pendiente'?'selected':''}>Pendiente</option>
                <option ${d.estado==='En ruta'?'selected':''}>En ruta</option>
                <option ${d.estado==='Entregado'?'selected':''}>Entregado</option>
            </select>
            <button style="width:100%;">Actualizar Despacho</button>
        </form>
    </div>`;
    res.send(layout('Editar Despacho', content));
});

app.post('/despacho/editar/:id', async (req,res)=>{
    const { cliente, contacto, direccion, pedido, estado, fecha_entrega } = req.body;
    await pool.query(
        `UPDATE despachos SET cliente=$1, contacto=$2, direccion=$3, pedido=$4, estado=$5, fecha_entrega=$6 WHERE id=$7`,
        [cliente, contacto, direccion, pedido, estado, fecha_entrega || null, req.params.id]
    );
    res.redirect('/despacho');
});

// ---------------------------------------------------------
// 👷 PROVEEDORES
// ---------------------------------------------------------

app.get('/proveedores', async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM proveedores ORDER BY id DESC");

    let rowsHtml = rows.map(p => `
        <tr>
            <td>${p.id}</td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.empresa}</td>
            <td>${p.telefono}</td>
            <td>${p.observacion}</td>
            <td>
                <form method="POST" action="/proveedores/eliminar/${p.id}" style="display:inline;" onsubmit="return confirm('¿Eliminar proveedor?')">
                    <button style="background:#ef4444; padding:6px 12px; font-size:13px;">🗑️ Eliminar</button>
                </form>
            </td>
        </tr>`).join('');

    const content = `
    <div class="container">
        <header class="topbar">
            <h2>👷 Directorio de Proveedores</h2>
            <a href="/" class="btn-volver">⬅ Volver</a>
        </header>

        <section style="background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;padding-bottom: 15px; position: sticky; top: 115px; z-index: 90; background: #f1f5f9;">
            <h4 style="margin: 0 0 15px 0;">+ Añadir Proveedor</h4>
            <form method="POST" action="/proveedores" onsubmit="setTimeout(()=>this.reset(),100)" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                <input name="nombre" placeholder="Nombre Contacto" required style="flex:1; min-width: 200px;">
                <input name="empresa" placeholder="Empresa" required style="flex:1; min-width: 200px;">
                <input name="telefono" placeholder="Teléfono" style="flex:1; min-width: 150px;">
                <input name="observacion" placeholder="Observaciones" style="flex:2; min-width: 250px;">
                <button style="margin: 0;">Guardar</button>
            </form>
        </section>

        <input id="buscar" placeholder="🔍 Buscar proveedor por nombre o empresa..." style="width: 100%; margin-bottom: 10px;">
        
        <div class="tabla-container">
            <table id="tabla">
                <thead><tr><th>ID</th><th>Nombre</th><th>Empresa</th><th>Teléfono</th><th>Observación</th><th>Acción</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    </div>`;

    const script = `
    <script>
        document.getElementById("buscar").onkeyup = function(){
            let f = this.value.toLowerCase();
            document.querySelectorAll("#tabla tbody tr").forEach(r => {
                r.style.display = r.innerText.toLowerCase().includes(f) ? "" : "none";
            });
        };
    </script>`;

    res.send(layout('Proveedores', content, script));
});

app.post('/proveedores', async (req, res) => {
    const { nombre, empresa, telefono, observacion } = req.body;
    await pool.query("INSERT INTO proveedores (nombre, empresa, telefono, observacion) VALUES ($1,$2,$3,$4)", [nombre, empresa, telefono, observacion]);
    res.redirect('/proveedores');
});

app.post('/proveedores/eliminar/:id', async (req,res)=>{
    await pool.query("DELETE FROM proveedores WHERE id=$1",[req.params.id]);
    res.redirect('/proveedores');
});

// ---------------------------------------------------------
// 🚀 INICIO DEL SERVIDOR
// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));