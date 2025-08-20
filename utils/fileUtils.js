// utils/fileUtils.js
import fs from 'fs';

export const createUploadsDir = () => {
  const uploadsDir = 'uploads';
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Uploads directory created');
  }
};