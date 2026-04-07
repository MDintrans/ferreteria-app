const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.urlencoded({ extended: true }));

// 🔌 POSTGRES (Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 📦 TABLA
(async () => {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre TEXT,
        precio INTEGER,
        stock INTEGER
    )
    `);
})();

// 🎨 ESTILO (igual)
const estilo = `
<style>
body { margin:0; font-family: Arial; background:#f1f5f9; color:#1e293b; }
.container { padding:25px; }
h1 { text-align:center; }
.grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:20px; }
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
/* Alinear columna Nombre a la izquierda */
table td:nth-child(2), table th:nth-child(2) { text-align: left; padding-left: 15px; }
.right { text-align:right; }
</style>
`;

// 🏠 HOME
app.get('/', (req, res) => {
    res.send(`
    <html><head>${estilo}</head><body>
    <div class="container">
        <h1>🔧 Ferretería</h1>
        <div class="grid">
            <a class="card" href="/inventario">📦 Productos</a>
            <a class="card" href="/productos">📊 Inventario</a>
            <a class="card" href="/ventas">💰 Ventas</a>
        </div>
    </div>
    </body></html>
    `);
});

// 📦 INVENTARIO
app.get('/inventario', async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM productos");

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
        <input name="nombre" placeholder="Nombre" autocomplete="off">
        <input name="precio" type="number" placeholder="Precio" autocomplete="off">
        <input name="stock" type="number" placeholder="Stock" autocomplete="off">
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

// 📊 PRODUCTOS ERP
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

// 💰 VENTAS (carrito igual)
app.get('/ventas', async (req, res) => {
    const { rows: productos } = await pool.query("SELECT * FROM productos");

    let filas = '';
    productos.forEach(p => {
        filas += `
        <tr onclick="seleccionar(${p.id}, '${p.nombre}', ${p.precio}, ${p.stock})">
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
        <tr>
            <th>ID</th>
            <th>Producto</th>
            <th>Precio</th>
            <th>Stock</th>
        </tr>
        ${filas}
    </table>
    <h3>🧾 Detalle de Venta</h3>
    <input id="nombre" placeholder="Producto" disabled>
    <input id="precio" placeholder="Precio" disabled>
    <input id="cantidad" type="number" placeholder="Cantidad">
    <button type="button" onclick="agregarAlCarrito()">Agregar al carrito</button>
    <table id="carrito">
        <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Precio</th>
            <th>Total</th>
            <th>Acción</th>
        </tr>
    </table>
    <strong>Total: $<span id="total">0</span></strong> <br><br>
    <button onclick="confirmarVenta()">Confirmar Venta</button>
    </div>

    <script>
    let carrito = [];
    let productoSeleccionado = null;

    function seleccionar(id, nombre, precio, stock){
        productoSeleccionado = {id, nombre, precio, stock};
        document.getElementById("nombre").value = nombre;
        document.getElementById("precio").value = "$" + precio.toLocaleString('es-CL');
        document.getElementById("cantidad").value = "";
    }

    function agregarAlCarrito(){
        let cant = parseInt(document.getElementById("cantidad").value) || 0;
        if(!productoSeleccionado){ alert("Selecciona un producto"); return; }
        if(cant <= 0){ alert("Cantidad inválida"); return; }
        if(cant > productoSeleccionado.stock){ alert("Stock insuficiente"); return; }

        let existente = carrito.find(p => p.id === productoSeleccionado.id);

        if(existente){
            if(existente.cantidad + cant > productoSeleccionado.stock){
                alert("Stock insuficiente"); return;
            }
            existente.cantidad += cant;
        } else {
            carrito.push({...productoSeleccionado, cantidad: cant});
        }

        actualizarTabla();

        document.getElementById("nombre").value = "";
        document.getElementById("precio").value = "";
        document.getElementById("cantidad").value = "";
        productoSeleccionado = null;
    }

    function actualizarTabla(){
        let tabla = document.getElementById("carrito");
        tabla.innerHTML = '<tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th><th>Acción</th></tr>';
        let total = 0;

        carrito.forEach((p,i)=>{
            let totalFila = p.precio * p.cantidad;
            total += totalFila;

            tabla.innerHTML += \`
            <tr>
                <td>\${p.nombre}</td>
                <td class="right">\${p.cantidad}</td>
                <td class="right">$\${p.precio.toLocaleString('es-CL')}</td>
                <td class="right">$\${totalFila.toLocaleString('es-CL')}</td>
                <td><button onclick="eliminar(\${i})">❌</button></td>
            </tr>\`;
        });

        document.getElementById("total").innerText = total.toLocaleString('es-CL');
    }

    function eliminar(indice){
        carrito.splice(indice,1);
        actualizarTabla();
    }

    function confirmarVenta(){
        if(carrito.length === 0){
            alert("No hay productos en el carrito");
            return;
        }

        let form = document.createElement("form");
        form.method = "POST";
        form.action = "/ventas";

        carrito.forEach(p=>{
            let inputId = document.createElement("input");
            inputId.type = "hidden";
            inputId.name = "producto_id[]";
            inputId.value = p.id;
            form.appendChild(inputId);

            let inputCant = document.createElement("input");
            inputCant.type = "hidden";
            inputCant.name = "cantidad[]";
            inputCant.value = p.cantidad;
            form.appendChild(inputCant);
        });

        document.body.appendChild(form);
        form.submit();
    }

    document.getElementById("buscar").onkeyup = function(){
        let f = this.value.toLowerCase();
        document.querySelectorAll("#tabla tr").forEach((r,i)=>{
            if(i==0) return;
            r.style.display = r.innerText.toLowerCase().includes(f) ? "" : "none";
        });
    };
    </script>
    </body></html>
    `);
});

// 💰 POST /ventas (boleta EXACTA)
app.post('/ventas', async (req,res)=>{
    const ids = Array.isArray(req.body.producto_id)?req.body.producto_id:[req.body.producto_id];
    const cant = Array.isArray(req.body.cantidad)?req.body.cantidad:[req.body.cantidad];

    let detalles = [];

    for (let i = 0; i < ids.length; i++) {
        const { rows } = await pool.query("SELECT * FROM productos WHERE id = $1",[ids[i]]);
        const p = rows[0];
        if (!p) continue;

        let cantidad = parseInt(cant[i]);
        if(cantidad > p.stock) cantidad = p.stock;

        await pool.query("UPDATE productos SET stock = stock - $1 WHERE id = $2",[cantidad, ids[i]]);

        detalles.push({nombre: p.nombre, precio: p.precio, cantidad});
    }

    let totalBoleta = 0;
    detalles.forEach(d=>{ totalBoleta += d.precio*d.cantidad; });

    let subtotal = Math.round(totalBoleta/1.19);
    let iva = totalBoleta - subtotal;

    let html = `
    <html>
    <head>
    <style>
    body { font-family: monospace; max-width: 400px; margin:auto; }
    h2,p { text-align:center; margin:2px; }
    table { width:100%; border-collapse: collapse; margin-top:10px; }
    th, td { padding:5px; }
    td.right { text-align:right; }
    .totales { margin-top:10px; }
    .totales p { margin:2px 0; text-align:right; }
    .mensaje { text-align:center; margin-top:15px; font-weight:bold; }
    button { margin-top:10px; }
    @media print { button { display:none; } }
    </style>
    </head>
    <body>
    <h2>🔧 Ferretería</h2>
    <p>Tel: +56 9 1234 5678 | correo@ferreteria.cl</p>
    <p>Dirección: Calle Principal 123, Ciudad</p>
    <hr>
    <h3>Boleta de Venta</h3>
    <table>
        <tr><th>Producto</th><th>Cantidad</th><th>Precio Un</th><th>Total</th></tr>`;

    detalles.forEach(d=>{
        let totalFila = d.precio*d.cantidad;
        html += `<tr>
            <td>${d.nombre}</td>
            <td class="right">${d.cantidad}</td>
            <td class="right">$${d.precio.toLocaleString('es-CL')}</td>
            <td class="right">$${totalFila.toLocaleString('es-CL')}</td>
        </tr>`;
    });

    html += `</table>
    <div class="totales">
        <p><strong>Subtotal:</strong> $${subtotal.toLocaleString('es-CL')}</p>
        <p><strong>IVA:</strong> $${iva.toLocaleString('es-CL')}</p>
        <p><strong>Total:</strong> $${totalBoleta.toLocaleString('es-CL')}</p>
    </div>
    <div class="mensaje">¡Gracias por visitarnos!</div>
    <button onclick="window.print()">🖨 Imprimir Boleta</button>
    <br><a href="/ventas" class="btn-volver">Nueva venta</a>
    </body></html>`;

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
    <form method="POST" autocomplete="off">
        <input name="nombre" value="${p.nombre}" autocomplete="off">
        <input name="precio" value="${p.precio}" autocomplete="off">
        <input name="stock" value="${p.stock}" autocomplete="off">
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