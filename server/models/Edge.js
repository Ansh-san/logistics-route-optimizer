import mongoose from "mongoose";

const edgeSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    distance: { type: Number, required: true },
  },
  {
    toJSON: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Edge = mongoose.model("Edge", edgeSchema);
export default Edge;
