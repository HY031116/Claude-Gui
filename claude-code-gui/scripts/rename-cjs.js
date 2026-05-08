import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist-electron');

if (!fs.existsSync(distDir)) {
  console.error('dist-electron directory not found');
  process.exit(1);
}

const files = fs.readdirSync(distDir);

for (const file of files) {
  if (file.endsWith('.js')) {
    const oldPath = path.join(distDir, file);
    const newPath = path.join(distDir, file.replace(/\.js$/, '.cjs'));
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed: ${file} -> ${path.basename(newPath)}`);
  }
}

// Update require references in main.cjs
const mainPath = path.join(distDir, 'main.cjs');
if (fs.existsSync(mainPath)) {
  let content = fs.readFileSync(mainPath, 'utf-8');
  // Handle both single and double quotes
  content = content.replace(/preload\.js/g, 'preload.cjs');
  content = content.replace(/\.\/cli-service\b/g, './cli-service.cjs');
  content = content.replace(/\.\/file-service\b/g, './file-service.cjs');
  fs.writeFileSync(mainPath, content);
  console.log("Updated require references in main.cjs");
}

console.log('Done renaming .js to .cjs');
