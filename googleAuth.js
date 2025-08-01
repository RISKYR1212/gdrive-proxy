const fs = require('fs');
const { google } = require('googleapis');

// Path ke credentials dan token
const CREDENTIALS_PATH = './credentials.json';
const TOKEN_PATH = './token.json';

// Scopes untuk Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function authorize(callback) {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  } else {
    getAccessToken(oAuth2Client, callback);
  }
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('  Buka URL ini di browser untuk login:\n', authUrl);

  // Setelah login, user akan dapat kode — minta dia masukkan manual
  const readline = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });

  readline.question('Masukkan kode dari URL: ', (code) => {
    readline.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Gagal ambil token:', err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log(' Token disimpan ke', TOKEN_PATH);
      callback(oAuth2Client);
    });
  });
}

module.exports = { authorize };
