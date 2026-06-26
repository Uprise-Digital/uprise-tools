import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth"; // Adjust path to your auth.ts file

// This catches all /api/auth/* requests and passes them to Better Auth
export const { GET, POST } = toNextJsHandler(auth);
