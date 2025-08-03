require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
app.use(cors());


const app = express();
const PORT = process.env.PORT || 5000;



// Allow frontend from Vercel
app.use(cors({
  
  origin: ["http://localhost:5173",
           "https://core-management.vercel.app",
           "https://core-management-pi.vercel.app"],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// app.use(cors()); // Hanya untuk debugging sementara
app.use(express.json());



const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Debug log
console.log("API KEY:", GOOGLE_API_KEY);
console.log("FOLDER ID:", GOOGLE_DRIVE_FOLDER_ID);

// Root endpoint
app.get('/', (req, res) => {
  res.send('Server is running. Endpoint tersedia di /files dan /download/:fileId');
});

// Get list of files
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

// Download file
app.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params;
  try {
    const fileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

    res.setHeader('Content-Disposition', `attachment; filename="${fileId}.kml"`);
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.send(response.data);
  } catch (error) {
    console.error('Error downloading file:', error.response?.data || error.message);
    res.status(500).json({ error: 'Gagal mengunduh file dari Google Drive' });
  }
});

// const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

