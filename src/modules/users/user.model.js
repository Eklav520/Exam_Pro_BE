import mongoose from "mongoose";

export const USER_ROLES = ["student", "admin"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
    centrePreferences: {
      type: [
        {
          priority: { type: Number, required: true },
          centreId: { type: mongoose.Schema.Types.ObjectId, ref: "Centre", required: true },
          centreCode: { type: String, required: true },
          centreName: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
