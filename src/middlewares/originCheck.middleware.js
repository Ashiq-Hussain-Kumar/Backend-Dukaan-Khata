
export const originCheck = (req, res, next) => {
  const origin = req.get("origin");
  if (origin && origin !== process.env.CLIENT_URL) {
    return res.status(403).json({ success: false, message: "Forbidden origin" });
  }
  next();
};