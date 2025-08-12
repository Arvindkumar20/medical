// // controllers/productController.js
// import { validationResult } from "express-validator";
// import { Product } from "../models/Product.js"; // ESM export
// import { rateLimiter } from "../middlewares/rateLimiter.js";
// import { logger } from "../utils/logger.js";
// import { uploadBuffer } from "../utils/cloudinary.js"; // Cloudinary helper
// import { Store } from "../models/Store.js";

// // Helper to parse pagination/sorting/filtering
// const parseQuery = (query) => {
//   const page = Math.max(1, parseInt(query.page, 10) || 1);
//   const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
//   const skip = (page - 1) * limit;

//   const filter = { isDeleted: false };

//   if (query.search) {
//     filter.$text = { $search: query.search };
//   }

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

//   if (query.store) {
//     filter.store = query.store;
//   }

//   if (query.category) {
//     filter.category = query.category;
//   }

//   let sort = { createdAt: -1 };
//   if (query.sortBy) {
//     const dir = query.order === "asc" ? 1 : -1;
//     const allowed = ["price", "name", "createdAt", "quantity", "ratings.average"];
//     if (allowed.includes(query.sortBy)) {
//       sort = { [query.sortBy]: dir };
//     }
//   }

//   return { page, limit, skip, filter, sort };
// };

// // Process incoming images: multipart files + raw URLs
// const processImages = async (req) => {
//   const resultImages = [];

//   // Files uploaded via multer (memoryStorage)
//   if (req.files && req.files.length) {
//     for (const file of req.files) {
//       try {
//         const uploadRes = await uploadBuffer(file.buffer, file.originalname);
//         if (uploadRes && uploadRes.secure_url) {
//           resultImages.push(uploadRes.secure_url);
//         }
//       } catch (e) {
//         logger.warn("Cloudinary upload failed for image", { filename: file.originalname, error: e.message });
//       }
//     }
//   }

//   // Also accept images passed as URLs in body.images
//   if (req.body.images) {
//     const fromBody = Array.isArray(req.body.images)
//       ? req.body.images
//       : String(req.body.images).split(",").map((s) => s.trim()).filter(Boolean);
//     resultImages.push(...fromBody);
//   }

//   return resultImages;
// };

// // GET /api/products
// export const getProducts = [
//   rateLimiter(100, 15 * 60),
//   async (req, res, next) => {
//     try {
//       const { page, limit, skip, filter, sort } = parseQuery(req.query);

//       if (req.query.lowStock === "true") {
//         const threshold = parseInt(req.query.threshold || 10, 10);
//         if (!isNaN(threshold)) {
//           filter.quantity = { $lte: threshold };
//         }
//       }

//       const [total, products] = await Promise.all([
//         Product.countDocuments(filter),
//         Product.find(filter).sort(sort).skip(skip).limit(limit).lean()
//       ]);

//       const totalPages = Math.ceil(total / limit);

//       res.json({
//         success: true,
//         meta: {
//           total,
//           page,
//           limit,
//           totalPages,
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
//         isDeleted: false
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
//         logger.warn("Validation errors in createProduct", { errors: errors.array() });
//         return res.status(400).json({
//           success: false,
//           errors: errors.array()
//         });
//       }

//       // Store ID must be present
//       if (!req.body.store) {
//         return res.status(400).json({
//           success: false,
//           message: "Store ID is required"
//         });
//       }
//       console.log(typeof req.body.store);
//       // Check if store exists & belongs to logged-in user
//       let store;
//       try {
//         store = await Store.findOne({ _id: req.body.store});
//         console.log(store);
//       } catch (error) {
//         return res.json({
//           message: "error in fetching store",
//           error: error
//         })
//       }
//       if (!store) {
//         return res.status(404).json({
//           success: false,
//           message: "Store not found"
//         });
//       }
// req.user?.id
//       if (String(store.owner) !== String(req.user?.id)) {
//         return res.status(403).json({
//           success: false,
//           message: "You are not authorized to add products to this store"
//         });
//       }

//       // Check duplicate
//       const existingProduct = await Product.findOne({
//         name: req.body.name,
//         store: req.body.store, // check within same store
//         isDeleted: false
//       });
//       if (existingProduct) {
//         logger.warn(`Duplicate product creation attempt: ${req.body.name}`);
//         return res.status(409).json({
//           success: false,
//           message: "Product with this name already exists in this store"
//         });
//       }

//       // Handle images
//       const images = await processImages(req);
//       if (images.length) {
//         req.body.images = images;
//       }

//       // Assign store ID explicitly (security)
//       req.body.store = store._id;

//       const product = await Product.create(req.body);
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

// // export const createProduct = [
// //   rateLimiter(50, 15 * 60),
// //   async (req, res, next) => {
// //     try {
// //       // Validate request
// //       const errors = validationResult(req);
// //       if (!errors.isEmpty()) {
// //         logger.warn("Validation errors in createProduct", { errors: errors.array() });
// //         return res.status(400).json({
// //           success: false,
// //           errors: errors.array()
// //         });
// //       }

// //       // Check duplicate
// //       const existingProduct = await Product.findOne({
// //         name: req.body.name,
// //         isDeleted: false
// //       });
// //       if (existingProduct) {
// //         logger.warn(`Duplicate product creation attempt: ${req.body.name}`);
// //         return res.status(409).json({
// //           success: false,
// //           message: "Product with this name already exists"
// //         });
// //       }

// //       // Handle images
// //       const images = await processImages(req);
// //       if (images.length) {
// //         req.body.images = images;
// //       }
// //       const product = await Product.create(req.body);
// //       logger.info(`Product created: ${product._id}`, {
// //         productId: product._id,
// //         createdBy: req.user?.id
// //       });

// //       res.status(201).json({
// //         success: true,
// //         data: product
// //       });
// //     } catch (err) {
// //       logger.error(`Error in createProduct: ${err.message}`, {
// //         body: req.body,
// //         stack: err.stack
// //       });
// //       next(err);
// //     }
// //   }
// // ];

// // PUT /api/products/:id
// export const updateProduct = [
//   rateLimiter(50, 15 * 60),
//   async (req, res, next) => {
//     try {
//       // Validate
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({
//           success: false,
//           errors: errors.array()
//         });
//       }

//       // Handle images (replace or merge; here replace)
//       const images = await processImages(req);
//       if (images.length) {
//         req.body.images = images;
//       }

//       const updated = await Product.findOneAndUpdate(
//         {
//           _id: req.params.id,
//           isDeleted: false
//         },
//         req.body,
//         {
//           new: true,
//           runValidators: true,
//           context: "query"
//         }
//       );

//       if (!updated) {
//         logger.warn(`Product not found for update: ${req.params.id}`);
//         return res.status(404).json({
//           success: false,
//           message: "Product not found"
//         });
//       }

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
//       const deleted = await Product.findOneAndUpdate(
//         {
//           _id: req.params.id,
//           isDeleted: false
//         },
//         {
//           isDeleted: true,
//           deletedAt: new Date(),
//           deletedBy: req.user?.id
//         },
//         { new: true }
//       );

//       if (!deleted) {
//         logger.warn(`Product not found for deletion: ${req.params.id}`);
//         return res.status(404).json({
//           success: false,
//           message: "Product not found"
//         });
//       }

//       logger.info(`Product soft-deleted: ${req.params.id}`, {
//         productId: req.params.id,
//         deletedBy: req.user?.id
//       });

//       res.json({
//         success: true,
//         message: "Product deleted",
//         data: {
//           deletedAt: deleted.deletedAt
//         }
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
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({
//           success: false,
//           errors: errors.array()
//         });
//       }

//       const delta = parseInt(req.body.delta, 10);
//       if (isNaN(delta)) {
//         logger.warn(`Invalid delta in adjustStock: ${req.body.delta}`);
//         return res.status(400).json({
//           success: false,
//           message: "Invalid delta"
//         });
//       }

//       const product = await Product.findOne({
//         _id: req.params.id,
//         isDeleted: false
//       });

//       if (!product) {
//         return res.status(404).json({
//           success: false,
//           message: "Product not found"
//         });
//       }

//       product.quantity = Math.max(0, product.quantity + delta);
//       await product.save();

//       logger.info(`Stock adjusted for product: ${req.params.id}`, {
//         productId: req.params.id,
//         delta,
//         newQuantity: product.quantity,
//         adjustedBy: req.user?.id
//       });

//       res.json({
//         success: true,
//         data: product
//       });
//     } catch (err) {
//       logger.error(`Error in adjustStock: ${err.message}`, {
//         productId: req.params.id,
//         delta: req.body.delta,
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
//       const { filter } = parseQuery(req.query);
//       const format = req.query.format || "json";

//       const products = await Product.find(filter).lean();

//       if (format === "csv") {
//         const fields = ["_id", "name", "price", "quantity", "status"];
//         const csv = [
//           fields.join(","),
//           ...products.map((p) =>
//             fields
//               .map((f) => `"${String(p[f] || "").replace(/"/g, '""')}"`)
//               .join(",")
//           )
//         ].join("\n");

//         res.setHeader("Content-Type", "text/csv");
//         res.setHeader("Content-Disposition", "attachment; filename=products.csv");
//         return res.send(csv);
//       }

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
import { Store } from "../models/Store.js"; // Added Store model
import { rateLimiter } from "../middlewares/rateLimiter.js";
import { logger } from "../utils/logger.js";
import { uploadBuffer } from "../utils/cloudinary.js";

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

// Process incoming images
const processImages = async (req) => {
  const resultImages = [];

  if (req.files && req.files.length) {
    for (const file of req.files) {
      try {
        const uploadRes = await uploadBuffer(file.buffer, file.originalname);
        if (uploadRes?.secure_url) resultImages.push(uploadRes.secure_url);
      } catch (e) {
        logger.warn("Cloudinary upload failed", { filename: file.originalname, error: e.message });
      }
    }
  }

  if (req.body.images) {
    const fromBody = Array.isArray(req.body.images)
      ? req.body.images
      : String(req.body.images).split(",").map((s) => s.trim()).filter(Boolean);
    resultImages.push(...fromBody);
  }

  return resultImages;
};

// GET /api/products
// export const getProducts = [
//   rateLimiter(100, 15 * 60),
//   async (req, res, next) => {
//     try {
//       const { page, limit, skip, filter, sort } = parseQuery(req.query);

//       if (req.query.lowStock === "true") {
//         const threshold = parseInt(req.query.threshold || 10, 10);
//         if (!isNaN(threshold)) filter.quantity = { $lte: threshold };
//       }

//       const [total, products] = await Promise.all([
//         Product.countDocuments(filter),
//         Product.find(filter).sort(sort).skip(skip).limit(limit).lean()
//       ]);
// console.log(total,products)
//       res.json({
//         success: true,
//         meta: { total, page, limit, totalPages: Math.ceil(total / limit), fromCache: false },
//         data: products
//       });
//     } catch (err) {
//       logger.error(`Error in getProducts: ${err.message}`, { stack: err.stack });
//       next(err);
//     }
//   }
// ];
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
      let filter = {};

      // Merge filters from query if available
      if (req.query.filter) {
        try {
          // Handle JSON or nested query params
          if (typeof req.query.filter === "string") {
            filter = { ...filter, ...JSON.parse(req.query.filter) };
          } else {
            filter = { ...filter, ...req.query.filter };
          }
        } catch (err) {
          return res.status(400).json({ success: false, message: "Invalid filter format" });
        }
      }

      // Low stock filter
      if (req.query.lowStock === "true") {
        const threshold = parseInt(req.query.threshold || 10, 10);
        if (!isNaN(threshold)) {
          filter.quantity = { ...(filter.quantity || {}), $lte: threshold };
        }
      }

      // Sorting
      let sort = {};
      if (req.query.sort) {
        // e.g., sort=-createdAt,name
        const sortFields = req.query.sort.split(",");
        sortFields.forEach(field => {
          if (field.startsWith("-")) {
            sort[field.substring(1)] = -1;
          } else {
            sort[field] = 1;
          }
        });
      } else {
        sort = { createdAt: -1 }; // default sort
      }

      // Debug logs
      console.log("Final Filter:", filter);
      console.log("Sort:", sort);
      console.log("Skip:", skip, "Limit:", limit);

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
      const prod = await Product.findOne({ _id: req.params.id }).lean();
      if (!prod) {
        logger.warn(`Product not found: ${req.params.id}`);
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      res.json({ success: true, fromCache: false, data: prod });
    } catch (err) {
      logger.error(`Error in getProductById: ${err.message}`, { productId: req.params.id, stack: err.stack });
      next(err);
    }
  }
];

// POST /api/products
export const createProduct = [
  rateLimiter(50, 15 * 60),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn("Validation errors in createProduct", { errors: errors.array() });
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      if (!req.body.store) {
        return res.status(400).json({ success: false, message: "Store ID is required" });
      }
      if (isNaN(Number(req.body.price))) {
        // Yahan handle karo agar number convert nahi ho raha
        console.log("Invalid number");
      } else {
        req.body.price = Number(req.body.price);
      }
      let store;
      try {
        store = await Store.findOne({ _id: req.body.store });
      } catch (error) {
        return res.json({
          message: error.message,

        })
      }
      console.log(store)
      if (!store) return res.status(404).json({ success: false, message: "Store not found" });

      if (String(store.owner) !== String(req.user?.id)) {
        return res.status(403).json({ success: false, message: "You are not authorized to add products to this store" });
      }

      const existingProduct = await Product.findOne({
        name: req.body.name,
        store: req.body.store,
        isDeleted: false
      });
      if (existingProduct) {
        return res.status(409).json({ success: false, message: "Product with this name already exists in this store" });
      }

      const images = await processImages(req);
      if (images.length) req.body.images = images;

      req.body.store = store._id;

      const product = await Product.create(req.body);
      logger.info(`Product created: ${product._id}`, { productId: product._id, createdBy: req.user?.id, storeId: store._id });

      res.status(201).json({ success: true, data: product });
    } catch (err) {
      logger.error(`Error in createProduct: ${err.message}`, { body: req.body, stack: err.stack });
      next(err);
    }
  }
];

// PUT /api/products/:id
export const updateProduct = [
  rateLimiter(50, 15 * 60),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const product = await Product.findOne({ _id: req.params.id });
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });

      const store = await Store.findOne({ _id: product.store});
      if (!store || String(store.owner) !== String(req.user?.id)) {
        return res.status(403).json({ success: false, message: "You are not authorized to update this product" });
      }

      const images = await processImages(req);
      if (images.length) req.body.images = images;

      const updated = await Product.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        req.body,
        { new: true, runValidators: true, context: "query" }
      );

      logger.info(`Product updated: ${req.params.id}`, { productId: req.params.id, updatedBy: req.user?.id });
      res.json({ success: true, data: updated });
    } catch (err) {
      logger.error(`Error in updateProduct: ${err.message}`, { productId: req.params.id, stack: err.stack });
      next(err);
    }
  }
];

// DELETE /api/products/:id
export const deleteProduct = [
  rateLimiter(30, 15 * 60),
  async (req, res, next) => {
    try {
      const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });

      const store = await Store.findOne({ _id: product.store, isDeleted: false });
      if (!store || String(store.owner) !== String(req.user?.id)) {
        return res.status(403).json({ success: false, message: "You are not authorized to delete this product" });
      }

      const deleted = await Product.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        { isDeleted: true, deletedAt: new Date(), deletedBy: req.user?.id },
        { new: true }
      );

      logger.info(`Product soft-deleted: ${req.params.id}`, { productId: req.params.id, deletedBy: req.user?.id });
      res.json({ success: true, message: "Product deleted", data: { deletedAt: deleted.deletedAt } });
    } catch (err) {
      logger.error(`Error in deleteProduct: ${err.message}`, { productId: req.params.id, stack: err.stack });
      next(err);
    }
  }
];

// PATCH /api/products/:id/adjust-stock
export const adjustStock = [
  rateLimiter(100, 15 * 60),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const delta = parseInt(req.body.delta, 10);
      if (isNaN(delta)) return res.status(400).json({ success: false, message: "Invalid delta" });

      const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });

      const store = await Store.findOne({ _id: product.store, isDeleted: false });
      if (!store || String(store.owner) !== String(req.user?.id)) {
        return res.status(403).json({ success: false, message: "You are not authorized to adjust stock for this product" });
      }

      product.quantity = Math.max(0, product.quantity + delta);
      await product.save();

      logger.info(`Stock adjusted for product: ${req.params.id}`, { productId: req.params.id, delta, newQuantity: product.quantity, adjustedBy: req.user?.id });
      res.json({ success: true, data: product });
    } catch (err) {
      logger.error(`Error in adjustStock: ${err.message}`, { productId: req.params.id, delta: req.body.delta, stack: err.stack });
      next(err);
    }
  }
];

// GET /api/products/export
// export const exportProducts = [
//   rateLimiter(10, 60 * 60),
//   async (req, res, next) => {
//     try {
//       const { filter } = parseQuery(req.query);
//       const format = req.query.format || "json";

//       const products = await Product.find(filter).lean();

//       if (format === "csv") {
//         const fields = ["_id", "name", "price", "quantity", "status"];
//         const csv = [
//           fields.join(","),
//           ...products.map((p) =>
//             fields.map((f) => `"${String(p[f] || "").replace(/"/g, '""')}"`).join(",")
//           )
//         ].join("\n");

//         res.setHeader("Content-Type", "text/csv");
//         res.setHeader("Content-Disposition", "attachment; filename=products.csv");
//         return res.send(csv);
//       }

//       res.setHeader("Content-Type", "application/json");
//       res.setHeader("Content-Disposition", "attachment; filename=products.json");
//       res.send(JSON.stringify(products, null, 2));
//     } catch (err) {
//       logger.error(`Error in exportProducts: ${err.message}`, { stack: err.stack });
//       next(err);
//     }
//   }
// ];

// GET /api/products/export
export const exportProducts = [
  rateLimiter(10, 60 * 60), // 10 requests per hour
  async (req, res, next) => {
    try {
      // ✅ Filter build karna (parseQuery dependency hata di)
      let filter = {};
      if (req.query.filter) {
        try {
          if (typeof req.query.filter === "string") {
            filter = JSON.parse(req.query.filter); // string to object
          } else {
            filter = req.query.filter; // already object
          }
        } catch (e) {
          return res.status(400).json({ success: false, message: "Invalid filter format" });
        }
      }

      const format = req.query.format || "json";

      console.log("Export Filter:", filter);
      console.log("Export Format:", format);

      const products = await Product.find(filter).lean();

      // ✅ Agar products empty hain
      if (!products.length) {
        return res.status(404).json({ success: false, message: "No products found" });
      }

      // ✅ CSV Export
      if (format === "csv") {
        const fields = ["_id", "name", "price", "quantity", "status"];
        const csvData = [
          fields.join(","), // header row
          ...products.map((p) =>
            fields.map((f) => `"${String(p[f] || "").replace(/"/g, '""')}"`).join(",")
          )
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=products.csv");
        return res.send(csvData);
      }

      // ✅ JSON Export
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=products.json");
      res.send(JSON.stringify(products, null, 2));

    } catch (err) {
      console.error("Error in exportProducts:", err);
      logger.error(`Error in exportProducts: ${err.message}`, { stack: err.stack });
      next(err);
    }
  }
];

