import mongoose from "mongoose";

const identitySchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true, unique: true },
    secretHash: { type: String, required: true },
    handle: { type: String, required: true, maxlength: 24 },
  },
  { timestamps: true },
);

export default mongoose.models.Identity ||
  mongoose.model("Identity", identitySchema);
