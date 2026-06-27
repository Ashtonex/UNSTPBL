import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIcons() {
  const iconDir = path.join(__dirname, 'public', 'icons');
  const inputPath = 'C:\\Users\\ashjx\\.gemini\\antigravity\\brain\\8f58ccd4-57af-4b84-9d58-598da00dd2a2\\media__1782554914515.png';
  
  console.log('Generating icon-192.png...');
  await sharp(inputPath)
    .resize(192, 192, { fit: 'contain', background: '#000000' })
    .toFile(path.join(iconDir, 'icon-192.png'));
    
  console.log('Generating icon-512.png...');
  // For the standard 512, we can give it some padding so it looks nice
  await sharp(inputPath)
    .resize(400, 400, { fit: 'contain', background: '#000000' })
    .extend({ top: 56, bottom: 56, left: 56, right: 56, background: '#000000' })
    .toFile(path.join(iconDir, 'icon-512.png'));
    
  console.log('Generating icon-maskable-512.png...');
  // For maskable, we ensure it fits within the 400x400 safe zone, padded to 512x512
  await sharp(inputPath)
    .resize(400, 400, { fit: 'contain', background: '#000000' })
    .extend({ top: 56, bottom: 56, left: 56, right: 56, background: '#000000' })
    .toFile(path.join(iconDir, 'icon-maskable-512.png'));
    
  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
