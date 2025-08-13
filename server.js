require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');


const app = express();
const PORT = process.env.PORT || 5000;

//  cors (beri izin akses)
// app.use(cors({
//   origin: [
//     "http://localhost:5173",
//     "http://100.82.118.5:5173", 
//     "https://core-management.vercel.app",
//     "https://core-management-pi.vercel.app"
//   ],
//   methods: ['GET', 'POST'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));
app.use(cors());

app.use(express.json());

//  api dari google drive/link google drive
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// log api google drive
console.log("API KEY:", GOOGLE_API_KEY);
console.log("FOLDER ID:", GOOGLE_DRIVE_FOLDER_ID);

//  endpoint appscript
app.get('/', (req, res) => {
  res.send('Server is running. Endpoint tersedia di /files dan /download/:fileId');
});

//  list file dari google drive
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

//  download file drive nya
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

//  mulai server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});