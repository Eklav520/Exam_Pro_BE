import mongoose from "mongoose";

const centreSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    mandal: {
      type: String,
      default: "",
      trim: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    totalSystems: {
      type: Number,
      default: 0,
      min: 0,
    },
    bufferSystems: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowedSubnets: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const Centre = mongoose.model("Centre", centreSchema);
