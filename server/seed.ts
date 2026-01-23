import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

const ADMIN_USERNAME = "519tech";
const ADMIN_PASSWORD = "gmv92emN9dUPzV8R2Jxe!hNZ";

export async function seedAdminUser(): Promise<void> {
  try {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, ADMIN_USERNAME));

    if (existingUser) {
      console.log(`Admin user '${ADMIN_USERNAME}' already exists`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.insert(users).values({
      username: ADMIN_USERNAME,
      passwordHash,
    });

    console.log(`Admin user '${ADMIN_USERNAME}' created successfully`);
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}
