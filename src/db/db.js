import mongoose from "mongoose"
import "dotenv/config";

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected Successfully ${connectionInstance.connection.host}`);
    
  } catch (error) {
    console.log(`MongoDB not able to connect ${error}`);
    process.exit(1);
  }
}