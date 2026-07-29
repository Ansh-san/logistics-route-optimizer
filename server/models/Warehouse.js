import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  {
    // Prevent Mongoose from renaming _id or adding __v noise to API responses
    toJSON: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Warehouse = mongoose.model("Warehouse", warehouseSchema);
export default Warehouse;
