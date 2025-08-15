require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==== ENV VARS ====
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!GOOGLE_API_KEY || !GOOGLE_DRIVE_FOLDER_ID) {
    console.error("GOOGLE_API_KEY atau GOOGLE_DRIVE_FOLDER_ID belum diset di .env!");
    process.exit(1);
}

console.log("API KEY:", GOOGLE_API_KEY ? "[OK]" : "[MISSING]");
console.log("FOLDER ID:", GOOGLE_DRIVE_FOLDER_ID ? "[OK]" : "[MISSING]");

// ==== CACHE DIR ====
const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 6 jam expire
const CACHE_EXPIRE = 6 * 60 * 60 * 1000;

// Bersihkan cache otomatis
setInterval(() => {
    const now = Date.now();
    fs.readdirSync(CACHE_DIR).forEach(file => {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > CACHE_EXPIRE) {
            fs.unlinkSync(filePath);
            console.log(`Cache expired & deleted: ${file}`);
        }
    });
}, 30 * 60 * 1000);

// ==== Ambil daftar file dari Google Drive ====
async function listDriveFiles() {
    const url = `https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Gagal fetch daftar file");
    const data = await res.json();
    return data.files || [];
}

// ==== Download file ====
async function downloadFile(fileId, filename) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal download file ${filename}`);
    const filePath = path.join(CACHE_DIR, filename);
    const buffer = await res.buffer();
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

// ==== Endpoint root ====
app.get('/', (req, res) => {
    res.json({
        status: "Server running",
        endpoints: ["/files", "/download/:filename"],
        cache_dir: CACHE_DIR
    });
});

// ==== Endpoint daftar file ====
app.get('/files', async (req, res) => {
    try {
        const files = await listDriveFiles();
        res.json({ files });
    } catch (err) {
        console.error("Error fetching files:", err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// ==== Endpoint download file ====
app.get('/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(CACHE_DIR, filename);

        // Cek cache
        if (fs.existsSync(filePath)) {
            console.log(`Serving from cache: ${filename}`);
            res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
            return res.sendFile(filePath);
        }

        // Cari file di Google Drive
        const files = await listDriveFiles();
        const file = files.find(f => f.name === filename);
        if (!file) return res.status(404).json({ error: "File tidak ditemukan" });

        // Download baru
        const downloadedPath = await downloadFile(file.id, filename);
        res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
        res.sendFile(downloadedPath);

    } catch (err) {
        console.error("Download error:", err);
        res.status(500).json({ error: true, message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
