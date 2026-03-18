export async function processReport(payload: any, env: any) {
    // Determine your production URL (e.g., uprise-tools.dsmhgroup.com or your designated Vercel domain)
    const VERCEL_API_URL = `${env.NEXT_PUBLIC_APP_URL}/api/internal/generate-report`;

    console.log(`[CF Queue] Offloading report generation for schedule: ${payload.scheduleId}`);

    try {
        const response = await fetch(VERCEL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // A secret key shared between Cloudflare and Vercel to prevent unauthorized runs
                'Authorization': `Bearer ${env.WORKER_SECRET_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vercel rejected the request: ${response.status} - ${errorText}`);
        }

        console.log(`[CF Queue] Successfully processed ${payload.scheduleId}`);

    } catch (error: any) {
        console.error("[CF Queue] Worker Error:", error.message);
        // Throwing an error here tells Cloudflare Queues to put the message back
        // in the queue and retry it according to the max_retries policy.
        throw error;
    }
}