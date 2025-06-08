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

// Middleware order: cors -> body parsers -> session
app.use(
  cors({
    origin: "https://smart-resume-ja3k.vercel.app/",
    credentials: true,
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: {
      maxAge: 1000 * 60 * 60, // 1 hour
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    },
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Multer setup - 5MB max file size
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please login." });
  }
  next();
}

// Routes: Auth (register, login, logout)
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "Username, email and password are required" });

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) return res.status(409).json({ message: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({ username, email, password: hashedPassword });
  await newUser.save();

  req.session.userId = newUser._id; // Auto login on register

  res.status(201).json({
    message: "Registered successfully",
    user: { email: newUser.email, username: newUser.username, id: newUser._id },
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  const user = await User.findOne({ email });
  if (!user || !user.password) return res.status(401).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  req.session.userId = user._id;

  res.status(200).json({
    message: "Login successful",
    user: { email: user.email, id: user._id },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out successfully" });
});

// Resume analyze route - file upload + parsing
app.post("/api/resume/analyze", requireAuth, upload.single("resume"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Extra server-side file size check for safety (multer limit should prevent this normally)
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "File too large (max 5MB)" });
  }

  const filePath = path.join(__dirname, "uploads", req.file.filename);

  try {
    // Read file buffer safely
    const fileBuffer = fs.readFileSync(filePath);

    // Optional: check buffer size to avoid memory error
    if (fileBuffer.length > 10 * 1024 * 1024) { // 10MB buffer safety limit
      return res.status(400).json({ error: "File buffer too large to process" });
    }

    const pdfData = await pdfParse(fileBuffer);
    const text = pdfData.text || "";
    const snippet = text.slice(0, 500);

    const jobMatch = matchJob(text);

    const newResume = new Resume({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      matchedJob: jobMatch || undefined,
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
    console.error("❌ Backend Error:", err);
    res.status(500).json({ error: "Failed to parse resume", details: err.message });
  }
});

// Get all resumes history for user
app.get("/api/resumes/history", requireAuth, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.session.userId }).sort({ createdAt: -1 });
    res.json(resumes);
  } catch (err) {
    console.error("Error fetching resume history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Serve uploaded file securely
app.get("/file/:filename", requireAuth, (req, res) => {
  const decodedFileName = decodeURIComponent(req.params.filename);
  const filePath = path.join(__dirname, "uploads", decodedFileName);

  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  } else {
    res.status(404).send("File not found");
  }
});

// Delete resume file and DB record
app.delete("/delete/:filename", requireAuth, (req, res) => {
  const decodedFileName = decodeURIComponent(req.params.filename);
  const filePath = path.join(__dirname, "uploads", decodedFileName);

  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.status(500).json({ message: "Error deleting file" });
      }

      Resume.deleteOne({ fileName: decodedFileName })
        .then(() => res.json({ message: "File and DB record deleted" }))
        .catch((dbErr) => {
          console.error("MongoDB delete error:", dbErr);
          res.status(500).json({ message: "File deleted, DB not updated" });
        });
    });
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
