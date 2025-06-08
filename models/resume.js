const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  matchedJob: {
    title: String,
    description: String,
    matchedSkills: [String],
  },
  snippet: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, {timestamps: true });

module.exports = mongoose.model("Resume", resumeSchema);
