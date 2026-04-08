const fs = require('fs');
const path = require('path');
const { uploadPdf, isS3Configured } = require('./s3Service');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');

/**
 * Extract embedded images from a PDF page using pdfjs-dist.
 * Returns array of { key, width, height } for each image found.
 */
async function extractPageImages(pdfBuffer, pageNumber, bookId) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  const operatorList = await page.getOperatorList();
  const images = [];

  // Ensure image directory exists
  const bookImageDir = path.join(IMAGE_DIR, bookId.toString());
  if (!fs.existsSync(bookImageDir)) {
    fs.mkdirSync(bookImageDir, { recursive: true });
  }

  let imageIndex = 0;

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];

    // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82
    if (fn === 85 || fn === 82) {
      try {
        const imgName = operatorList.argsArray[i][0];
        const imgData = await page.objs.get(imgName);

        if (!imgData || !imgData.data) continue;

        imageIndex++;
        const key = `images/${bookId}/page${pageNumber}_img${imageIndex}.png`;
        const localPath = path.join(bookImageDir, `page${pageNumber}_img${imageIndex}.png`);

        // Convert raw image data to PNG using canvas
        const { createCanvas } = require('canvas');
        const imgCanvas = createCanvas(imgData.width, imgData.height);
        const ctx = imgCanvas.getContext('2d');
        const imgDataArray = ctx.createImageData(imgData.width, imgData.height);

        // pdfjs image data can be RGB or RGBA
        if (imgData.data.length === imgData.width * imgData.height * 4) {
          // RGBA
          imgDataArray.data.set(imgData.data);
        } else if (imgData.data.length === imgData.width * imgData.height * 3) {
          // RGB — convert to RGBA
          const src = imgData.data;
          const dst = imgDataArray.data;
          for (let j = 0, k = 0; j < src.length; j += 3, k += 4) {
            dst[k] = src[j];
            dst[k + 1] = src[j + 1];
            dst[k + 2] = src[j + 2];
            dst[k + 3] = 255;
          }
        } else {
          continue; // unknown format
        }

        ctx.putImageData(imgDataArray, 0, 0);
        const pngBuffer = imgCanvas.toBuffer('image/png');

        // Save locally
        fs.writeFileSync(localPath, pngBuffer);

        images.push({
          key,
          localPath,
          width: imgData.width,
          height: imgData.height,
        });

      } catch (err) {
        // Skip images that fail to extract
        console.warn(`Failed to extract image ${imageIndex} from page ${pageNumber}:`, err.message);
      }
    }
  }

  return images;
}

module.exports = { extractPageImages };
