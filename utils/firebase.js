// // utils/firebase.js
// import admin from "firebase-admin";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(
//       path.join(__dirname, "../firebase-service-account.json")
//     ),
//   });
// }

// export default admin;



import admin from "firebase-admin";
import { readFileSync } from "fs";

// Service Account Key JSON file path
const serviceAccount = JSON.parse(
  readFileSync(new URL("../firebase-service-account.json", import.meta.url))
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
