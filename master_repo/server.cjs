// server.cjs
// Express backend with SQLite (better-sqlite3)
// Saves PDFs under storage/<course>/<year>/ and tracks them in data/app.db

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// -- SQLite
const Database = require("better-sqlite3");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course      TEXT    NOT NULL,
    year        INTEGER NOT NULL,
    filename    TEXT    NOT NULL,
    size        INTEGER NOT NULL,
    mtime       TEXT    NOT NULL,
    saved_path  TEXT    NOT NULL,
    uploaded_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(course, year, filename)
  );
  CREATE INDEX IF NOT EXISTS idx_files_course_year ON files(course, year);
`);

const stmtUpsert = db.prepare(`
  INSERT INTO files (course, year, filename, size, mtime, saved_path)
  VALUES (@course, @year, @filename, @size, @mtime, @saved_path)
  ON CONFLICT(course, year, filename) DO UPDATE SET
    size = excluded.size,
    mtime = excluded.mtime,
    saved_path = excluded.saved_path
`);
const stmtList = db.prepare(`
  SELECT filename AS name, size, mtime
  FROM files
  WHERE course = ? AND year = ?
  ORDER BY datetime(mtime) DESC, name ASC
`);

const app = express();

// CORS (fine even with proxy)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.options("*", cors());

// tiny log so you SEE the exact path that hit your server
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.json());

// temp upload dir
const upload = multer({ dest: "uploads/" });

// disk root for saved PDFs
const STORAGE_ROOT = path.join(__dirname, "storage");

// helpers
function sanitize(seg) {
  return String(seg || "").replace(/[^a-zA-Z0-9-_]/g, "_");
}
async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

// avoid noisy favicon 404s
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// health
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// import a folder's files from disk into DB (used when DB empty)
async function importFolder(course, year) {
  const dir = path.join(STORAGE_ROOT, course, String(year));
  try {
    const names = await fsp.readdir(dir);
    for (const name of names) {
      const p = path.join(dir, name);
      const st = await fsp.stat(p).catch(() => null);
      if (!st || !st.isFile()) continue;
      stmtUpsert.run({
        course,
        year: Number(year),
        filename: name,
        size: st.size,
        mtime: st.mtime.toISOString(),
        saved_path: path.relative(__dirname, p),
      });
    }
  } catch {
    // folder may not exist; ignore
  }
}

// GET /files?course=ABC&year=2021  (DB-first, auto-import if DB empty)
app.get(["/files", "/api/files"], async (req, res) => {
  try {
    const course = sanitize(req.query.course);
    const year = Number(req.query.year);
    if (!course || !year) return res.status(400).json({ error: "Missing course or year" });

    let rows = stmtList.all(course, year);
    if (rows.length === 0) {
      await importFolder(course, year);
      rows = stmtList.all(course, year);
    }
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /upload?course=ABC&year=2021  (saves to disk + upserts DB)
app.post(["/upload", "/api/upload"], upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const tmpPath = req.file.path;
  const originalName = req.file.originalname || "uploaded.pdf";

  try {
    const course = sanitize(req.query.course);
    const year = Number(sanitize(req.query.year));
    if (!course) { fs.unlink(tmpPath, () => {}); return res.status(400).json({ error: "Missing ?course=<COURSE_CODE>" }); }
    if (!year || !/^(19|20)\d{2}$/.test(String(year))) {
      fs.unlink(tmpPath, () => {});
      return res.status(400).json({ error: "Missing or invalid ?year=YYYY (e.g., 2021)" });
    }

    const targetDir = path.join(STORAGE_ROOT, course, String(year));
    await ensureDir(targetDir);

    // dedupe filename
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    let finalPath = path.join(targetDir, originalName);
    let i = 1;
    while (fs.existsSync(finalPath)) {
      finalPath = path.join(targetDir, `${base} (${i})${ext}`);
      i += 1;
    }
    await fsp.rename(tmpPath, finalPath);

    const st = await fsp.stat(finalPath);
    const row = {
      course,
      year,
      filename: path.basename(finalPath),
      size: st.size,
      mtime: st.mtime.toISOString(),
      saved_path: path.relative(__dirname, finalPath),
    };
    stmtUpsert.run(row);

    res.json({
      year: String(year),
      filename: row.filename,
      savedPath: row.saved_path,
      size: row.size,
      mtime: row.mtime,
    });
  } catch (e) {
    console.error("Upload error:", e);
    try { fs.unlinkSync(tmpPath); } catch {}
    res.status(500).json({ error: "Error processing file" });
  }
});

// optional: POST /reindex?course=ABC&year=2021  (refresh DB from disk)
app.post(["/reindex", "/api/reindex"], async (req, res) => {
  try {
    const course = sanitize(req.query.course);
    const yearStr = sanitize(req.query.year);

    if (course && yearStr) {
      await importFolder(course, Number(yearStr));
      return res.json({ ok: true, course, year: Number(yearStr) });
    }

    const courses = await fsp.readdir(STORAGE_ROOT).catch(() => []);
    for (const c of courses) {
      const cdir = path.join(STORAGE_ROOT, c);
      const cs = await fsp.stat(cdir).catch(() => null);
      if (!cs || !cs.isDirectory()) continue;

      const years = await fsp.readdir(cdir).catch(() => []);
      for (const y of years) {
        if (!/^(19|20)\d{2}$/.test(y)) continue;
        await importFolder(c, Number(y));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Reindex error:", e);
    res.status(500).json({ error: "Reindex failed" });
  }
});

// JSON 404 to show EXACT path that missed
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl, hint: "Use /upload, /files, /health (or /api/* equivalents)" });
});

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => console.log(`✅ server.cjs on http://localhost:${PORT}  DB: ${DB_PATH}`));
