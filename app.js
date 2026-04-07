const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.urlencoded({ extended: true }));

// 🔌 POSTGRES
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 📦 TABLA
pool.query(`
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre TEXT,
    precio INTEGER,
    stock INTEGER
)
`);

// 🎨 ESTILO (igual)
const estilo = `...`; // 👈 usa el mismo que ya tienes (no cambia nada)

// 🏠 HOME (igual)
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


// 📊 INVENTARIO (EXPORTAR)
app.get('/productos', async (req, res) => {
    const result = await pool.query("SELECT * FROM productos");
    const rows = result.rows;

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
    <tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th></tr>`;

    rows.forEach(p => {
        html += `
        <tr>
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td>${p.stock}</td>
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


// 💰 VENTAS (POSTGRES)
app.get('/ventas', async (req, res) => {
    const result = await pool.query("SELECT * FROM productos");
    const productos = result.rows;

    let filas = '';
    productos.forEach(p => {
        filas += `
        <tr onclick="seleccionar(${p.id}, '${p.nombre}', ${p.precio}, ${p.stock})">
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>$${Number(p.precio).toLocaleString('es-CL')}</td>
            <td>${p.stock}</td>
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

    <h3>🧾 Detalle</h3>
    <input id="nombre" disabled>
    <input id="precio" disabled>
    <input id="cantidad" type="number">
    <button onclick="agregar()">Agregar</button>

    <table id="carrito">
        <tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr>
    </table>

    <strong>Total: $<span id="total">0</span></strong><br><br>
    <button onclick="confirmar()">Confirmar Venta</button>

    </div>

    <script>
    let carrito = [];
    let seleccionado;

    function seleccionar(id,nombre,precio,stock){
        seleccionado = {id,nombre,precio,stock};
        nombreInput.value = nombre;
        precioInput.value = precio;
    }

    function agregar(){
        let c = parseInt(cantidad.value);
        if(!seleccionado || c<=0) return;
        carrito.push({...seleccionado,cantidad:c});
        render();
    }

    function render(){
        let t=0;
        carritoHTML.innerHTML = '<tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr>';
        carrito.forEach(p=>{
            let total = p.precio*p.cantidad;
            t+=total;
            carritoHTML.innerHTML+=\`<tr><td>\${p.nombre}</td><td>\${p.cantidad}</td><td>$\${total}</td></tr>\`;
        });
        totalSpan.innerText=t;
    }

    function confirmar(){
        fetch('/ventas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(carrito)})
        .then(r=>r.text()).then(html=>document.body.innerHTML=html);
    }
    </script>
    </body></html>
    `);
});


// 🧾 CONFIRMAR VENTA
app.post('/ventas', express.json(), async (req,res)=>{
    const carrito = req.body;
    let total = 0;

    for(const p of carrito){
        total += p.precio * p.cantidad;

        await pool.query(
            "UPDATE productos SET stock = stock - $1 WHERE id=$2",
            [p.cantidad, p.id]
        );
    }

    res.send(`
    <h2>Venta realizada</h2>
    <p>Total: $${total}</p>
    <a href="/ventas">Volver</a>
    `);
});


// 🚀 SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo"));