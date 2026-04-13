const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');

const app = express();

function getFechaChile() {
    return new Date().toLocaleString('es-CL', {
        timeZone: 'America/Santiago',
        hour12: false
    });
}

// 🔥 BODY
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔐 SESIONES
app.use(session({
    secret: 'ferreteria-secreta',
    resave: false,
    saveUninitialized: false
}));

// 👤 USUARIO SIMPLE
const USER = {
    username: "admin",
    password: "1234"
};

// 🔌 POSTGRES (RENDER)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 🔥 TEST DB
pool.connect()
.then(() => console.log("✅ DB conectada"))
.catch(err => console.error("❌ Error DB:", err.message));

// 📦 TABLA
(async () => {
    try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS productos (
            id SERIAL PRIMARY KEY,
            nombre TEXT,
            precio INTEGER,
            stock INTEGER
        )
        `);
    } catch (err) {
        console.error(err.message);
    }
})();

// 🔗 COLUMNA venta_id EN DESPACHOS
(async () => {
    try {
        await pool.query(`
        ALTER TABLE despachos
        ADD COLUMN IF NOT EXISTS venta_id INTEGER
        `);

        console.log("✅ Columna venta_id lista");
    } catch (err) {
        console.error("❌ Error venta_id:", err.message);
    }
})();

// 📅 COLUMNA fecha_entrega EN DESPACHOS
(async () => {
    try {
        await pool.query(`
        ALTER TABLE despachos
        ADD COLUMN IF NOT EXISTS fecha_entrega DATE
        `);

        console.log("✅ Columna fecha_entrega lista");
    } catch (err) {
        console.error("❌ Error fecha_entrega:", err.message);
    }
})();

// 🧾 TABLAS DE VENTAS
(async () => {
    try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS ventas (
            id SERIAL PRIMARY KEY,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total INTEGER
        )
        `);

        await pool.query(`
        CREATE TABLE IF NOT EXISTS detalle_ventas (
            id SERIAL PRIMARY KEY,
            venta_id INTEGER,
            producto_id INTEGER,
            nombre TEXT,
            precio INTEGER,
            cantidad INTEGER
        )
        `);

        console.log("✅ Tablas de ventas listas");
    } catch (err) {
        console.error("❌ Error creando tablas de ventas:", err.message);
    }
})();

// 🚚 TABLA DESPACHOS
(async () => {
    try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS despachos (
            id SERIAL PRIMARY KEY,
            cliente TEXT,
            direccion TEXT,
            pedido TEXT,
            estado TEXT DEFAULT 'Pendiente',
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `);

        console.log("✅ Tabla despachos lista");
    } catch (err) {
        console.error("❌ Error despachos:", err.message);
    }

    
})();

(async () => {
    try {
        await pool.query(`
        ALTER TABLE despachos
        ADD COLUMN IF NOT EXISTS contacto TEXT
        `);

        console.log("✅ Columna contacto lista");
    } catch (err) {
        console.error("❌ Error contacto:", err.message);
    }
})();

// 🎨 ESTILO
const estilo = `
<style>
body { margin:0; font-family: Arial; background:#f1f5f9; color:#1e293b; }
.container { padding:25px; }
h1 { text-align:center; }
.grid {display:grid;grid-template-columns: repeat(3, 1fr);gap:20px;}
/* 📱 celular */
@media (max-width: 768px) {
    .grid {
        grid-template-columns: repeat(1, 1fr);
    }
}
.card { background:white; padding:30px; border-radius:15px; text-align:center; text-decoration:none; color:#1e293b; font-size:18px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.08); transition:0.2s; }
.card:hover { transform:scale(1.05); }
input { padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin:5px; }
button { padding:10px 15px; border:none; border-radius:8px; background:#2563eb; color:white; cursor:pointer; font-weight:bold; }
button:hover { background:#1d4ed8; }
table { width:100%; border-collapse:collapse; margin-top:20px; background:white; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.05); }
th { background:#e2e8f0; padding:12px; }
td { padding:10px; text-align:center; }
tr:nth-child(even) { background:#f8fafc; }
.stock-bajo { color:#dc2626; font-weight:bold; }
.topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; }
.btn-volver { background:#e2e8f0; color:#1e293b; padding:8px 14px; border-radius:8px; text-decoration:none; font-weight:bold; transition:0.2s; }
.btn-volver:hover { background:#cbd5e1; transform:scale(1.05); }
table td:nth-child(2), table th:nth-child(2) { text-align: left; padding-left: 15px; }
.right { text-align:right; }
.login-box { max-width:400px; margin:80px auto; background:white; padding:30px; border-radius:15px; box-shadow:0 4px 10px rgba(0,0,0,0.08); text-align:center; }

.estado-pendiente {
    color: #dc2626;
    font-weight: bold;
}

.estado-ruta {
    color: #ca8a04;
    font-weight: bold;
}

.estado-entregado {
    color: #16a34a;
    font-weight: bold;
}

</style>
`;

// 🔐 LOGIN
app.get('/login', (req, res) => {
    res.send(`
    <html><head>${estilo}</head><body>
    <div class="login-box">
        <h2>🔐 Iniciar Sesión</h2>
        <form method="POST">
            <input name="username" placeholder="Usuario">
            <input name="password" type="password" placeholder="Contraseña">
            <button>Ingresar</button>
        </form>
    </div>
    </body></html>
    `);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === USER.username && password === USER.password) {
        req.session.user = username;
        return res.redirect('/');
    }

    res.send("❌ Usuario o contraseña incorrecta");
});

// 🚪 LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// 🛡️ PROTECCIÓN GLOBAL
app.use((req, res, next) => {
    if (req.path === '/login') return next();
    if (!req.session.user) return res.redirect('/login');
    next();
});

// 🏠 HOME
app.get('/', (req, res) => {
    res.send(`
    <html><head>${estilo}</head><body>
    <div class="container">
        <div class="topbar">
            <h1>🔧 Ferretería</h1>
            <a href="/logout" class="btn-volver">Cerrar sesión</a>
        </div>
        <div class="grid">
            <a class="card" href="/inventario">📦 Productos</a>
            <a class="card" href="/productos">📊 Inventario</a>
            <a class="card" href="/ventas">💰 Ventas</a>
            <a class="card" href="/reportes">📈 Reportes</a>
            <a class="card" href="/despacho">🚚 Despacho</a>
        </div>
    </div>
    </body></html>
    `);
});

// 📦 INVENTARIO
app.get('/inventario', async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM productos ORDER BY id ASC");

    let html = `
    <html><head>${estilo}</head><body>
    <div class="container">
    <div class="topbar">
        <h2>Productos</h2>
        <a href="/" class="btn-volver">⬅ Volver</a>
    </div>
    <input id="buscar" placeholder="Buscar...">
    <h3>Agregar producto</h3>
    <form method="POST" action="/agregar" autocomplete="off" onsubmit="setTimeout(()=>this.reset(),100)">
        <input name="nombre" placeholder="Nombre">
        <input name="precio" type="number" placeholder="Precio">
        <input name="stock" type="number" placeholder="Stock">
        <button>Agregar</button>
    </form>
    <table id="tabla">
    <tr>
        <th>ID</th>
        <th>Nombre</th>
        <th>Precio</th>
        <th>Stock</th>
        <th>Acciones</th>
    </tr>`;

    rows.forEach(p => {
        html += `
        <tr>
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock}</td>
            <td>
                <form method="GET" action="/editar/${p.id}" style="display:inline;">
                    <button>Editar</button>
                </form>
                <form method="POST" action="/eliminar/${p.id}" style="display:inline;">
                    <button style="background:#dc2626;">Eliminar</button>
                </form>
            </td>
        </tr>`;
    });

    html += `</table>
    <script>
    document.getElementById("buscar").onkeyup = function(){
        let f = this.value.toLowerCase();
        document.querySelectorAll("#tabla tr").forEach((r,i)=>{
            if(i==0) return;
            r.style.display = r.innerText.toLowerCase().includes(f) ? "" : "none";
        });
    };
    </script>
    </div></body></html>`;

    res.send(html);
});

// 📊 PRODUCTOS
app.get('/productos', async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM productos");

    let html = `
    <html><head>${estilo}</head><body>
    <div class="container">
    <div class="topbar">
        <h2>Inventario</h2>
        <a href="/" class="btn-volver">⬅ Volver</a>
    </div>
    <input id="buscar" placeholder="Buscar...">
    <button onclick="excel()">Exportar Excel</button>
    <table id="tabla">
    <tr>
        <th>ID</th>
        <th>Nombre</th>
        <th>Precio</th>
        <th>Stock</th>
    </tr>`;

    rows.forEach(p => {
        html += `
        <tr>
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock}</td>
        </tr>`;
    });

    html += `</table>
    <script>
    document.getElementById("buscar").onkeyup = function(){
        let f = this.value.toLowerCase();
        document.querySelectorAll("#tabla tr").forEach((r,i)=>{
            if(i==0) return;
            r.style.display = r.innerText.toLowerCase().includes(f) ? "" : "none";
        });
    };
    function excel(){
        let blob = new Blob([document.getElementById("tabla").outerHTML], {type:"application/vnd.ms-excel"});
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "productos.xls";
        a.click();
    }
    </script>
    </div></body></html>`;

    res.send(html);
});

// 💰 VENTAS (COMPLETO)
app.get('/ventas', async (req, res) => {
    const { rows: productos } = await pool.query("SELECT * FROM productos");

    let filas = '';
    productos.forEach(p => {
        filas += `
        <tr onclick='seleccionar(${p.id}, ${JSON.stringify(p.nombre)}, ${p.precio}, ${p.stock})'>
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock}</td>
        </tr>`;
    });

    res.send(`
<html><head>${estilo}</head><body>
<div class="container">
<div class="topbar">
<h2>💰 Ventas</h2>
<a href="/" class="btn-volver">⬅ Volver</a>
</div>

<input id="buscar" placeholder="Buscar producto...">
<table id="tabla">
<tr><th>ID</th><th>Producto</th><th>Precio</th><th>Stock</th></tr>
${filas}
</table>

<h3>🧾 Detalle de Venta</h3>
<input id="nombre" disabled>
<input id="precio" disabled>
<input id="cantidad" type="number">
<button onclick="agregarAlCarrito()">Agregar al carrito</button>

<table id="carrito">
<tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th><th>Acción</th></tr>
</table>

<strong>Total: $<span id="total">0</span></strong><br><br>
<button onclick="confirmarVenta()">Confirmar Venta</button>

<script>
let carrito = [];
let productoSeleccionado = null;

function seleccionar(id,nombre,precio,stock){
productoSeleccionado={id,nombre,precio,stock};
document.getElementById("nombre").value=nombre;
document.getElementById("precio").value="$"+precio.toLocaleString('es-CL');
document.getElementById("cantidad").value="";
}

function agregarAlCarrito(){
let cant=parseInt(document.getElementById("cantidad").value)||0;
if(!productoSeleccionado)return alert("Selecciona un producto");
if(cant<=0)return alert("Cantidad inválida");
if(cant>productoSeleccionado.stock)return alert("Stock insuficiente");

let existente=carrito.find(p=>p.id===productoSeleccionado.id);

if(existente){
if(existente.cantidad+cant>productoSeleccionado.stock)return alert("Stock insuficiente");
existente.cantidad+=cant;
}else{
carrito.push({...productoSeleccionado,cantidad:cant});
}

actualizarTabla();

document.getElementById("nombre").value="";
document.getElementById("precio").value="";
document.getElementById("cantidad").value="";
productoSeleccionado=null;
}

function actualizarTabla(){
let tabla=document.getElementById("carrito");
tabla.innerHTML='<tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th><th>Acción</th></tr>';
let total=0;

carrito.forEach((p,i)=>{
let totalFila=p.precio*p.cantidad;
total+=totalFila;

tabla.innerHTML+=\`
<tr>
<td>\${p.nombre}</td>
<td class="right">\${p.cantidad}</td>
<td class="right">$\${p.precio.toLocaleString('es-CL')}</td>
<td class="right">$\${totalFila.toLocaleString('es-CL')}</td>
<td><button onclick='eliminar(\${i})'>❌</button></td>
</tr>\`;
});

document.getElementById("total").innerText=total.toLocaleString('es-CL');
}

function eliminar(i){
carrito.splice(i,1);
actualizarTabla();
}

function confirmarVenta(){
if(carrito.length===0)return alert("No hay productos");

let form=document.createElement("form");
form.method="POST";
form.action="/ventas";

carrito.forEach(p=>{
let id=document.createElement("input");
id.type="hidden"; id.name="producto_id[]"; id.value=p.id;
form.appendChild(id);

let c=document.createElement("input");
c.type="hidden"; c.name="cantidad[]"; c.value=p.cantidad;
form.appendChild(c);
});

document.body.appendChild(form);
form.submit();
}

document.getElementById("buscar").onkeyup=function(){
let f=this.value.toLowerCase();
document.querySelectorAll("#tabla tr").forEach((r,i)=>{
if(i==0)return;
r.style.display=r.innerText.toLowerCase().includes(f)?"":"none";
});
};
</script>
</body></html>
`);
});

// 📈 REPORTES
app.get('/reportes', async (req, res) => {

    const { fecha, mes } = req.query;

    let queryVentas = `
    SELECT COUNT(*) as cantidad, COALESCE(SUM(total),0) as total
    FROM ventas
    WHERE 1=1
`;

let params = [];

// 📅 FILTRO POR DÍA
if (fecha) {
    params.push(fecha);
    queryVentas += ` AND DATE(fecha) = $${params.length}`;
}

// 📆 FILTRO POR MES
if (mes) {
    params.push(mes);
    queryVentas += ` AND TO_CHAR(fecha, 'YYYY-MM') = $${params.length}`;
}

// 🔥 SI NO HAY FILTRO → HOY
if (!fecha && !mes) {
    queryVentas += ` AND DATE(fecha) = CURRENT_DATE`;
}

const ventasHoy = await pool.query(queryVentas, params);

    const productosBajoStock = await pool.query(`
        SELECT * FROM productos
        WHERE stock < 5
        ORDER BY stock ASC
    `);

    const ultimasVentas = await pool.query(`
        SELECT * FROM ventas
        ORDER BY fecha DESC
        LIMIT 10
    `);

    let html = `
    <html><head>${estilo}</head><body>
    <div class="container">

    <div class="topbar">
        <h2>📈 Reportes</h2>
        <form method="GET" action="/reportes">
    <label>📅 Día:</label>
    <input type="date" name="fecha">

    <label>📆 Mes:</label>
    <input type="month" name="mes">

    <button>Filtrar</button>
</form>
        <a href="/" class="btn-volver">⬅ Volver</a>
    </div>
    <div class="grid" style="margin-bottom:20px;">
    <a class="card" href="/reportes/detalle">📋 Detalle ventas</a>
    <a class="card" href="/reportes/productos">🏆 Más vendidos</a>
    <a class="card" href="/reportes/stock">⚠️ Stock crítico</a>
</div>

    </div>
    </body>
    </html>
    `;

    res.send(html);
});

// 📋 DETALLE DE VENTAS
app.get('/reportes/detalle', async (req,res)=>{

    const { fecha, mes } = req.query;

   let query = `
    SELECT v.id, v.fecha, v.total
    FROM ventas v
    WHERE 1=1
`;

let params = [];

// 📅 filtro por día
if (fecha) {
    params.push(fecha);
    query += ` AND DATE(v.fecha) = $${params.length}`;
}

// 📆 filtro por mes
if (mes) {
    params.push(mes);
    query += ` AND TO_CHAR(v.fecha, 'YYYY-MM') = $${params.length}`;
}

// orden final
query += ` ORDER BY v.fecha DESC LIMIT 50`;

const { rows } = await pool.query(query, params);

    let html = `
    <html><head>${estilo}</head><body>
    <div class="container">

    <div class="topbar">
        <h2>📋 Detalle de ventas</h2>

                <form method="GET" action="/reportes">
    <label>📅 Día:</label>
    <input type="date" name="fecha">

    <label>📆 Mes:</label>
    <input type="month" name="mes">

    <button>Filtrar</button>
</form>

        <a href="/reportes" class="btn-volver">⬅ Volver</a>
    </div>

    <table>
    <tr><th>ID</th><th>Fecha</th><th>Total</th></tr>
    `;

    rows.forEach(v=>{
        html += `
        <tr>
            <td>${v.id}</td>
            <td>${new Date(v.fecha).toLocaleString('es-CL')}</td>
            <td>$${Number(v.total).toLocaleString('es-CL')}</td>
        </tr>`;
    });

    html += `</table></div></body></html>`;

    res.send(html);
});

// 🏆 MÁS VENDIDOS
app.get('/reportes/productos', async (req,res)=>{

    const { rows } = await pool.query(`
        SELECT nombre, SUM(cantidad) as total_vendidos
        FROM detalle_ventas
        GROUP BY nombre
        ORDER BY total_vendidos DESC
        LIMIT 10
    `);

    let html = `
    <html><head>${estilo}</head><body>
    <div class="container">

    <div class="topbar">
        <h2>🏆 Más vendidos</h2>
        <a href="/reportes" class="btn-volver">⬅ Volver</a>
    </div>

    <table>
    <tr><th>Producto</th><th>Cantidad</th></tr>
    `;

    rows.forEach(r=>{
        html += `
        <tr>
            <td>${r.nombre}</td>
            <td>${r.total_vendidos}</td>
        </tr>`;
    });

    html += `</table></div></body></html>`;

    res.send(html);
});

// ⚠️ STOCK CRÍTICO
app.get('/reportes/stock', async (req,res)=>{

    const { rows } = await pool.query(`
        SELECT * FROM productos
        WHERE stock <= 5
        ORDER BY stock ASC
    `);

    let html = `
    <html><head>${estilo}</head><body>
    <div class="container">

    <div class="topbar">
        <h2>⚠️ Stock crítico</h2>
        <a href="/reportes" class="btn-volver">⬅ Volver</a>
    </div>

    <table>
    <tr><th>Producto</th><th>Stock</th></tr>
    `;

    rows.forEach(p=>{
        html += `
        <tr>
            <td>${p.nombre}</td>
            <td class="stock-bajo">${p.stock}</td>
        </tr>`;
    });

    html += `</table></div></body></html>`;

    res.send(html);
});

// 💰 POST ventas
app.post('/ventas', async (req,res)=>{

    const ids = Array.isArray(req.body.producto_id)?req.body.producto_id:[req.body.producto_id];
    const cant = Array.isArray(req.body.cantidad)?req.body.cantidad:[req.body.cantidad];

    let detalles = [];

    // 🧾 CREAR VENTA
    const ventaResult = await pool.query(
        "INSERT INTO ventas (total) VALUES ($1) RETURNING id",
        [0]
    );

    const ventaId = ventaResult.rows[0].id;

    // 🔄 RECORRER PRODUCTOS
    for (let i = 0; i < ids.length; i++) {

        const { rows } = await pool.query(
            "SELECT * FROM productos WHERE id = $1",
            [ids[i]]
        );

        const p = rows[0];
        if (!p) continue;

        let cantidad = parseInt(cant[i]);
        if(cantidad > p.stock) cantidad = p.stock;

        // 🔻 DESCONTAR STOCK
        await pool.query(
            "UPDATE productos SET stock = stock - $1 WHERE id = $2",
            [cantidad, ids[i]]
        );

        // 💾 GUARDAR DETALLE
        await pool.query(
            `INSERT INTO detalle_ventas 
            (venta_id, producto_id, nombre, precio, cantidad)
            VALUES ($1,$2,$3,$4,$5)`,
            [ventaId, p.id, p.nombre, p.precio, cantidad]
        );

        detalles.push({
            nombre: p.nombre,
            precio: p.precio,
            cantidad
        });
    }

    // 💰 CALCULAR TOTAL
    let totalBoleta = 0;
    detalles.forEach(d=>{
        totalBoleta += d.precio * d.cantidad;
    });

    let subtotal = Math.round(totalBoleta / 1.19);
    let iva = totalBoleta - subtotal;

    // 🧾 ACTUALIZAR TOTAL
    await pool.query(
        "UPDATE ventas SET total = $1 WHERE id = $2",
        [totalBoleta, ventaId]
    );

    // 🧾 HTML BOLETA TIPO TICKET
    let html = `
    <html>
    <head>
    <style>
    body {
        font-family: monospace;
        max-width: 300px;
        margin:auto;
        padding:10px;
    }

    h2, h3, p {
        text-align:center;
        margin:3px 0;
    }

    hr {
        border: none;
        border-top: 1px dashed #000;
        margin:8px 0;
    }

    table {
        width:100%;
        border-collapse: collapse;
        font-size:12px;
    }

    th, td {
        padding:3px;
    }

    td.right {
        text-align:right;
    }

    .totales p {
        display:flex;
        justify-content:space-between;
        margin:2px 0;
        font-size:13px;
    }

    .gracias {
        text-align:center;
        margin-top:10px;
        font-size:13px;
    }

    button {
        width:100%;
        margin-top:10px;
    }

    @media print {
        button { display:none; }
    }
    </style>
    </head>
    <body>

    <h2>🔧 FERRETERÍA LOS NOGALES</h2>
    <p>Tel: +56 9 1234 5678</p>
    <p>Dirección: Calle Principal 123</p>

    <hr>

    <h3>BOLETA N° ${ventaId}</h3>
    <p>${getFechaChile()}</p>

    <hr>

    <table>
    <tr>
        <th>Prod</th>
        <th>Cant</th>
        <th>Total</th>
    </tr>
    `;

    detalles.forEach(d=>{
        let totalFila = d.precio * d.cantidad;
        html += `
        <tr>
            <td>${d.nombre}</td>
            <td class="right">${d.cantidad}</td>
            <td class="right">$${totalFila.toLocaleString('es-CL')}</td>
        </tr>
        `;
    });

    html += `
    </table>

    <hr>

    <div class="totales">
        <p><span>Subtotal</span><span>$${subtotal.toLocaleString('es-CL')}</span></p>
        <p><span>IVA</span><span>$${iva.toLocaleString('es-CL')}</span></p>
        <p><strong>Total</strong><strong>$${totalBoleta.toLocaleString('es-CL')}</strong></p>
    </div>

    <hr>

    <div class="gracias">
        ¡Gracias por su compra!
    </div>

    <button onclick="window.print()">🖨 Imprimir</button>
<form method="POST" action="/crear-despacho">
    <input type="hidden" name="venta_id" value="${ventaId}">
    <button>🚚 Crear despacho</button>
</form>

    <br><br>
<a href="/ventas"><button>🔙 Nueva venta</button></a>

    </body>
    </html>
    `;

    res.send(html);
});

// CRUD
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

res.send(`
<html><head>${estilo}</head><body>
<div class="container">
<div class="topbar">
<h2>Editar producto</h2>
<a href="/inventario" class="btn-volver">⬅ Volver</a>
</div>
<form method="POST">
<input name="nombre" value="${p.nombre}">
<input name="precio" value="${p.precio}">
<input name="stock" value="${p.stock}">
<button>Guardar</button>
</form>
</div></body></html>
`);
});

app.post('/editar/:id', async (req,res)=>{
const {nombre,precio,stock}=req.body;
await pool.query(
"UPDATE productos SET nombre=$1,precio=$2,stock=$3 WHERE id=$4",
[nombre,precio,stock,req.params.id]
);
res.redirect('/inventario');
});

// 🚚 DESPACHO
app.get('/despacho', async (req, res) => {

    const { rows } = await pool.query("SELECT * FROM despachos ORDER BY id DESC");

    let html = `
    <html><head>${estilo}</head><body>
    <div class="container">

    <div class="topbar">
        <h2>🚚 Despacho</h2>
        <a href="/" class="btn-volver">⬅ Volver</a>
    </div>

    <h3>Nuevo despacho</h3>
    <form method="POST" action="/despacho">
        <input name="cliente" placeholder="Cliente">
        <input name="direccion" placeholder="Dirección">
        <input name="contacto" placeholder="Contacto">
        <input name="pedido" placeholder="Detalle pedido">
        <input type="date" name="fecha_entrega">
        <button>Guardar</button>
    </form>

    <table>
    <tr>
        <th>ID</th>
        <th>Cliente</th>
        <th>Dirección</th>
        <th>Contacto</th>
        <th>Fecha Entrega</th>
        <th>Pedido</th>
        <th>Estado</th>
        <th>Acción</th>
    </tr>
    `;

    rows.forEach(d => {
        html += `
        <tr>
            <td>${d.id}</td>
            <td>${d.cliente}</td>
            <td>${d.direccion}</td>
            <td>${d.contacto || ''}</td>
            <td>
    ${d.fecha_entrega 
        ? new Date(d.fecha_entrega).toLocaleDateString('es-CL') 
        : '-'}
</td>
            <td>
    ${d.venta_id ? `
        <a href="/boleta/${d.venta_id}" target="_blank">
            <button>🧾 Ver</button>
        </a>
    ` : 'Sin boleta'}
</td>
            <td class="${
    d.estado === 'Pendiente' ? 'estado-pendiente' :
    d.estado === 'En ruta' ? 'estado-ruta' :
    'estado-entregado'
}">
    ${d.estado}
</td>
            <td>
    <form method="POST" action="/despacho/estado/${d.id}" style="display:inline;">
        <button>Cambiar</button>
    </form>

    <form method="GET" action="/despacho/editar/${d.id}" style="display:inline;">
        <button>Editar</button>
    </form>
</td>
        </tr>`;
    });

    html += `
    </table>
    </div></body></html>
    `;

    res.send(html);
});

app.post('/despacho', async (req,res)=>{
    const { cliente, contacto, direccion, pedido, fecha_entrega } = req.body;

    await pool.query(
        "INSERT INTO despachos (cliente, contacto, direccion, pedido, fecha_entrega) VALUES ($1,$2,$3,$4,$5)",
        [cliente, contacto, direccion, pedido, fecha_entrega]
    );

    res.redirect('/despacho');
});

app.post('/despacho/estado/:id', async (req,res)=>{

    const { rows } = await pool.query(
        "SELECT estado FROM despachos WHERE id=$1",
        [req.params.id]
    );

    let estado = rows[0].estado;

    if (estado === "Pendiente") estado = "En ruta";
    else if (estado === "En ruta") estado = "Entregado";
    else estado = "Pendiente";

    await pool.query(
        "UPDATE despachos SET estado=$1 WHERE id=$2",
        [estado, req.params.id]
    );

    res.redirect('/despacho');
});

// 🚚 CREAR DESPACHO DESDE VENTA
app.post('/crear-despacho', async (req,res)=>{

    const { venta_id } = req.body;
    const ventaId = venta_id;

    // traer detalle de venta
    const { rows } = await pool.query(
        "SELECT nombre, cantidad FROM detalle_ventas WHERE venta_id = $1",
        [ventaId]
    );

    // armar texto del pedido
    let pedido = rows.map(p => `${p.nombre} x${p.cantidad}`).join(', ');

    // guardar despacho
    await pool.query(
        "INSERT INTO despachos (venta_id, pedido, estado) VALUES ($1,$2,'Pendiente')",
        [ventaId, pedido]
    );

    res.redirect('/despacho');
});

// ✏️ EDITAR DESPACHO (FORMULARIO)
app.get('/despacho/editar/:id', async (req,res)=>{

    const { rows } = await pool.query(
        "SELECT * FROM despachos WHERE id=$1",
        [req.params.id]
    );

    const d = rows[0];

    res.send(`
    <html><head>${estilo}</head><body>
    <div class="container">

    <div class="topbar">
        <h2>✏️ Editar despacho</h2>
        <a href="/despacho" class="btn-volver">⬅ Volver</a>
    </div>

    <form method="POST">
        <input name="cliente" value="${d.cliente || ''}" placeholder="Cliente">
        <input name="contacto" value="${d.contacto || ''}" placeholder="Contacto">
        <input name="direccion" value="${d.direccion || ''}" placeholder="Dirección">
        <input name="pedido" value="${d.pedido || ''}" placeholder="Pedido">
        <input type="date" name="fecha_entrega" value="${d.fecha_entrega ? d.fecha_entrega.toISOString().split('T')[0] : ''}">

        <select name="estado">
            <option ${d.estado==='Pendiente'?'selected':''}>Pendiente</option>
            <option ${d.estado==='En ruta'?'selected':''}>En ruta</option>
            <option ${d.estado==='Entregado'?'selected':''}>Entregado</option>
        </select>

        <button>Guardar cambios</button>
    </form>

    </div></body></html>
    `);
});

// 💾 GUARDAR CAMBIOS
app.post('/despacho/editar/:id', async (req,res)=>{

    const { cliente, contacto, direccion, pedido, estado, fecha_entrega } = req.body;

    await pool.query(
        `UPDATE despachos 
        SET cliente=$1, contacto=$2, direccion=$3, pedido=$4, estado=$5, fecha_entrega=$6
        WHERE id=$7`,
        [cliente, contacto, direccion, pedido, estado, fecha_entrega, req.params.id]
    );

    res.redirect('/despacho');
});

// 🧾 VER BOLETA DESDE DESPACHO
app.get('/boleta/:id', async (req,res)=>{

    const ventaId = req.params.id;

    // 🧾 TRAER DETALLE
    const { rows: detalles } = await pool.query(
        "SELECT * FROM detalle_ventas WHERE venta_id=$1",
        [ventaId]
    );

    let totalBoleta = 0;

    detalles.forEach(d=>{
        totalBoleta += d.precio * d.cantidad;
    });

    let subtotal = Math.round(totalBoleta / 1.19);
    let iva = totalBoleta - subtotal;

    let html = `
    <html>
    <head>
    <style>
    body {
        font-family: monospace;
        max-width: 300px;
        margin:auto;
        padding:10px;
    }

    h2, h3, p {
        text-align:center;
        margin:3px 0;
    }

    hr {
        border: none;
        border-top: 1px dashed #000;
        margin:8px 0;
    }

    table {
        width:100%;
        border-collapse: collapse;
        font-size:12px;
    }

    th, td {
        padding:3px;
    }

    td.right {
        text-align:right;
    }

    .totales p {
        display:flex;
        justify-content:space-between;
        margin:2px 0;
        font-size:13px;
    }

    .gracias {
        text-align:center;
        margin-top:10px;
        font-size:13px;
    }

    button {
        width:100%;
        margin-top:10px;
    }

    @media print {
        button { display:none; }
    }
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
    <tr>
        <th>Prod</th>
        <th>Cant</th>
        <th>Total</th>
    </tr>
    `;

    detalles.forEach(d=>{
        let totalFila = d.precio * d.cantidad;
        html += `
        <tr>
            <td>${d.nombre}</td>
            <td class="right">${d.cantidad}</td>
            <td class="right">$${totalFila.toLocaleString('es-CL')}</td>
        </tr>
        `;
    });

    html += `
    </table>

    <hr>

    <div class="totales">
        <p><span>Subtotal</span><span>$${subtotal.toLocaleString('es-CL')}</span></p>
        <p><span>IVA</span><span>$${iva.toLocaleString('es-CL')}</span></p>
        <p><strong>Total</strong><strong>$${totalBoleta.toLocaleString('es-CL')}</strong></p>
    </div>

    <hr>

    <div class="gracias">
        ¡Gracias por su compra!
    </div>

    <button onclick="window.print()">🖨 Imprimir</button>

    <br><br>
    <a href="/despacho"><button>⬅ Volver</button></a>

    </body>
    </html>
    `;

    res.send(html);
});

// 🚀 SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{ console.log(`Servidor corriendo en puerto ${PORT}`); });