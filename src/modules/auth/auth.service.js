import { AppError } from "../../utils/app-error.js";
import { User } from "../users/user.model.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signToken } from "./token.js";

// Checked when the email is unknown, so response time does not reveal accounts.
const dummyHash = hashPassword("unused");

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash");
  const matches = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));

  if (!user || !matches) {
    throw new AppError(401, "Incorrect email or password.");
  }

  return { token: signToken(user._id) };
}
