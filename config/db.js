import mongoose from "mongoose";
import "dotenv/config"
export const connectDB = async () => {
  if(!process.env.MONGO_URI){
    console.log("mongo uri loading problem");
    process.exit(1);
    // return
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected ✅");
  } catch (error) {
    console.error("Mongo Error ❌", error.message);
    process.exit(error);
  }
};


