import { Client } from '@neondatabase/serverless';
import { Resend } from 'resend';
import OpenAI from 'openai';
// Note: You will need to move your React PDF components/logic to be compatible
// with the worker or use a specialized PDF generation API if React-PDF
// struggles with the V8 runtime constraints.

export async function processReport(payload: any, env: any) {
    const { scheduleId, googleAccountId, clientName, userId } = payload;
    const ACTOR = userId || "SYSTEM_AUTOMATION";

    const client = new Client(env.DATABASE_URL);
    await client.connect();

    const resend = new Resend(env.RESEND_API_KEY);

    try {
        // 1. Fetch Schedule (using raw SQL or Drizzle if configured)
        const { rows } = await client.query('SELECT * FROM report_schedules WHERE id = $1', [scheduleId]);
        const schedule = rows[0];
        if (!schedule) throw new Error("Schedule not found");

        // 2. Fetch Google Ads Data
        // You will move your fetchAccountMonthlySummary etc. here
        // using the Cloudflare 'fetch' API.

        // 3. AI Insights (using OpenAI SDK)
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: `Generate report for ${clientName}...` }],
            model: "gpt-4",
        });

        // 4. Send Email
        await resend.emails.send({
            from: 'Uprise Digital <reports@uprisedigital.com.au>',
            to: schedule.recipient_email,
            subject: `Performance Report: ${clientName}`,
            text: completion.choices[0].message.content || "",
            // Attachments: handled via Uint8Array in Cloudflare
        });

        // 5. Update lastRunAt
        await client.query('UPDATE report_schedules SET last_run_at = NOW() WHERE id = $1', [scheduleId]);

    } catch (error: any) {
        console.error("Worker Error:", error.message);
        throw error; // Trigger Cloudflare Queue retry
    } finally {
        await client.end();
    }
}