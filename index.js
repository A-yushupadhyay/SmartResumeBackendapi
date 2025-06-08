// ./server/index.js

require("dotenv").config({ path: "./server/.env" });
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdfParse = require("pdf-parse");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Resume = require("./models/resume");
const matchJob = require("./utils/matchJobs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const User = require("./models/user");
const app = express();
const PORT = process.env.PORT || 5000;

/* ✅ Fix 1: Trust proxy (required for secure cookies on Render/Vercel) */
app.set("trust proxy", 1);

/* ✅ Fix 2: Enable CORS with credentials */
app.use(cors({
  origin: "https://smart-resume-ja3k.vercel.app", // your frontend
  credentials: true,
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ✅ Fix 3: Correct secure cookie setup */
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
  cookie: {
    maxAge: 1000 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: "none", // cross-origin
  },
}));

/* ✅ Fix 4: Serve uploads statically */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ✅ MongoDB Connection */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ✅ Multer Setup */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ✅ Middleware to protect routes */
function requireAuth(req, res, next) {
  console.log("🧠 Session check:", req.session); // ✅ Add this
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please login." });
  }
  next();
}

/* Auth Routes */
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) return res.status(409).json({ message: "User exists" });

  const hashed = await bcrypt.hash(password, 10);
  const newUser = await new User({ username, email, password: hashed }).save();
  req.session.userId = newUser._id;

  res.status(201).json({ message: "Registered", user: { username, email } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  req.session.userId = user._id;
  res.json({ message: "Login successful", user: { id: user._id, email } });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid", {
      path: '/',
      secure: true,
      sameSite: "none"
    });
    res.json({ message: "Logged out" });
  });
});

/* ✅ Resume Upload & Analyze Route */
app.post("/api/resume/analyze",requireAuth, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = path.join(__dirname, "uploads", req.file.filename);
    const buffer = fs.readFileSync(filePath);

    const pdfData = await pdfParse(buffer);
    const text = pdfData.text || "";
    const snippet = text.slice(0, 500);
    const jobMatch = matchJob(text);

    const newResume = new Resume({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      matchedJob: jobMatch || "No match found",
      snippet,
      userId: req.session.userId,
    });

    await newResume.save();

    res.json({
      textLength: text.length,
      snippet,
      jobMatch: jobMatch || "No suitable job match found",
    });
  } catch (err) {
    console.error("❌ Error analyzing resume:", err);
    res.status(500).json({ error: "Failed to analyze resume", details: err.message });
  }
});

/* Resume History */
app.get("/api/resumes/history", requireAuth, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.session.userId }).sort({ createdAt: -1 });
    res.json(resumes);
  } catch (err) {
    console.error("Error fetching history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* File serve */
app.get("/file/:filename", requireAuth, (req, res) => {
  const filePath = path.join(__dirname, "uploads", decodeURIComponent(req.params.filename));
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  } else {
    res.status(404).send("File not found");
  }
});

/* Delete resume */
app.delete("/delete/:filename", requireAuth, async (req, res) => {
  const filePath = path.join(__dirname, "uploads", decodeURIComponent(req.params.filename));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await Resume.deleteOne({ fileName: decodeURIComponent(req.params.filename) });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Error deleting file or DB record" });
  }
});
app.get("/" ,(req,res) => {
  res.send("Welcome to Smart Resume API , backend is running");
})

/* Start Server */
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
