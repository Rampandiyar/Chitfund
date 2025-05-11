// utils/gridFS.js
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import sharp from 'sharp';

let gfs;

mongoose.connection.once('open', () => {
  gfs = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Upload image to GridFS
export const uploadImage = async (file) => {
  return new Promise((resolve, reject) => {
    const filename = `image-${Date.now()}`;
    const uploadStream = gfs.openUploadStream(filename);
    
    // Process image with sharp before storing
    sharp(file.buffer)
      .resize(500, 500)
      .jpeg({ quality: 90 })
      .pipe(uploadStream)
      .on('finish', () => resolve(filename))
      .on('error', reject);
  });
};

// Get image from GridFS
export const getImage = async (filename) => {
  const files = await gfs.find({ filename }).toArray();
  if (!files || files.length === 0) {
    return null;
  }
  
  return gfs.openDownloadStreamByName(filename);
};

// Delete image from GridFS
export const deleteImage = async (filename) => {
  const files = await gfs.find({ filename }).toArray();
  if (files.length > 0) {
    await gfs.delete(files[0]._id);
  }
};