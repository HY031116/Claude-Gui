/**
 * 将 public/favicon.svg 转换为 public/favicon.ico（多尺寸：16/32/48/256）
 */
const sharp = require('sharp');
const { default: pngToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/favicon.svg');
const outIco = path.join(__dirname, '../public/favicon.ico');
const tmpDir = path.join(__dirname, '../public/.ico-tmp');

const sizes = [16, 32, 48, 256];

async function run() {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const pngFiles = [];
  for (const size of sizes) {
    const outPng = path.join(tmpDir, `icon-${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outPng);
    pngFiles.push(outPng);
    console.log(`生成 ${size}x${size} PNG`);
  }

  const icoBuffer = await pngToIco(pngFiles);
  fs.writeFileSync(outIco, icoBuffer);
  console.log(`✓ 已生成 ${outIco}`);

  // 清理临时文件
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

run().catch(err => { console.error(err); process.exit(1); });
