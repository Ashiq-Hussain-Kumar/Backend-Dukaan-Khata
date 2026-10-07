import { connectDB } from "./db/db";
import app from "./app.js";
const startSever = async () => {
  try {
    await connectDB();

    app.listen("5000",()=>{
      console.log("server islistening at port 5000");
      
    })
  } catch (error) {
    console.log(`Server startup failed ${error}`);
    process.exit(1);
    
  }
}

startSever();