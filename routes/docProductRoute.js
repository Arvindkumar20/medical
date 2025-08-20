// routes/productRoutes.js
import express from 'express';
import { processFileUpload, upload } from '../controllers/docProductController.js';
// import { upload, processFileUpload, getAllProducts } from '../controllers/productController.js';

const router = express.Router();

// Bulk product upload route
router.post('/bulk-upload', 
  upload.single('file'), 
  processFileUpload
);

// Get all products
// router.get('/', getAllProducts);

export default router;