const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const games = [
  { name: 'pokemon', displayName: 'Pokémon TCG' },
  { name: 'yugioh', displayName: 'Yu-Gi-Oh!' },
  { name: 'magic', displayName: 'Magic: The Gathering' },
  { name: 'digimon', displayName: 'Digimon Card Game' },
  { name: 'onepiece', displayName: 'One Piece Card Game' },
  { name: 'dragonball', displayName: 'Dragon Ball Super' },
  { name: 'lorcana', displayName: 'Lorcana' }
];

async function main() {
  console.log('🌱 Starting seed...');

  // Crear juegos
  console.log('Creating games...');
  for (const game of games) {
    await prisma.game.upsert({
      where: { name: game.name },
      update: {},
      create: game
    });
  }
  console.log('✅ Games created');

  // Crear admin si no existe
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tcg.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Administrator',
        role: 'ADMIN'
      }
    });
    console.log('✅ Admin user created');
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
