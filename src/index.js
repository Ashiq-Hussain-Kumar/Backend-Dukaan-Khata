import { connectDB } from "./db/db.js";
import app from "./app.js";
import "dotenv/config"
const startServer = async () => {
  try {
    await connectDB();

    app.listen(process.env.PORT || 5000,()=>{
      console.log("server islistening at port 5000");
      
    })
  } catch (error) {
    console.log(`Server startup failed ${error}`);
    process.exit(1);
    
  }
}

startServer();