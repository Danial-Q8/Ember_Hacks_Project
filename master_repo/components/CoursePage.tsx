// src/CoursePage.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

/* =========================
   IndexedDB (no external deps)
   DB: CourseFilesDB
   Store: files (keyPath: id, autoIncrement)
   Index: course_year on [course, year]
========================= */

type FileRecord = {
  id?: number;
  course: string;
  year: number;
  name: string;
  size: number;
  type: string;
  mtime: number; // Date.now()
  data: Blob;
};

const DB_NAME = 'CourseFilesDB';
const DB_VERSION = 1;
const STORE = 'files';
const INDEX_COURSE_YEAR = 'course_year';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        st.createIndex(INDEX_COURSE_YEAR, ['course', 'year'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(rec: Omit<FileRecord, 'id'>): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      const req = st.add(rec);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

function dbList(course: string, year: number): Promise<FileRecord[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE, 'readonly');
      const st = tx.objectStore(STORE);
      const idx = st.index(INDEX_COURSE_YEAR);
      const key = IDBKeyRange.only([course, year]);

      const out: FileRecord[] = [];
      const req = idx.openCursor(key);
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          out.push(cur.value as FileRecord);
          cur.continue();
        } else {
          out.sort((a, b) => (b.mtime - a.mtime) || a.name.localeCompare(b.name));
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

function dbDelete(id: number): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      const req = st.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/* =========================
   Icons
========================= */

const FolderIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
);

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

/* =========================
   UI
========================= */

type ListedFile = { id: number; name: string; size: number; mtime: number; type: string; data: Blob };

const CoursePage: React.FC = () => {
  const { courseCode } = useParams<{ courseCode: string }>();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearInput, setYearInput] = useState<string>("");

  const years = useMemo<number[]>(
    () => Array.from({ length: 2025 - 2015 + 1 }, (_, i) => 2015 + i),
    []
  );

  const [dragOver, setDragOver] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [filesInYear, setFilesInYear] = useState<ListedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ensure DB exists
  useEffect(() => { openDB().catch(() => {}); }, []);

  const handleYearClick = (year: number) => {
    setSelectedYear(prev => (prev === year ? null : year));
    setYearInput(String(year));
  };

  const onOpenPicker = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPickedFile(f);
    setFileName(f ? `Selected: ${f.name}` : "No file selected");
    setStatus("");
  };

  // Drag & Drop
  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const onDragOver  = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
  const onDrop      = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const f = e.dataTransfer?.files?.[0] ?? null;
    setPickedFile(f);
    setFileName(f ? `Dropped: ${f.name}` : "No file selected");
    setStatus("");
  };

  const refreshFiles = useCallback(async (yearToLoad: number | null) => {
    if (!courseCode || yearToLoad === null) { setFilesInYear([]); return; }
    setLoadingFiles(true);
    try {
      const rows = await dbList(courseCode, yearToLoad);
      const listed: ListedFile[] = rows.map(r => ({
        id: r.id!,
        name: r.name,
        size: r.size,
        mtime: r.mtime,
        type: r.type,
        data: r.data
      }));
      setFilesInYear(listed);
    } catch {
      setFilesInYear([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [courseCode]);

  useEffect(() => { void refreshFiles(selectedYear); }, [selectedYear, refreshFiles]);

  const onUpload = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!pickedFile) return alert("Choose or drop a PDF first.");
    if (!courseCode) return alert("Missing course code in route");

    const y = (yearInput || (selectedYear !== null ? String(selectedYear) : "")).trim();
    if (!/^(19|20)\d{2}$/.test(y)) {
      setStatus("❌ Please enter/select a valid 4-digit year (e.g., 2021).");
      return;
    }

    try {
      setStatus(`Saving to year ${y}…`);
      const rec: Omit<FileRecord, 'id'> = {
        course: courseCode,
        year: Number(y),
        name: pickedFile.name,
        size: pickedFile.size,
        type: pickedFile.type || 'application/pdf',
        mtime: Date.now(),
        data: pickedFile
      };
      await dbPut(rec);
      setStatus(`✅ Saved: ${pickedFile.name} → ${courseCode}/${y}`);
      setSelectedYear(Number(y));
      await refreshFiles(Number(y));
      // reset picker
      setPickedFile(null);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`❌ Error saving file: ${msg}`);
    }
  };

  const onDelete = async (fileId: number) => {
    if (!confirm("Delete this file?")) return;
    try {
      await dbDelete(fileId);
      setStatus("🗑️ Deleted.");
      await refreshFiles(selectedYear);
    } catch {
      setStatus("❌ Failed to delete.");
    }
  };

  const onDownload = (file: ListedFile) => {
    const url = URL.createObjectURL(file.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const uploadDisabled = !pickedFile || !(yearInput || selectedYear !== null);

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <Link to="/" className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors mb-6 group">
        <ArrowLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
        Back to Courses
      </Link>

      <h1 className="text-4xl sm:text-5xl font-bold mb-2 text-gray-100">{courseCode}</h1>
      <p className="text-xl text-gray-400 mb-2">Document Repository</p>
      <p className="text-sm text-amber-300 mb-8">
      </p>

      {/* Year folders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {years.map((y: number) => (
          <button
            key={y}
            onClick={() => handleYearClick(y)}
            className={`p-4 rounded-lg flex flex-col items-center justify-center gap-2 text-center transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              String(selectedYear) === String(y) ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FolderIcon className="w-12 h-12" />
            <span className="font-semibold text-lg">{y}</span>
          </button>
        ))}
      </div>

      {/* Upload UI */}
      <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
        <div className="mb-4 flex items-center gap-3">
          <label htmlFor="yearInput" className="text-gray-300 whitespace-nowrap">Year:</label>
          <input
            id="yearInput"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            placeholder="e.g., 2021"
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            className="w-40 px-3 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-gray-400 text-sm">or click a folder above</span>
        </div>

        <div
          onClick={onOpenPicker}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            dragOver ? 'border-teal-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700'
          }`}
          aria-label="Upload Box"
        >
          <p className="text-gray-300">Click to choose a PDF or drag & drop it here</p>
          <p className="text-sm text-gray-500 mt-2">{fileName || "No file selected"}</p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
          <button
            onClick={onOpenPicker}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors duration-300"
          >
            <PlusIcon className="w-6 h-6" />
            Choose File
          </button>
          <button
            onClick={onUpload}
            disabled={uploadDisabled}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 font-semibold rounded-lg transition-colors duration-300 ${
              uploadDisabled ? "bg-gray-600 text-gray-300 cursor-not-allowed" : "bg-teal-500 text-white hover:bg-teal-600"
            }`}
          >
            Upload
          </button>
          <p className="text-gray-300 whitespace-pre-line">{status}</p>
        </div>
      </div>

      {selectedYear !== null && (
        <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700 animate-fade-in">
          <h2 className="text-2xl font-semibold mb-4 text-white">Files for {selectedYear}</h2>
          {loadingFiles ? (
            <p className="text-gray-400">Loading files…</p>
          ) : filesInYear.length === 0 ? (
            <p className="text-gray-400">This folder is ready for your PDF documents.</p>
          ) : (
            <ul className="space-y-2">
              {filesInYear.map((f) => (
                <li key={f.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-2">
                  <div className="min-w-0">
                    <p className="text-gray-200 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">
                      {(f.size / 1024).toFixed(1)} KB • {new Date(f.mtime).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onDownload(f)}
                      className="px-3 py-1 text-sm rounded bg-gray-600 hover:bg-gray-500 text-white"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => onDelete(f.id)}
                      className="px-3 py-1 text-sm rounded bg-rose-600 hover:bg-rose-500 text-white"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style>{`
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default CoursePage;
