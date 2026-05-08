const port = 4000;

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

// =====================
// ✅ Middlewares (FIXED)
// =====================
app.use(express.json());

// app.use(cors({
//   origin: "http://localhost:3000",
//   methods: ["GET", "POST"],
//   allowedHeaders: ["Content-Type", "auth-token"],
// }));s

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://vercel-frontend-sigma-five.vercel.app",
    "https://ecommerce-admin-lac-two.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// ✅ Logging (ONLY ONCE)
app.use((req, res, next) => {
  console.log("👉", req.method, req.url);
  next();
});

// =====================
// MongoDB
// =====================

mongoose.connect(
  "mongodb://pawanjatav62:jatav123@ac-y3vupma-shard-00-00.xgmijfi.mongodb.net:27017,ac-y3vupma-shard-00-01.xgmijfi.mongodb.net:27017,ac-y3vupma-shard-00-02.xgmijfi.mongodb.net:27017/?ssl=true&replicaSet=atlas-mo85q9-shard-0&authSource=admin&appName=Cluster0"
)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("Connection Error:", err));

// =====================
// Test
// =====================
app.get("/", (req, res) => {
  res.send("Express Running ✅");
});

// =====================
// Image Upload
// =====================
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.use("/images", express.static("upload/images"));

app.post("/upload", upload.single("image"), (req, res) => {
  res.json({
    success: true,
    // image_url: `http://localhost:${port}/images/${req.file.filename}`,
    image_url: `https://vercel-backend-q3tv.onrender.com/images/${req.file.filename}`,
  });
});

// =====================
// Product Schema
// =====================
const Product = mongoose.model("Product", {
  id: Number,
  name: String,
  image: String,
  category: String,
  new_price: Number,
  old_price: Number,
  popular: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
});


app.post("/removeproduct", async (req, res) => {
  try {

    await Product.findOneAndDelete({ id: req.body.id });

    console.log("Removed:", req.body.id);

    res.json({
      success: true,
      message: "Product Removed"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });

  }
});

// =====================
// Add Product
// =====================
app.post("/addproduct", async (req, res) => {
  try {
    let products = await Product.find({});
    let id = products.length ? products[products.length - 1].id + 1 : 1;

    const product = new Product({
      id,
      name: req.body.name,
      image: req.body.image,
      category: req.body.category,
      new_price: Number(req.body.new_price),
      old_price: Number(req.body.old_price),
      popular: req.body.popular === true,
    });

    await product.save();
    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// Users
// =====================
const Users = mongoose.model("Users", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: Object,
});

// =====================
// Signup
// =====================
app.post("/signup", async (req, res) => {
  try {
    let exist = await Users.findOne({ email: req.body.email });
    if (exist) return res.json({ success: false, message: "User exists" });

    const hash = await bcrypt.hash(req.body.password, 10);

    let cart = {};
    for (let i = 0; i < 300; i++) cart[i] = 0;

    const user = new Users({
      name: req.body.username,
      email: req.body.email,
      password: hash,
      cartData: cart,
    });

    await user.save();

    const token = jwt.sign({ user: { id: user._id } }, "secret_ecom");
    res.json({ success: true, token });

  } catch {
    res.status(500).json({ success: false });
  }
});

// =====================
// Login
// =====================
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });

  if (!user) return res.json({ success: false });

  const pass = await bcrypt.compare(req.body.password, user.password);
  if (!pass) return res.json({ success: false });

  const token = jwt.sign({ user: { id: user._id } }, "secret_ecom");
  res.json({ success: true, token });
});

// =====================
// Auth Middleware
// =====================
const fetchUser = (req, res, next) => {
  const token = req.header("auth-token");

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// =====================
// Cart APIs
// =====================
app.post("/addtocart", fetchUser, async (req, res) => {
  let user = await Users.findById(req.user.id);

  if (!user) return res.status(404).json({ error: "User not found" });

  user.cartData[req.body.itemId] =
    (user.cartData[req.body.itemId] || 0) + 1;

  await Users.findByIdAndUpdate(req.user.id, {
    cartData: user.cartData,
  });

  res.json({ success: true });
});

app.post("/removefromcart", fetchUser, async (req, res) => {
  let user = await Users.findById(req.user.id);

  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.cartData[req.body.itemId] > 0) {
    user.cartData[req.body.itemId] -= 1;
  }

  await Users.findByIdAndUpdate(req.user.id, {
    cartData: user.cartData,
  });

  res.json({ success: true });
});

app.post("/getcart", fetchUser, async (req, res) => {
  console.log("🔥 GETCART HIT");

  console.log("USER ID:", req.user.id);

  let user = await Users.findById(req.user.id);

  console.log("USER FOUND:", user);

  // let user = await Users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(user.cartData || {});
});

// =====================
// Collections
// =====================
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({
    category: { $regex: /^kids$/i }
  }).sort({ date: -1 }).limit(8);

  res.json(products);
});

app.get("/kids", async (req, res) => {
  let products = await Product.find({
    category: { $regex: /^kids$/i }
  });

  res.json(products);
});

app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({
    category: { $regex: /^women$/i },
    popular: true,
  }).limit(4);

  res.json(products);
});

// =====================
// All Products
// =====================
app.get("/allproducts", async (req, res) => {
  const products = await Product.find({});
  res.json(products);
});

// =====================
app.listen(port, () => {
  console.log("Server Running on " + port);
});