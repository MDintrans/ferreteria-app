const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.urlencoded({ extended: true }));

// 🔌 CONEXIÓN A POSTGRES
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 🧱 CREAR TABLA
pool.query(`
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre TEXT,
    precio INTEGER,
    stock INTEGER
)
`);

// 🎨 ESTILO
const estilo = `
<style>
body { margin:0; font-family: Arial; background:#f1f5f9; }
.container { padding:25px; }
h1 { text-align:center; }
input, button { padding:10px; margin:5px; }
table { width:100%; margin-top:20px; }
</style>
`;

// 🏠 HOME
app.get('/', (req, res) => {
    res.send(`
    <html>
    <head><title>Ferretería</title>${estilo}</head>
    <body>
    <div class="container">
        <h1>🔧 Ferretería</h1>
        <a href="/inventario">Ir a Inventario</a>
    </div>
    </body></html>
    `);
});

// 📦 INVENTARIO
app.get('/inventario', async (req, res) => {
    const result = await pool.query("SELECT * FROM productos ORDER BY id DESC");
    let rows = result.rows;

    let html = `
    <html>
    <head><title>Inventario</title>${estilo}</head>
    <body>
    <div class="container">
    <h2>Productos</h2>

    <form method="POST" action="/agregar">
        <input name="nombre" placeholder="Nombre">
        <input name="precio" type="number" placeholder="Precio">
        <input name="stock" type="number" placeholder="Stock">
        <button>Agregar</button>
    </form>

    <table border="1">
    <tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr>
    `;

    rows.forEach(p => {
        html += `
        <tr>
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>$${p.precio}</td>
            <td>${p.stock}</td>
            <td>
                <form method="POST" action="/eliminar/${p.id}">
                    <button>Eliminar</button>
                </form>
            </td>
        </tr>`;
    });

    html += `</table></div></body></html>`;
    res.send(html);
});

// ➕ AGREGAR
app.post('/agregar', async (req, res) => {
    const { nombre, precio, stock } = req.body;
    await pool.query(
        "INSERT INTO productos (nombre, precio, stock) VALUES ($1, $2, $3)",
        [nombre, precio, stock]
    );
    res.redirect('/inventario');
});

// ❌ ELIMINAR
app.post('/eliminar/:id', async (req, res) => {
    await pool.query("DELETE FROM productos WHERE id=$1", [req.params.id]);
    res.redirect('/inventario');
});

// 🚀 SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo"));