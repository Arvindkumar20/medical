import multer from "multer";
import path from "path";
import fs from "fs";

// Helper to create folder if not exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage for license
const licenseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/doctorsLicense";
    ensureDirExists(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_license" + path.extname(file.originalname));
  },
});

// Storage for certificate
const certificateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/doctorsCertificate";
    ensureDirExists(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_certificate" + path.extname(file.originalname));
  },
});

// Different uploaders
export const uploadLicense = multer({ storage: licenseStorage }).single("license");
export const uploadCertificate = multer({ storage: certificateStorage }).single("certificate");

// If you want both in one request:
export const uploadDoctorFiles = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      let dir = "uploads/others";
      if (file.fieldname === "license") dir = "uploads/doctorsLicense";
      if (file.fieldname === "certificate") dir = "uploads/doctorsCertificate";
      ensureDirExists(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "_" + file.fieldname + path.extname(file.originalname));
    },
  }),
}).fields([
  { name: "license", maxCount: 1 },
  { name: "certificate", maxCount: 1 },
]);
