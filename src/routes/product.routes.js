import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createProduct, getProducts, updateProduct, deleteProduct } from "../controllers/product.controller.js";

const productRouter = Router();

productRouter.use(verifyJWT); 

productRouter.post("/create-product", createProduct);
productRouter.get("/get-products", getProducts);
productRouter.patch("/:productId", updateProduct);
productRouter.delete("/:productId", deleteProduct);

export { productRouter };