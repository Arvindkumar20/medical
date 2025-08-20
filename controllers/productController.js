

// // controllers/productController.js
// import { validationResult } from "express-validator";
// import { Product } from "../models/Product.js";
// import { Store } from "../models/Store.js";
// import { rateLimiter } from "../middlewares/rateLimiter.js";
// import { logger } from "../utils/logger.js";
// // import axios from "axios";

// // Helper to parse pagination/sorting/filtering
// const parseQuery = (query) => {
//   const page = Math.max(1, parseInt(query.page, 10) || 1);
//   const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
//   const skip = (page - 1) * limit;

//   const filter = { isDeleted: false };

//   if (query.search) filter.$text = { $search: query.search };

//   if (query.minPrice || query.maxPrice) {
//     filter.price = {};
//     if (query.minPrice) {
//       const minPrice = parseFloat(query.minPrice);
//       if (!isNaN(minPrice)) filter.price.$gte = minPrice;
//     }
//     if (query.maxPrice) {
//       const maxPrice = parseFloat(query.maxPrice);
//       if (!isNaN(maxPrice)) filter.price.$lte = maxPrice;
//     }
//   }

//   if (query.status) {
//     const allowedStatuses = ["active", "inactive", "out_of_stock", "out-of-stock"];
//     if (allowedStatuses.includes(query.status)) {
//       filter.status = query.status.replace("out-of-stock", "out_of_stock");
//     }
//   }

//   if (query.tags) {
//     try {
//       const tagsArr = String(query.tags)
//         .split(",")
//         .map((t) => t.trim().toLowerCase())
//         .filter(Boolean);
//       if (tagsArr.length) filter.tags = { $in: tagsArr };
//     } catch (err) {
//       logger.warn(`Invalid tags parameter: ${query.tags}`);
//     }
//   }

//   if (query.store) filter.store = query.store;
//   if (query.category) filter.category = query.category;

//   let sort = { createdAt: -1 };
//   if (query.sortBy) {
//     const dir = query.order === "asc" ? 1 : -1;
//     const allowed = ["price", "name", "createdAt", "quantity", "ratings.average"];
//     if (allowed.includes(query.sortBy)) sort = { [query.sortBy]: dir };
//   }

//   return { page, limit, skip, filter, sort };
// };

// // Process images - ensures all are stored on Cloudinary
// const processImages = async (req) => {
//   const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
//   const resultImages = [];

//   // 1. Process uploaded files
//   if (req.files?.length) {
//     for (const file of req.files) {
//       try {
//         const uploadRes = await uploadBuffer(file.buffer, file.originalname);
//         if (uploadRes?.secure_url) {
//           resultImages.push(uploadRes.secure_url);
//         }
//       } catch (e) {
//         logger.warn("Cloudinary upload failed", {
//           filename: file.originalname,
//           error: e.message
//         });
//       }
//     }
//   }

//   // 2. Process body.images - ensure all are Cloudinary URLs
//   if (req.body.images) {
//     const urls = Array.isArray(req.body.images)
//       ? req.body.images
//       : String(req.body.images).split(',').map(s => s.trim()).filter(Boolean);

//     for (const url of urls) {
//       // Accept existing Cloudinary URLs
//       if (url.includes(`res.cloudinary.com/${cloudName}/`)) {
//         resultImages.push(url);
//         continue;
//       }

//       // Upload external URLs to Cloudinary
//       try {
//         const uploadRes = await uploadFromUrl(url);
//         if (uploadRes?.secure_url) {
//           resultImages.push(uploadRes.secure_url);
//         }
//       } catch (e) {
//         logger.warn(`Failed to process image URL: ${url}`, {
//           error: e.message
//         });
//       }
//     }
//   }

//   return resultImages;
// };

// // GET /api/products
// export const getProducts = [
//   rateLimiter(100, 15 * 60),
//   async (req, res, next) => {
//     try {
//       // Default query params
//       const page = parseInt(req.query.page) || 1;
//       const limit = parseInt(req.query.limit) || 10;
//       const skip = (page - 1) * limit;

//       // Initial filter
//       // let filter = { isDeleted: false };
//       let filter;
//       // Merge filters
//       if (req.query.filter) {
//         try {
//           filter = {
//             ...filter,
//             ...(typeof req.query.filter === "string"
//               ? JSON.parse(req.query.filter)
//               : req.query.filter)
//           };
//         } catch (err) {
//           return res.status(400).json({
//             success: false,
//             message: "Invalid filter format"
//           });
//         }
//       }

//       // Low stock filter
//       if (req.query.lowStock === "true") {
//         const threshold = parseInt(req.query.threshold || 10, 10);
//         if (!isNaN(threshold)) {
//           filter.quantity = { $lte: threshold };
//         }
//       }

//       // Sorting
//       let sort = {};
//       if (req.query.sort) {
//         req.query.sort.split(',').forEach(field => {
//           sort[field.startsWith('-') ? field.substring(1) : field] =
//             field.startsWith('-') ? -1 : 1;
//         });
//       } else {
//         sort = { createdAt: -1 };
//       }

//       // Fetch data
//       const [total, products] = await Promise.all([
//         Product.countDocuments(filter),
//         Product.find(filter).sort(sort).skip(skip).limit(limit).lean()
//       ]);

//       // Response
//       res.json({
//         success: true,
//         meta: {
//           total,
//           page,
//           limit,
//           totalPages: Math.ceil(total / limit),
//           fromCache: false
//         },
//         data: products
//       });
//     } catch (err) {
//       logger.error(`Error in getProducts: ${err.message}`, { stack: err.stack });
//       next(err);
//     }
//   }
// ];

// // GET /api/products/:id
// export const getProductById = [
//   rateLimiter(100, 15 * 60),
//   async (req, res, next) => {
//     try {
//       const prod = await Product.findOne({
//         _id: req.params.id,
//         // isDeleted: false
//       }).lean();

//       if (!prod) {
//         logger.warn(`Product not found: ${req.params.id}`);
//         return res.status(404).json({
//           success: false,
//           message: "Product not found"
//         });
//       }

//       res.json({
//         success: true,
//         fromCache: false,
//         data: prod
//       });
//     } catch (err) {
//       logger.error(`Error in getProductById: ${err.message}`, {
//         productId: req.params.id,
//         stack: err.stack
//       });
//       next(err);
//     }
//   }
// ];

// // POST /api/products
// export const createProduct = [
//   rateLimiter(50, 15 * 60),
//   async (req, res, next) => {
//     try {
//       // Validate request
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         logger.warn("Validation errors in createProduct", {
//           errors: errors.array()
//         });
//         return res.status(400).json({
//           success: false,
//           errors: errors.array()
//         });
//       }

//       // Store validation
//       if (!req.body.store) {
//         return res.status(400).json({
//           success: false,
//           message: "Store ID is required"
//         });
//       }

//       // Convert price to number
//       if (!isNaN(req.body.price)) {
//         req.body.price = Number(req.body.price);
//       }

//       // Store verification
//       const store = await Store.findOne({ _id: req.body.store });
//       if (!store) {
//         return res.status(404).json({
//           success: false,
//           message: "Store not found"
//         });
//       }

//       // Authorization check
//       if (String(store.owner) !== String(req.user?.id)) {
//         return res.status(403).json({
//           success: false,
//           message: "Unauthorized to add products to this store"
//         });
//       }

//       // Check duplicate
//       const existingProduct = await Product.findOne({
//         name: req.body.name,
//         store: req.body.store,
//         // isDeleted: false
//       });

//       if (existingProduct) {
//         return res.status(409).json({
//           success: false,
//           message: "Product name already exists in this store"
//         });
//       }

//       // Process images - ensure Cloudinary storage
//       req.body.images = await processImages(req);

//       // Create product
//       const product = await Product.create({
//         ...req.body,
//         store: store._id
//       });

//       logger.info(`Product created: ${product._id}`, {
//         productId: product._id,
//         createdBy: req.user?.id,
//         storeId: store._id
//       });

//       res.status(201).json({
//         success: true,
//         data: product
//       });
//     } catch (err) {
//       logger.error(`Error in createProduct: ${err.message}`, {
//         body: req.body,
//         stack: err.stack
//       });
//       next(err);
//     }
//   }
// ];

// // PUT /api/products/:id
// export const updateProduct = [
//   rateLimiter(50, 15 * 60),
//   async (req, res, next) => {
//     try {
//       // Validate request
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({
//           success: false,
//           errors: errors.array()
//         });
//       }

//       // Get product
//       const product = await Product.findOne({
//         _id: req.params.id,
//         // isDeleted: false
//       });

//       if (!product) {
//         return res.status(404).json({
//           success: false,
//           message: "Product not found"
//         });
//       }

//       // Get store and verify ownership
//       const store = await Store.findById(product.store);
//       if (!store || String(store.owner) !== String(req.user?.id)) {
//         return res.status(403).json({
//           success: false,
//           message: "Unauthorized to update this product"
//         });
//       }

//       // Process images - ensure Cloudinary storage
//       if (req.files || req.body.images) {
//         req.body.images = await processImages(req);
//       }

//       // Update product
//       const updated = await Product.findOneAndUpdate(
//         { _id: req.params.id },
//         req.body,
//         { new: true, runValidators: true }
//       );

//       logger.info(`Product updated: ${req.params.id}`, {
//         productId: req.params.id,
//         updatedBy: req.user?.id
//       });

//       res.json({
//         success: true,
//         data: updated
//       });
//     } catch (err) {
//       logger.error(`Error in updateProduct: ${err.message}`, {
//         productId: req.params.id,
//         stack: err.stack
//       });
//       next(err);
//     }
//   }
// ];

// // DELETE /api/products/:id
// export const deleteProduct = [
//   rateLimiter(30, 15 * 60),
//   async (req, res, next) => {
//     try {
//       // Find product
//       const product = await Product.findOne({
//         _id: req.params.id,
//         // isDeleted: false
//       });

//       if (!product) {
//         return res.status(404).json({
//           success: false,
//           message: "Product not found"
//         });
//       }

//       // Verify store ownership
//       // const store = await Store.findById(product.store);
//       // if (!store || String(store.owner) !== String(req.user?.id)) {
//       //   return res.status(403).json({
//       //     success: false,
//       //     message: "Unauthorized to delete this product"
//       //   });
//       // }

//       // Soft delete
//       const deleted = await Product.findByIdAndDelete({
//         _id: req.params.id
//       })
//       // const deleted = await Product.findOneAndUpdate(
//       //   { _id: req.params.id },
//       //   {
//       //     isDeleted: true,
//       //     deletedAt: new Date(),
//       //     deletedBy: req.user?.id
//       //   },
//       //   { new: true }
//       // );

//       logger.info(`Product soft-deleted: ${req.params.id}`, {
//         productId: req.params.id,
//         deletedBy: req.user?.id
//       });

//       res.json({
//         success: true,
//         message: "Product deleted",
//         data: { deletedAt: deleted.deletedAt }
//       });
//     } catch (err) {
//       logger.error(`Error in deleteProduct: ${err.message}`, {
//         productId: req.params.id,
//         stack: err.stack
//       });
//       next(err);
//     }
//   }
// ];

// // PATCH /api/products/:id/adjust-stock
// export const adjustStock = [
//   rateLimiter(100, 15 * 60),
//   async (req, res, next) => {
//     try {
//       // Validate request
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({
//           success: false,
//           errors: errors.array()
//         });
//       }

//       // Validate delta
//       const delta = parseInt(req.body.delta, 10);
//       if (isNaN(delta)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid delta value"
//         });
//       }

//       // Find product
//       const product = await Product.findOne({
//         _id: req.params.id,
isDeleted: false
//       });

//       if (!product) {
//         return res.status(404).json({
//           success: false,
//           message: "Product not found"
//         });
//       }

//       // Verify store ownership
//       const store = await Store.findById(product.store);
//       if (!store || String(store.owner) !== String(req.user?.id)) {
//         return res.status(403).json({
//           success: false,
//           message: "Unauthorized to adjust stock"
//         });
//       }

//       // Update quantity
//       product.quantity = Math.max(0, product.quantity + delta);
//       await product.save();

//       logger.info(`Stock adjusted: ${req.params.id}`, {
//         productId: req.params.id,
//         delta,
//         newQuantity: product.quantity
//       });

//       res.json({
//         success: true,
//         data: product
//       });
//     } catch (err) {
//       logger.error(`Error in adjustStock: ${err.message}`, {
//         productId: req.params.id,
//         stack: err.stack
//       });
//       next(err);
//     }
//   }
// ];

// // GET /api/products/export
// export const exportProducts = [
//   rateLimiter(10, 60 * 60),
//   async (req, res, next) => {
//     try {
//       // Build filter
//       let filter = { isDeleted: false };

//       if (req.query.filter) {
//         try {
//           filter = {
//             ...filter,
//             ...(typeof req.query.filter === "string"
//               ? JSON.parse(req.query.filter)
//               : req.query.filter)
//           };
//         } catch (e) {
//           return res.status(400).json({
//             success: false,
//             message: "Invalid filter format"
//           });
//         }
//       }

//       const format = req.query.format || "json";
//       const products = await Product.find(filter).lean();

//       if (!products.length) {
//         return res.status(404).json({
//           success: false,
//           message: "No products found"
//         });
//       }

//       // CSV Export
//       if (format === "csv") {
//         const fields = ["_id", "name", "price", "quantity", "status", "category"];
//         const csvData = [
//           fields.join(","),
//           ...products.map(p =>
//             fields.map(f =>
//               `"${String(p[f] || '').replace(/"/g, '""')}"`
//             ).join(',')
//           )
//         ].join('\n');

//         res.setHeader("Content-Type", "text/csv");
//         res.setHeader("Content-Disposition", "attachment; filename=products.csv");
//         return res.send(csvData);
//       }

//       // JSON Export
//       res.setHeader("Content-Type", "application/json");
//       res.setHeader("Content-Disposition", "attachment; filename=products.json");
//       res.send(JSON.stringify(products, null, 2));
//     } catch (err) {
//       logger.error(`Error in exportProducts: ${err.message}`, { stack: err.stack });
//       next(err);
//     }
//   }
// ];





// controllers/productController.js
import { validationResult } from "express-validator";
import { Product } from "../models/Product.js";
import { Store } from "../models/Store.js";
import { rateLimiter } from "../middlewares/rateLimiter.js";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse pagination/sorting/filtering
const parseQuery = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { isDeleted: false };

  if (query.search) filter.$text = { $search: query.search };

  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) {
      const minPrice = parseFloat(query.minPrice);
      if (!isNaN(minPrice)) filter.price.$gte = minPrice;
    }
    if (query.maxPrice) {
      const maxPrice = parseFloat(query.maxPrice);
      if (!isNaN(maxPrice)) filter.price.$lte = maxPrice;
    }
  }

  if (query.status) {
    const allowedStatuses = ["active", "inactive", "out_of_stock", "out-of-stock"];
    if (allowedStatuses.includes(query.status)) {
      filter.status = query.status.replace("out-of-stock", "out_of_stock");
    }
  }

  if (query.tags) {
    try {
      const tagsArr = String(query.tags)
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tagsArr.length) filter.tags = { $in: tagsArr };
    } catch (err) {
      logger.warn(`Invalid tags parameter: ${query.tags}`);
    }
  }

  if (query.store) filter.store = query.store;
  if (query.category) filter.category = query.category;

  let sort = { createdAt: -1 };
  if (query.sortBy) {
    const dir = query.order === "asc" ? 1 : -1;
    const allowed = ["price", "name", "createdAt", "quantity", "ratings.average"];
    if (allowed.includes(query.sortBy)) sort = { [query.sortBy]: dir };
  }

  return { page, limit, skip, filter, sort };
};

// Helper to save files locally
const saveFileLocally = (file) => {
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
  const filePath = path.join(uploadDir, uniqueName);

  fs.writeFileSync(filePath, file.buffer);
  return `/uploads/${uniqueName}`;
};

// Process images - store locally
const processImages = (req) => {
  const resultImages = [];

  // 1. Process uploaded files
  if (req.files?.length) {
    for (const file of req.files) {
      try {
        const filePath = saveFileLocally(file);
        resultImages.push(filePath);
      } catch (e) {
        logger.warn("Local file save failed", {
          filename: file.originalname,
          error: e.message
        });
      }
    }
  }

  // 2. Process body.images - accept local paths only
  if (req.body.images) {
    const urls = Array.isArray(req.body.images)
      ? req.body.images
      : String(req.body.images).split(',').map(s => s.trim()).filter(Boolean);

    for (const url of urls) {
      // Accept only local paths that start with /uploads/
      if (url.startsWith('/uploads/')) {
        resultImages.push(url);
      } else {
        logger.warn(`Rejected non-local image URL: ${url}`);
      }
    }
  }

  return resultImages;
};

// GET /api/products
export const getProducts = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      // Default query params
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Initial filter
      // let filter = { isDeleted: false };
      let filter;

      // Merge filters
      if (req.query.filter) {
        try {
          filter = {
            ...filter,
            ...(typeof req.query.filter === "string"
              ? JSON.parse(req.query.filter)
              : req.query.filter)
          };
        } catch (err) {
          return res.status(400).json({
            success: false,
            message: "Invalid filter format"
          });
        }
      }

      // Low stock filter
      if (req.query.lowStock === "true") {
        const threshold = parseInt(req.query.threshold || 10, 10);
        if (!isNaN(threshold)) {
          filter.quantity = { $lte: threshold };
        }
      }

      // Sorting
      let sort = {};
      if (req.query.sort) {
        req.query.sort.split(',').forEach(field => {
          sort[field.startsWith('-') ? field.substring(1) : field] =
            field.startsWith('-') ? -1 : 1;
        });
      } else {
        sort = { createdAt: -1 };
      }

      // Fetch data
      const [total, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter).sort(sort).skip(skip).limit(limit).lean()
      ]);

      // Response
      res.json({
        success: true,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          fromCache: false
        },
        data: products
      });
    } catch (err) {
      logger.error(`Error in getProducts: ${err.message}`, { stack: err.stack });
      next(err);
    }
  }
];

// GET /api/products/:id
export const getProductById = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      const prod = await Product.findOne({
        _id: req.params.id,
        // isDeleted: false
      }).lean();

      if (!prod) {
        logger.warn(`Product not found: ${req.params.id}`);
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      res.json({
        success: true,
        fromCache: false,
        data: prod
      });
    } catch (err) {
      logger.error(`Error in getProductById: ${err.message}`, {
        productId: req.params.id,
        stack: err.stack
      });
      next(err);
    }
  }
];

// POST /api/products
export const createProduct = [
  rateLimiter(50, 15 * 60),
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn("Validation errors in createProduct", {
          errors: errors.array()
        });
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Store validation
      if (!req.body.store) {
        return res.status(400).json({
          success: false,
          message: "Store ID is required"
        });
      }

      // Convert price to number
      if (!isNaN(req.body.price)) {
        req.body.price = Number(req.body.price);
      }

      // Store verification
      // const store = await Store.findOne({ _id: req.body.store });
      // if (!store) {
      //   return res.status(404).json({
      //     success: false,
      //     message: "Store not found"
      //   });
      // }

      // Authorization check
      // if (String(store.owner) !== String(req.user?.id)) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Unauthorized to add products to this store"
      //   });
      // }

      // Check duplicate
      const existingProduct = await Product.findOne({
        name: req.body.name,
        // store: req.body.store,
        // isDeleted: false
      });

      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: "Product name already exists in this store"
        });
      }

      // Process images - store locally
      req.body.images = processImages(req);
      console.log(req.body.images);
      // Create product
      const product = await Product.create({
        ...req.body,
        // store: store._id
      });

      logger.info(`Product created: ${product._id}`, {
        productId: product._id,
        createdBy: req.user?.id,
        // storeId: store._id
      });

      res.status(201).json({
        success: true,
        data: product
      });
    } catch (err) {
      logger.error(`Error in createProduct: ${err.message}`, {
        body: req.body,
        stack: err.stack
      });
      next(err);
    }
  }
];

// PUT /api/products/:id
export const updateProduct = [
  rateLimiter(50, 15 * 60),
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Get product
      const product = await Product.findOne({
        _id: req.params.id,
        // isDeleted: false
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      // Get store and verify ownership
      const store = await Store.findById(product.store);
      if (!store || String(store.owner) !== String(req.user?.id)) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to update this product"
        });
      }

      // Process images - store locally
      if (req.files || req.body.images) {
        req.body.images = processImages(req);
      }

      // Update product
      const updated = await Product.findOneAndUpdate(
        { _id: req.params.id },
        req.body,
        { new: true, runValidators: true }
      );

      logger.info(`Product updated: ${req.params.id}`, {
        productId: req.params.id,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        data: updated
      });
    } catch (err) {
      logger.error(`Error in updateProduct: ${err.message}`, {
        productId: req.params.id,
        stack: err.stack
      });
      next(err);
    }
  }
];

// DELETE /api/products/:id
export const deleteProduct = [
  rateLimiter(30, 15 * 60),
  async (req, res, next) => {
    try {
      // Find product
      const product = await Product.findOne({
        _id: req.params.id,
        // isDeleted: false
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }
      const deleted = await Product.findByIdAndDelete({ _id: req.params.id })
      // Verify store ownership
      // const store = await Store.findById(product.store);
      // if (!store || String(store.owner) !== String(req.user?.id)) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Unauthorized to delete this product"
      //   });
      // }
      // const deleted = await Product.findByIdAndDelete({
      //   _id: req.params.id
      // });
      // Soft delete
      // const deleted = await Product.findOneAndUpdate(
      //   { _id: req.params.id },
      //   {
      //     isDeleted: true,
      //     deletedAt: new Date(),
      //     deletedBy: req.user?.id
      //   },
      //   { new: true }
      // );
      if (deleted) {
        return res.json({
          message: "product deleted successfully",
          deleted
        })
      }
      logger.info(`Product soft-deleted: ${req.params.id}`, {
        productId: req.params.id,
        deletedBy: req.user?.id
      });

      res.json({
        success: true,
        message: "Product deleted",
        // data: { deletedAt: deleted.deletedAt }
      });
    } catch (err) {
      logger.error(`Error in deleteProduct: ${err.message}`, {
        productId: req.params.id,
        stack: err.stack
      });
      next(err);
    }
  }
];

// PATCH /api/products/:id/adjust-stock
export const adjustStock = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Validate delta
      const delta = parseInt(req.body.delta, 10);
      if (isNaN(delta)) {
        return res.status(400).json({
          success: false,
          message: "Invalid delta value"
        });
      }

      // Find product
      const product = await Product.findOne({
        _id: req.params.id,
        // isDeleted: false
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      // Verify store ownership
      const store = await Store.findById(product.store);
      if (!store || String(store.owner) !== String(req.user?.id)) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to adjust stock"
        });
      }

      // Update quantity
      product.quantity = Math.max(0, product.quantity + delta);
      await product.save();

      logger.info(`Stock adjusted: ${req.params.id}`, {
        productId: req.params.id,
        delta,
        newQuantity: product.quantity
      });

      res.json({
        success: true,
        data: product
      });
    } catch (err) {
      logger.error(`Error in adjustStock: ${err.message}`, {
        productId: req.params.id,
        stack: err.stack
      });
      next(err);
    }
  }
];

// GET /api/products/export
export const exportProducts = [
  rateLimiter(10, 60 * 60),
  async (req, res, next) => {
    try {
      // Build filter
      let filter = { isDeleted: false };

      if (req.query.filter) {
        try {
          filter = {
            ...filter,
            ...(typeof req.query.filter === "string"
              ? JSON.parse(req.query.filter)
              : req.query.filter)
          };
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid filter format"
          });
        }
      }

      const format = req.query.format || "json";
      const products = await Product.find(filter).lean();

      if (!products.length) {
        return res.status(404).json({
          success: false,
          message: "No products found"
        });
      }

      // CSV Export
      if (format === "csv") {
        const fields = ["_id", "name", "price", "quantity", "status", "category"];
        const csvData = [
          fields.join(","),
          ...products.map(p =>
            fields.map(f =>
              `"${String(p[f] || '').replace(/"/g, '""')}"`
            ).join(',')
          )
        ].join('\n');

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=products.csv");
        return res.send(csvData);
      }

      // JSON Export
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=products.json");
      res.send(JSON.stringify(products, null, 2));
    } catch (err) {
      logger.error(`Error in exportProducts: ${err.message}`, { stack: err.stack });
      next(err);
    }
  }
];