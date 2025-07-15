const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');

async function main() {
  // Create permission
  const permission = await prisma.permission.upsert({
    where: { name: 'all_permissions' },
    update: {},
    create: {
      name: 'all_permissions',
      description: 'Grants all permissions',
    },
  });

  // Create role and assign permission
  const role = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Administrator role',
      permissionAssignments: {
        create: {
          permission: {
            connect: { id: permission.id },
          },
        },
      },
    },
  });

  // Hash password
  const hashedPassword = await bcrypt.hash('admin', 10);

  // Create user and assign role
  await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      name: 'admin',
      hashedPassword,
      isActive: true,
      roleAssignments: {
        create: {
          role: {
            connect: { id: role.id },
          },
        },
      },
    },
  });

  console.log('Seeding completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
});