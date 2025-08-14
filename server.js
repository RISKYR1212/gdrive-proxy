require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

console.log("API KEY:", GOOGLE_API_KEY);
console.log("FOLDER ID:", GOOGLE_DRIVE_FOLDER_ID);

// Folder cache
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

// Lama cache berlaku (ms) → 6 jam
const CACHE_EXPIRE = 6 * 60 * 60 * 1000;

// Bersihkan cache yang sudah kadaluarsa
function cleanCache() {
    const now = Date.now();
    fs.readdirSync(CACHE_DIR).forEach(file => {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > CACHE_EXPIRE) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Cache expired & deleted: ${file}`);
        }
    });
}

// Jalankan pembersihan cache setiap 30 menit
setInterval(cleanCache, 30 * 60 * 1000);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Server is running. Endpoint tersedia di /files dan /download/:fileId');
});

// List file dari Google Drive
app.get('/files', async (req, res) => {
    try {
        const url = `https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents&key=${GOOGLE_API_KEY}&fields=files(id,name,mimeType)`;
        const response = await axios.get(url);
        res.json({ files: response.data.files || [] });
    } catch (error) {
        console.error('Gagal mengambil file:', error.response?.data || error.message);
        res.status(500).json({ error: 'Gagal mengambil file dari Google Drive' });
    }
});

// Download file + caching
app.get('/download/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const cachePath = path.join(CACHE_DIR, `${fileId}.kml`);

    // Cek apakah file ada di cache & belum kadaluarsa
    if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        if (Date.now() - stats.mtimeMs < CACHE_EXPIRE) {
            console.log(`📂 Serving from cache: ${fileId}`);
            return res.sendFile(cachePath);
        } else {
            fs.unlinkSync(cachePath);
            console.log(`♻️ Cache expired: ${fileId}`);
        }
    }

    // Download dari Google Drive
    try {
        console.log(`⬇️ Downloading from Google Drive: ${fileId}`);
        const fileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

        fs.writeFileSync(cachePath, response.data); // Simpan ke cache
        res.setHeader('Content-Disposition', `attachment; filename="${fileId}.kml"`);
        res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
        res.sendFile(cachePath);
    } catch (error) {
        console.error('Error downloading file:', error.response?.data || error.message);
        res.status(500).json({ error: 'Gagal mengunduh file dari Google Drive' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
