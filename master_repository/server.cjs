const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const fs = require("fs");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);


// Extract text from PDF
async function extractTextFromPdf(filePath) {
  console.log("🔍 Reading file:", filePath);
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  console.log("✅ PDF text extracted, length:", data.text.length);
  return data.text;
}

// Ask Gemini for the year
async function findYear(text) {
  console.log("🤖 Sending text to Gemini model...");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `You are an AI that analyzes document text to determine when it was written.
Given the text below, return the year or approximate time period it was written.
If you can't tell, say "unknown".

Document text: ${text.slice(0, 8000)}`;

  const result = await model.generateContent(prompt);
  //console.log("🧾 Gemini raw response:", result);

  let year = "unknown";
  if (result.response && typeof result.response.text === "function") {
    year = result.response.text().trim();
  } else {
    console.warn("⚠️ Unexpected response format from Gemini");
  }
  return year
  //return result.response.text.trim();
}

// Upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("📥 File received:", req.file?.originalname);
  try {
    const text = await extractTextFromPdf(req.file.path);
    console.log("📄 Extracted text (first 500 chars):", text.slice(0, 500));

    const year = await findYear(text);
    console.log("📆 Gemini detected year:", year);

    res.json({ year });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Error processing file" });
  }
});

app.use(express.static("."));
app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
