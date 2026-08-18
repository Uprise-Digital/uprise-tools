import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "../db";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [organization(), admin()],
  // ENABLE ACCOUNT MERGING HERE
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // We trust these providers to have verified the user's email address.
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/adwords",
      ],
      accessType: "offline",
      prompt: "consent",
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const { sendSystemEmail } = await import("@/lib/email-service");
      await sendSystemEmail({
        templateKey: "team_invite",
        to: user.email,
        customSubject: "Reset your password",
        customHtml: `<p>Hi ${user.name},</p><p>Click the link to reset your password: <a href="${url}">${url}</a></p>`,
      });
    },
  },
});
