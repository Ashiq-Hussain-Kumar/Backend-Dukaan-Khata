import "dotenv/config";
import { connectDB } from "./db/db.js";
import app from "./app.js";

const startServer = async () => {
  try {
    await connectDB();

    const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
  } catch (error) {
    console.log(`Server startup failed ${error}`);
    process.exit(1);
    
  }
}

startServer();