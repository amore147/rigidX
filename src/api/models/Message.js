import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    roomSlug: { type: String, required: true, default: "global" },
    text: { type: String, required: true, maxlength: 500 },
    authorId: { type: String, required: true },
    handle: { type: String, required: true, maxlength: 24 },
    clientId: { type: String, maxlength: 64 },
    reactions: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    editedAt: { type: Date, default: null },
    reportCount: { type: Number, default: 0 },
    reportedBy: { type: [String], default: [], select: false },
  },
  { timestamps: true, minimize: false },
);

messageSchema.index({ roomSlug: 1, _id: -1 });

messageSchema.index(
  { authorId: 1, clientId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientId: { $type: "string" } },
  },
);

messageSchema.index(
  { reportCount: -1 },
  { partialFilterExpression: { reportCount: { $gt: 0 } } },
);

export default mongoose.models.Message ||
  mongoose.model("Message", messageSchema);
