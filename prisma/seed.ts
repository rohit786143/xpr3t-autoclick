import prisma from "../lib/db";
import { hashPassword, encryptTargetPassword } from "../lib/crypto";

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
  const hashedAdminPassword = await hashPassword(adminPassword);

  const admin = await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { password: hashedAdminPassword },
    create: {
      username: adminUsername,
      password: hashedAdminPassword,
    },
  });

  console.log(`[Seed] Admin account ready: ${admin.username}`);

  // Remove old demo_worker_01 if present
  await prisma.user.deleteMany({
    where: { username: "demo_worker_01" },
  });

  // Ensure sample XPR3T user XP71457513 from screenshot is configured
  const existingXpr3t = await prisma.user.findFirst({
    where: { username: "XP71457513" },
  });

  if (!existingXpr3t) {
    const samplePass = "Sagar@301089";
    await prisma.user.create({
      data: {
        username: "XP71457513",
        password: await hashPassword(samplePass),
        encryptedPassword: encryptTargetPassword(samplePass),
        targetWebsiteUrl: "https://xpr3t.com/Sign-in.html",
        buttonSelector: "",
        usernameSelector: "#inputEmail",
        passwordSelector: "#inputPassword",
        submitSelector: "#submit-login",
        status: "active",
      },
    });
    console.log(`[Seed] Added XPR3T user: XP71457513`);
  }
}

main()
  .catch((e) => {
    console.error("[Seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
