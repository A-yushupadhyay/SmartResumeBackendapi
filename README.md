# 🧠 SmartResume - Backend API

Frontend of SmartResume is Hosted On - [ https://smart-resume-blush.vercel.app ]

This is the backend API for **SmartResume**, a smart resume analyzer powered by Node.js, Express, MongoDB, and PDF parsing. It handles:

- ✅ User authentication (register/login/logout)
- ✅ Resume upload (PDF only)
- ✅ Resume analysis (using pdf-parse)
- ✅ Resume history tracking
- ✅ Resume viewing & deletion 

Hosted on 👉 [Render](https://smartresumebackendapi.onrender.com)

---

## 🚀 Tech Stack

- Node.js
- Express.js
- MongoDB Atlas
- Multer (file uploads)
- PDF-Parse
- Express-Session + MongoDB Store
- CORS + HTTPS Secure Cookie Handling

---

## 📦 Installation & Setup

### 1. Clone the Repo

```bash
git clone https://github.com/A-yushupadhyay/SmartResumeBackendapi.git
cd SmartResumeBackendapi
```

Install Dependencies
npm install



Create .env File
Create a .env file in the server/ directory:
```
PORT=5000
MONGO_URL=your_mongo_atlas_url
JWT_SECRET=your_secret_key
```





Start Server (Dev)
node index.js



📁 API Routes Overview
Method	Route	Description
POST	/api/auth/register	Register a new user
POST	/api/auth/login	Login existing user
POST	/api/auth/logout	Logout current session
POST	/api/resume/analyze	Upload + Analyze resume (PDF)
GET	/api/resumes/history	Get uploaded resume history
GET	/file/:filename	View/download uploaded file
DELETE	/delete/:filename	Delete uploaded resume

✅ All resume-related routes are protected by session-based auth.



🌐 CORS Setup
The backend allows requests only from the deployed frontend:
cors({
  origin: "https://smart-resume-ja3k.vercel.app",
  credentials: true,
})

🔒 Auth & Session
Session is stored using express-session + connect-mongo.

Cookies are:

secure: true

sameSite: "none"

httpOnly: true

This ensures compatibility across Render & Vercel deployments.

📤 Deployment (Render)
Render service URL: https://smartresumebackendapi.onrender.com

Auto-deploys from GitHub on every push 

@---------------------------------@
                                  @
👨‍💻 Author                        @
Made with ❤️ by Ayush Upadhyay   @
                                  @
@---------------------------------@

                                                                        


