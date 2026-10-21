import crypto from "node:crypto"

export const  generateVerificationToken = ()=>{
  const token = crypto.randomBytes(32).toString("hex")

  const hashedToken = crypto.createHash("sha256")
  .update(token)
  .digest("hex")

  return {token , hashedToken};
}