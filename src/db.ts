import mongoose from "mongoose";
import { MONGODB_URI } from "./config";

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// Content Schema
const ContentSchema = new mongoose.Schema({
  link: { type: String, required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }]
});

// Link Schema (for sharing)
const LinkSchema = new mongoose.Schema({
  hash: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
});

// Tag Schema (optional - for future use)
const TagSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true }
});

export const UserModel = mongoose.model("User", UserSchema);
export const ContentModel = mongoose.model("Content", ContentSchema);
export const LinkModel = mongoose.model("Link", LinkSchema);
export const TagModel = mongoose.model("Tag", TagSchema);





