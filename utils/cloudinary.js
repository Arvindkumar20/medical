// utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload buffer to Cloudinary.
 * @param {Buffer} buffer 
 * @param {string} originalName 
 * @param {string} folder 
 * @returns {Promise<object>}
 */
export const uploadBuffer = (buffer, originalName, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder || process.env.CLOUDINARY_UPLOAD_FOLDER || "medical_uploads",
        resource_type: "auto",
        public_id: `${Date.now()}_${originalName.replace(/\s+/g, "_")}`,
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    // streamifier is needed to pipe buffer
    import("streamifier").then(({ default: streamifier }) => {
      streamifier.createReadStream(buffer).pipe(uploadStream);
    }).catch(reject);
  });
};

/**
 * Delete by public_id
 * @param {string} publicId 
 */
export const deleteByPublicId = async (publicId) => {
  return cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
};

export default cloudinary;
