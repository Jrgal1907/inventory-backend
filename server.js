// MONGODB CONNECTION
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.log("❌ Error Mongo:", err));

// Product schema with unique index per client
const ProductSchema = new mongoose.Schema({
  clientId: String,
  code:     String,
  name:     String,
  price:    Number,
  stock:    Number
});
ProductSchema.index({ clientId: 1, code: 1 }, { unique: true });
const Product = mongoose.model('Product', ProductSchema);

// User schema with features
const User = mongoose.model('User', {
  username: { type: String, unique: true },
  password: String,
  clientId: String,
  logoUrl:  String,
  features: {
    remisiones: { type: Boolean, default: false }
  }
});
//  EXPRESS SERVER

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());         // 👈 permite frontend (Netlify)
app.use(express.json()); // 👈 permite leer req.body



// CREAR PRODUCTO
app.post('/add-product', async (req, res) => {
const {clientId} = req.body;
const { code, name } = req.body;
const price = Number(req.body.price);
const stock = Number(req.body.stock);
// VALIDACIÓN BÁSICA
if (!code || !name || isNaN(price) || isNaN(stock) || stock < 0) {
  return res.status(400).json({ error: "Datos inválidos" });
}
  try {
    const newProduct = new Product({
      code,
      name,
      price,
      stock,
	  clientId
    });

    await newProduct.save();

    res.json({ message: "Producto guardado", product: newProduct });

  } catch (err) {
    console.log("🔥 ERROR REAL:", err);
    if (err.code === 11000) {
  return res.status(400).json({ error: "Producto ya existe" });
}

res.status(500).json({ error: "Error guardando producto" });;
  }
});
// user endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  try {
   const user = await User.findOne({ username });

if (!user || !(await bcrypt.compare(password, user.password))) {
  return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
}
    res.json({ clientId: user.clientId, username: user.username, logoUrl: user.logoUrl, features: user.features });

  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});
// BUSCAR PRODUCTO
app.post('/scan', async (req, res) => {

  const { clientId, code } = req.body;

  try {
    const product = await Product.findOne({ clientId,code });

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
  const { clientId,code, qty } = req.body;

  if (!code || isNaN(qty)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  try {
    const product = await Product.findOne({ clientId, code });

    if (!product) {
      return res.status(404).json({ error: "No encontrado" });
    }

    const newStock = product.stock + qty;

    // 🚫 BLOQUEO CLAVE
    if (newStock < 0) {
      return res.status(400).json({
        error: "Stock insuficiente"
      });
    }

    product.stock = newStock;
    await product.save();

    res.json(product);

  } catch (err) {
    console.log("🔥 ERROR:", err);
    res.status(500).json({ error: "Error actualizando stock" });
  }
});

// VER TODOS LOS PROD

app.get('/products', async (req, res) => {
  const { clientId } = req.query;
  try {
    const products = await Product.find({ clientId });
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

//SEARCH BASED ON LIKE 
app.post('/search', async (req, res) => {
  const { clientId,name } = req.body;
  try {
    const products = await Product.find({ clientId,
      name: {$regex: name, $options: 'i' }
    });
    if (products.length === 0) {
      return res.json({ error: "No encontrado" });
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Error buscando producto" });
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor corriendo en puerto ' + PORT);
});