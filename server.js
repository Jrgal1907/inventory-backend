const mongoose = require('mongoose');

// 🔥 conexión a MongoDB
mongoose.connect('mongodb://inventoryuser:Leah1234*@ac-mw8bcpw-shard-00-00.u0zkfjq.mongodb.net:27017,ac-mw8bcpw-shard-00-01.u0zkfjq.mongodb.net:27017,ac-mw8bcpw-shard-00-02.u0zkfjq.mongodb.net:27017/Inventory?ssl=true&replicaSet=atlas-14peuo-shard-0&authSource=admin&appName=InventoryDB')
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.log("❌ Error Mongo:", err));

const Product = mongoose.model('Product', {
  code: String,
  name: String,
  price: Number,
  stock: Number
});

// Importa el framework para crear el servidor
const express = require('express');

// Importa CORS (permite que frontend y backend se hablen)
const cors = require('cors');

// Crea la app de servidor
const app = express();


// 👇 HABILITA CORS (CLAVE)
// Permite que cualquier frontend (localhost, Netlify, etc)
// pueda hacer requests a este backend
app.use(cors());


// 👇 PERMITE RECIBIR JSON (CLAVE)
// Sin esto, req.body vendría vacío
app.use(express.json());


// 👇 "BASE DE DATOS" EN MEMORIA
// Simula productos sin usar DB real
const products = {
  "123": { name: "Coca Cola", price: 4000, stock: 10 },
  "456": { name: "Pan", price: 1000, stock: 25 }
};

// 🔥 Crear producto en Mongo
app.post('/add-product', async (req, res) => {

  const { code, name, price, stock } = req.body;

  try {
    const newProduct = new Product({
      code,
      name,
      price,
      stock
    });

    await newProduct.save();

    res.json({ message: "Producto guardado", product: newProduct });

  } catch (err) {
    console.log("🔥 ERROR REAL:", err); // 👈 CLAVE
    res.status(500).json({ error: "Error guardando producto" });
  }

});

// 👇 ENDPOINT PRINCIPAL
// Este endpoint recibe cambios de stock desde el frontend
app.post('/update-stock', (req, res) => {

  // Extrae datos enviados desde el frontend
  const { code, qty } = req.body;

  if (!products[code]) {
    return res.json({ error: "No encontrado" });
  }

  // Suma o resta stock (qty puede ser positivo o negativo)
  products[code].stock += qty;

  // Devuelve el producto actualizado
  res.json(products[code]);
});
app.post('/checkproduct', (req, res) => {

  const { code } = req.body;

  if (!products[code]) {
    return res.json({ error: "No encontrado" });
  }

  res.json(products[code]);
});
app.get('/products', (req, res) => {

  // devuelve todos los productos
  res.json(products);

});

app.post('/scan', (req, res) => {
  const { code } = req.body;

  if (!products[code]) {
    return res.json({ error: "No encontrado" });
  }

  res.json(products[code]);
});

// 0.0.0.0 = permite acceso desde red local (celular incluido)
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor corriendo en puerto ' + PORT);
});