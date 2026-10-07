import express from "express";
import cors from "cors";
import cookiesparser from "cookie-parser";

const app = express();

app.use(express.json())
app.use(cors({
  origin:"http://localhost:3000",
  credentials:true
}));

app.use(cookiesparser());

// routes
//middleware
export default app;