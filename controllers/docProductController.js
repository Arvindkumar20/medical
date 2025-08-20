// controllers/productController.js
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js"; // Correct import for Node.js
import ExcelJS from "exceljs";
import path from "path";
import { Product } from "../models/Product.js";
import { Category } from "../models/Category.js";
import { Store } from "../models/Store.js";

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "text/csv",
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/json",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only CSV, PDF, Excel, and JSON files are allowed"
        ),
        false
      );
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Process uploaded file
const processFileUpload = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  try {
    const filePath = req.file.path;
    let results = [];
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
      case ".csv":
        results = await processCSV(filePath);
        break;
      case ".pdf":
        results = await processPDF(filePath);
        break;
      case ".xlsx":
      case ".xls":
        results = await processExcel(filePath);
        break;
      case ".json":
        results = await processJSON(filePath);
        break;
      default:
        throw new Error("Unsupported file format");
    }

    const operationResults = await processProducts(results);

    // Cleanup uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", filePath, err);
    });

    res.json({
      success: true,
      message: "File processed successfully",
      results: operationResults,
    });
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", req.file.path, err);
      });
    }
    res.status(500).json({
      success: false,
      message: "Error processing file",
      error: error.message,
    });
  }
};

// CSV Processing
const processCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
};

// PDF Processing using pdfjs-dist with correct import
const processPDF = async (filePath) => {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdfDocument = await pdfjs.getDocument({ data }).promise;
    const numPages = pdfDocument.numPages;
    let fullText = "";

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }

    return parsePDFText(fullText);
  } catch (error) {
    throw new Error(`PDF processing error: ${error.message}`);
  }
};

// Helper to parse PDF text into products
const parsePDFText = (text) => {
  const results = [];
  const products = text.split(/\n---\n|\n-{3,}\n/);

  for (const productText of products) {
    if (!productText.trim()) continue;

    const product = {};
    const lines = productText.split("\n");

    for (const line of lines) {
      const match = line.match(/^([\w\s]+):\s*(.+)$/);
      if (match) {
        const key = match[1].toLowerCase().replace(/\s+/g, "");
        product[key] = match[2].trim();
      }
    }

    if (Object.keys(product).length > 0) {
      results.push(product);
    }
  }

  return results;
};

// Excel Processing
const processExcel = async (filePath) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const results = [];
    const worksheet = workbook.worksheets[0];

    const headers = [];
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (cell.value)
        headers[colNumber] = cell.value.toString().toLowerCase().trim();
    });

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const productData = {};

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (headers[colNumber] && cell.value !== null) {
          productData[headers[colNumber]] = cell.value;
        }
      });

      if (Object.keys(productData).length > 0) {
        results.push(productData);
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Excel processing error: ${error.message}`);
  }
};

// JSON Processing
const processJSON = async (filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(data);

    if (Array.isArray(jsonData)) {
      return jsonData;
    } else if (jsonData.products && Array.isArray(jsonData.products)) {
      return jsonData.products;
    } else {
      throw new Error(
        'Invalid JSON structure. Expected array or object with "products" array'
      );
    }
  } catch (error) {
    throw new Error(`JSON processing error: ${error.message}`);
  }
};

// Create/Update Products
const processProducts = async (productsData) => {
  const results = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const [index, productData] of productsData.entries()) {
    try {
      const normalizedData = {};
      Object.keys(productData).forEach((key) => {
        normalizedData[key.toLowerCase()] = productData[key];
      });

      const requiredFields = ["name", "price"];
      const missingFields = requiredFields.filter((f) => !normalizedData[f]);
      if (missingFields.length > 0) {
        throw new Error(
          `Missing required fields: ${missingFields.join(", ")}`
        );
      }

      const processedData = {
        name: normalizedData.name.toString(),
        description: normalizedData.description?.toString() || "",
        price: parseFloat(normalizedData.price),
        quantity: parseInt(normalizedData.quantity || "0"),
        requiresPrescription: ["true", "yes", "1"].includes(
          (normalizedData.requiresprescription?.toString() || "").toLowerCase()
        ),
        images: normalizedData.images
          ? Array.isArray(normalizedData.images)
            ? normalizedData.images
            : normalizedData.images.split(";").filter((url) => url.trim())
          : [],
        tags: normalizedData.tags
          ? Array.isArray(normalizedData.tags)
            ? normalizedData.tags.map((tag) => tag.trim().toLowerCase())
            : normalizedData.tags
                .split(",")
                .map((tag) => tag.trim().toLowerCase())
          : [],
        store: normalizedData.store,
        category: normalizedData.category,
        sku: normalizedData.sku?.toString().toUpperCase(),
        barcode: normalizedData.barcode?.toString(),
        status: normalizedData.status || "active",
        manufacturer: normalizedData.manufacturer,
        expiryDate: normalizedData.expirydate
          ? new Date(normalizedData.expirydate)
          : undefined,
      };

      const store = await Store.findById(processedData.store);
      // if (!store || !store.approved || store.status !== "active") {
      //   throw new Error("Invalid store: must be approved and active");
      // }

      const category = await Category.findById(processedData.category);
      // if (!category) {
      //   throw new Error("Invalid category reference");
      // }

      const existingProduct = await Product.findOne({
        $or: [
          { sku: processedData.sku },
          { name: processedData.name, store: processedData.store },
        ],
      });

      if (existingProduct) {
        Object.assign(existingProduct, processedData);
        await existingProduct.save();
        results.updated++;
      } else {
        await Product.create(processedData);
        results.created++;
      }
    } catch (error) {
      results.skipped++;
      results.errors.push({
        index,
        name: productData.name || "Unknown",
        error: error.message,
      });
    }
  }

  return results;
};

// Export the functions
export { upload, processFileUpload };