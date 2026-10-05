import { eq, isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import { adAccounts, metaAdAccounts } from "../src/db/schema";
import { extractTargetsFromNotes } from "../src/lib/target-extractor";

async function migrate() {
  console.log(
    "=== Migrating Freeform Notes Targets into Structured Columns ===",
  );

  const googleAccounts = await db
    .select({
      id: adAccounts.id,
      name: adAccounts.name,
      targetCpa: adAccounts.targetCpa,
      targetNotes: adAccounts.targetNotes,
      clientId: adAccounts.clientId,
      clientOnboardingId: adAccounts.clientOnboardingId,
    })
    .from(adAccounts)
    .where(isNotNull(adAccounts.targetNotes));

  console.log(`Found ${googleAccounts.length} accounts with targetNotes.`);

  let migratedCount = 0;

  for (const acc of googleAccounts) {
    const extracted = extractTargetsFromNotes(acc.targetNotes);
    console.log(
      `Account [${acc.id}] "${acc.name}": Notes = "${acc.targetNotes?.slice(0, 60)}..."`,
    );
    console.log(
      `  -> Extracted: Google=${extracted.googleTargetCpa}, Meta=${extracted.metaTargetCpa}, Gen=${extracted.generalTargetCpa}`,
    );

    // If Google targetCpa is currently empty, migrate extracted value
    const targetToSet = extracted.googleTargetCpa || extracted.generalTargetCpa;
    if (targetToSet && (!acc.targetCpa || Number(acc.targetCpa) === 0)) {
      console.log(
        `  Updating ad_accounts [${acc.id}] targetCpa -> ${targetToSet}`,
      );
      await db
        .update(adAccounts)
        .set({ targetCpa: String(targetToSet) })
        .where(eq(adAccounts.id, acc.id));
      migratedCount++;
    }

    // Check for linked Meta account if meta target extracted
    if (extracted.metaTargetCpa && (acc.clientId || acc.clientOnboardingId)) {
      const metaAccs = await db
        .select()
        .from(metaAdAccounts)
        .where(
          acc.clientId
            ? eq(metaAdAccounts.clientId, acc.clientId)
            : eq(metaAdAccounts.clientOnboardingId, acc.clientOnboardingId!),
        );

      for (const m of metaAccs) {
        if (!m.targetCpa || Number(m.targetCpa) === 0) {
          console.log(
            `  Updating linked meta_ad_accounts [${m.id}] targetCpa -> ${extracted.metaTargetCpa}`,
          );
          await db
            .update(metaAdAccounts)
            .set({ targetCpa: String(extracted.metaTargetCpa) })
            .where(eq(metaAdAccounts.id, m.id));
          migratedCount++;
        }
      }
    }
  }

  console.log(
    `Migration finished. Successfully updated ${migratedCount} target field(s).`,
  );
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
