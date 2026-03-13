import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
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
                "https://www.googleapis.com/auth/adwords"
            ],
            accessType: "offline",
            prompt: "consent",
        },
    },
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
            await resend.emails.send({
                from: "Agency Alerts <alerts@uprisedigital.com.au>",
                to: user.email,
                subject: "Reset your password",
                html: `<p>Hi ${user.name},</p><p>Click the link to reset: <a href="${url}">${url}</a></p>`,
            });
        },
    },
});