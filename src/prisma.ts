import env from "@/env";
import { PrismaClient } from "@prisma/client"; // Import PrismaClient
import { PrismaPg } from "@prisma/adapter-pg";


const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });