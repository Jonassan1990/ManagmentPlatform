import { PrismaClient } from "@prisma/client";
import { retireQOrganizations } from "@/modules/organization/application/retire-q-organizations";

const db = new PrismaClient();

async function main() {
  const count = await retireQOrganizations(db);
  console.log(`[retire-q-organizations] archived ${count} organization(s)`);
}

main()
  .catch((error) => {
    console.error(
      "[retire-q-organizations] failed",
      error instanceof Error ? error.name : "unknown",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
