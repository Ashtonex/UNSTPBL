import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIcons() {
  const iconDir = path.join(__dirname, 'public', 'icons');
  const svgPath = path.join(iconDir, 'icon.svg');
  
  // Read original SVG
  const svgBuffer = await fs.readFile(svgPath);
  const svgString = svgBuffer.toString('utf-8');
  
  // Generate standard icons (keeping rounded corners)
  console.log('Generating icon-192.png...');
  await sharp(svgBuffer)
    .resize(192, 192)
    .toFile(path.join(iconDir, 'icon-192.png'));
    
  console.log('Generating icon-512.png...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .toFile(path.join(iconDir, 'icon-512.png'));
    
  // Generate maskable icon (removing rx="112" to make it square)
  // Maskable icons require a solid background filling the entire viewport to give the OS room to crop
  const maskableSvgString = svgString.replace(/rx="112"/g, 'rx="0"');
  const maskableSvgBuffer = Buffer.from(maskableSvgString);
  
  console.log('Generating icon-maskable-512.png...');
  await sharp(maskableSvgBuffer)
    .resize(512, 512)
    .toFile(path.join(iconDir, 'icon-maskable-512.png'));
    
  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
