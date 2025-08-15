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

// ==== ENV CHECK ====
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

// 6 jam
const CACHE_EXPIRE = 6 * 60 * 60 * 1000;

function cleanCache() {
    const now = Date.now();
    try {
        fs.readdirSync(CACHE_DIR).forEach(file => {
            const filePath = path.join(CACHE_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > CACHE_EXPIRE) {
                fs.unlinkSync(filePath);
                console.log(`Cache expired & deleted: ${file}`);
            }
        });
    } catch (e) {
        console.error("cleanCache error:", e.message);
    }
}
setInterval(cleanCache, 30 * 60 * 1000);

// ==== ROOT ====
app.get('/', (req, res) => {
    res.json({
        status: "Server running",
        endpoints: ["/files", "/download/:fileId"],
        cache_dir: CACHE_DIR
    });
});

// ==== LIST FILES ====
app.get('/files', async (req, res) => {
    console.log("[] GET /files");
    try {
        const q = encodeURIComponent(`'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`);
        const url =
            `https://www.googleapis.com/drive/v3/files?q=${q}&key=${GOOGLE_API_KEY}&fields=files(id,name,mimeType)`;

        console.log("Google API URL:", url);

        const response = await axios.get(url, { timeout: 15000 });
        console.log(`Received ${response.data.files?.length || 0} files`);

        res.json({ files: response.data.files || [] });
    } catch (error) {
        console.error("Error fetching files:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data || error.message
        });
        res.status(500).json({
            error: true,
            message: "Gagal mengambil file dari Google Drive",
            details: error.response?.data || error.message
        });
    }
});

// ==== DOWNLOAD + CACHE ====
// Download file + caching
app.get('/download/:fileId', async (req, res) => {
    const { fileId } = req.params;
    console.log(`[] GET /download/${fileId}`);
    const cachePath = path.join(CACHE_DIR, `${fileId}.kml`);

    // Cek cache
    if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        if (Date.now() - stats.mtimeMs < CACHE_EXPIRE) {
            console.log(`Serving from cache: ${fileId}`);
            return res.sendFile(cachePath);
        } else {
            fs.unlinkSync(cachePath);
            console.log(`Cache expired: ${fileId}`);
        }
    }

    try {
        const fileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
        console.log(`Downloading from: ${fileUrl}`);

        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(cachePath, response.data);

        console.log(`File saved to cache: ${cachePath}`);
        res.setHeader('Content-Disposition', `attachment; filename="${fileId}.kml"`);
        res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
        res.sendFile(cachePath);

    } catch (error) {
        // Tambahan debug detail
        console.error("Error downloading file from Google Drive:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            headers: error.response?.headers,
            data: error.response?.data || error.message,
            fileId: fileId
        });

        res.status(500).json({
            error: true,
            message: "Gagal mengunduh file dari Google Drive",
            googleStatus: error.response?.status,
            googleStatusText: error.response?.statusText,
            googleError: error.response?.data || error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(` Server listening on port ${PORT}`);
});
