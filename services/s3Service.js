const fs = require('fs');
const path = require('path');
const { s3Client, bucketName } = require('../config/s3');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function isS3Configured() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && bucketName);
}

async function uploadPdf(fileBuffer, s3Key) {
  if (isS3Configured()) {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf',
    }));
    return { storage: 's3', key: s3Key };
  }

  // Local fallback
  const localPath = path.join(LOCAL_UPLOAD_DIR, s3Key);
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(localPath, fileBuffer);
  return { storage: 'local', key: s3Key };
}

async function getPdfBuffer(s3Key) {
  if (isS3Configured()) {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    }));
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  // Local fallback
  const localPath = path.join(LOCAL_UPLOAD_DIR, s3Key);
  return fs.readFileSync(localPath);
}

module.exports = { uploadPdf, getPdfBuffer, isS3Configured };
