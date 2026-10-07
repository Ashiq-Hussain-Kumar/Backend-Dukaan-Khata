import mongoose from "mongoose";
import bcrypt from "bcrypt";
const shopkeeperSchema = new mongoose.Schema({
  name:{
    type:String,
    required:true,
    trim:true,
  },
  email:{
    type:String,
    required:true,
    trim:true,
    unique:true,
    lowercase:true,
  },
  phone:{
    type:Number,
    required:true
  },
  password:{
    type:String,
    required:true
  } 
},{timestamps:true});


shopkeeperSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return 
  }

  this.password = await bcrypt.hash(this.password, 10);


});

shopkeeperSchema.methods.isPasswordCorrect = async function (password) {
 return await bcrypt.compare(password,this.password)
}
export const Shopkeeper = mongoose.model("Shopkeeper", shopkeeperSchema);