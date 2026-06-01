import { config } from "dotenv";
config({ path: "../../.env" });

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "./client";
import { voices } from "./schema/voices";

async function main() {
  const db = getDb();

  console.log("Seeding database with initial data...");

  // idempotent seed: replace public premade voices so reruns stay clean
  await db
    .delete(voices)
    .where(and(eq(voices.category, "premade"), isNull(voices.userId)));

  await db.insert(voices).values([
    {
      name: "Heart",
      description: "A warm, expressive American female voice",
      category: "premade",
      language: "en",
      gender: "female",
      accent: "american",
      isPublic: true,
      metadata: { engine: "kokoro", kokoroVoice: "af_heart" },
    },
    {
      name: "Bella",
      description: "A smooth, friendly American female voice",
      category: "premade",
      language: "en",
      gender: "female",
      accent: "american",
      isPublic: true,
      metadata: { engine: "kokoro", kokoroVoice: "af_bella" },
    },
    {
      name: "Adam",
      description: "A deep, confident American male voice",
      category: "premade",
      language: "en",
      gender: "male",
      accent: "american",
      isPublic: true,
      metadata: { engine: "kokoro", kokoroVoice: "am_adam" },
    },
    {
      name: "Alice",
      description: "A refined, elegant British female voice",
      category: "premade",
      language: "en",
      gender: "female",
      accent: "british",
      isPublic: true,
      metadata: { engine: "kokoro", kokoroVoice: "bf_alice" },
    },
    {
      name: "George",
      description: "A classic, distinguished British male voice",
      category: "premade",
      language: "en",
      gender: "male",
      accent: "british",
      isPublic: true,
      metadata: { engine: "kokoro", kokoroVoice: "bm_george" },
    },
  ]);

  console.log("Database seeding completed successfully.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Database seeding failed:", error);
  process.exit(1);
});
