const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');

const app = express();

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

    <h3>💰 Ventas de Hoy</h3>
    <p><strong>Cantidad:</strong> ${ventasHoy.rows[0].cantidad}</p>
    <p><strong>Total:</strong> $${Number(ventasHoy.rows[0].total).toLocaleString('es-CL')}</p>

    <h3>⚠️ Productos con Bajo Stock</h3>
    <table>
    <tr><th>Producto</th><th>Stock</th></tr>
    `;

    productosBajoStock.rows.forEach(p => {
        html += `
        <tr>
            <td>${p.nombre}</td>
            <td class="stock-bajo">${p.stock}</td>
        </tr>`;
    });

    html += `</table>

    <h3>🧾 Últimas Ventas</h3>
    <table>
    <tr><th>ID</th><th>Fecha</th><th>Total</th></tr>
    `;

    ultimasVentas.rows.forEach(v => {
        html += `
        <tr>
            <td>${v.id}</td>
            <td>${new Date(v.fecha).toLocaleString('es-CL')}</td>
            <td>$${Number(v.total).toLocaleString('es-CL')}</td>
        </tr>`;
    });

    html += `
    </table>

    </div></body></html>
    `;

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
    <p>${new Date().toLocaleString('es-CL')}</p>

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

// 🚀 SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{ console.log(`Servidor corriendo en puerto ${PORT}`); });