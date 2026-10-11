import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 140, default: "" },
    icon: { type: String, maxlength: 16, default: "💬" },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    ownerKeyHash: { type: String, required: true, select: false },
    creatorIpHash: { type: String, select: false },
    reportCount: { type: Number, default: 0 },
    reportedBy: { type: [String], default: [], select: false },
    lastMessageAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

roomSchema.index({ visibility: 1, deletedAt: 1, lastMessageAt: -1 });
roomSchema.index({ creatorIpHash: 1, createdAt: -1 });

export default mongoose.models.Room || mongoose.model("Room", roomSchema);