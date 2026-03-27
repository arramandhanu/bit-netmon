import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdmin() {
  const existingPasswordHash = await bcrypt.hash('admin123', 12);
  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { 
      passwordHash: existingPasswordHash,
      isActive: true,
      role: 'admin'
    },
    create: {
      username: 'admin',
      email: 'admin@netmon.local',
      passwordHash: existingPasswordHash,
      displayName: 'Administrator',
      role: 'admin',
      isActive: true,
    }
  });
  console.log('Admin password reset to: admin123', user.username);
}

resetAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
