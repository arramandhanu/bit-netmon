#!/bin/bash
# Reset admin password script

cd /opt/netmon

# Install dotenv if needed
npm install dotenv --save-dev 2>/dev/null

# Create reset script
cat > /tmp/reset-admin.js << 'SCRIPT'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAdmin() {
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  
  console.log('Resetting admin password to:', password);
  
  const hash = await bcrypt.hash(password, 12);
  
  const result = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { 
      passwordHash: hash, 
      isActive: true 
    },
    create: { 
      username: 'admin', 
      email: 'admin@netmon.local', 
      passwordHash: hash, 
      displayName: 'Administrator', 
      role: 'admin', 
      isActive: true 
    }
  });
  
  console.log('✓ Admin user reset successfully');
  console.log('  Username: admin');
  console.log('  Password:', password);
  
  await prisma.$disconnect();
}

resetAdmin().catch(console.error);
SCRIPT

# Run the reset
node /tmp/reset-admin.js

# Restart API
sudo systemctl restart netmon-api

echo ""
echo "Done! Try logging in with:"
echo "  Username: admin"
echo "  Password: admin123"
