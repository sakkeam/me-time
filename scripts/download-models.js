const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const DEST_DIR = path.join(__dirname, '../public/models');
const DEST_FILE = path.join(DEST_DIR, 'face_landmarker.task');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

console.log(`Downloading model from ${MODEL_URL}...`);

const file = fs.createWriteStream(DEST_FILE);

https.get(MODEL_URL, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download model: ${response.statusCode}`);
    return;
  }

  response.pipe(file);

  file.on('finish', () => {
    file.close();
    console.log(`Model downloaded to ${DEST_FILE}`);
  });
}).on('error', (err) => {
  fs.unlink(DEST_FILE, () => {}); // Delete the file async. (But we don't check the result)
  console.error(`Error downloading model: ${err.message}`);
});
