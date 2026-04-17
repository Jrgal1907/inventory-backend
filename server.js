
// MONGODB CONNECTION

const mongoose = require('mongoose');

// 👇 IMPORTANTE
// * → %2A (carácter especial codificado)
// también uso la DB en minúscula (consistencia)
mongoose.connect(
  'mongodb://inventoryuser:Leah1234%2A@ac-mw8bcpw-shard-00-00.u0zkfjq.mongodb.net:27017,ac-mw8bcpw-shard-00-01.u0zkfjq.mongodb.net:27017,ac-mw8bcpw-shard-00-02.u0zkfjq.mongodb.net:27017/Inventory?ssl=true&replicaSet=atlas-14peuo-shard-0&authSource=admin&appName=InventoryDB'
)
.then(() => console.log("✅ MongoDB conectado"))
.catch(err => console.log("❌ Error Mongo:", err));



// TABLA


const Product = mongoose.model('Product', {
  code: String,
  name: String,
  price: Number,
  stock: Number
});



//  EXPRESS SERVER


const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());         // 👈 permite frontend (Netlify)
app.use(express.json()); // 👈 permite leer req.body



// CREAR PRODUCTO


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
    console.log("🔥 ERROR REAL:", err);
    res.status(500).json({ error: "Error guardando producto" });
  }

});


// BUSCAR PRODUCTO


app.post('/scan', async (req, res) => {

  const { code } = req.body;

  try {
    const product = await Product.findOne({ code });

    if (!product) {
      return res.json({ error: "No encontrado" });
    }

    res.json(product);

  } catch (err) {
    res.status(500).json({ error: "Error buscando producto" });
  }

});


//  ACTUALIZAR STOCK

app.post('/update-stock', async (req, res) => {

  const { code, qty } = req.body;

  try {
    const product = await Product.findOne({ code });

    if (!product) {
      return res.json({ error: "No encontrado" });
    }

    product.stock += qty;

    await product.save();

    res.json(product);

  } catch (err) {
    res.status(500).json({ error: "Error actualizando stock" });
  }

});


// VER TODOS LOS PROD

app.get('/products', async (req, res) => {

  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo productos" });
  }

});

mongoose.connection.on('connected', () => {
  console.log('🔥 Mongoose conectado');
});

mongoose.connection.on('error', err => {
  console.log('❌ Error conexión:', err);
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor corriendo en puerto ' + PORT);
});