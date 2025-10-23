// backend/utils/cloudinaryUpload.js
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const uploadBuffer = (buffer, filename, folder = 'messages') => {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', public_id: filename?.split('.').slice(0, -1).join('.') || undefined },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(upload);
  });
};

module.exports = { cloudinary, uploadBuffer };
