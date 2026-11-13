import prisma from "../lib/db";
import { hashPassword, encryptTargetPassword } from "../lib/crypto";

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@himachalpradeshlive.com").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
  const hashedAdminPassword = await hashPassword(adminPassword);

  // Upsert Admin account
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      portalPassword: hashedAdminPassword,
      role: "admin",
    },
    create: {
      email: adminEmail,
      portalPassword: hashedAdminPassword,
      role: "admin",
      xpr3tUsername: "XP71457513",
      xpr3tPassword: await hashPassword("Sagar@301089"),
      encryptedPassword: encryptTargetPassword("Sagar@301089"),
      status: "active",
    },
  });

  console.log(`[Seed] Admin ready: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error("[Seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
