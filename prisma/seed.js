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

const sampleCards = [
  { name: 'Charizard ex', game: 'pokemon', set: 'Phantasmal Flames', rarity: 'ultra', price: 2500, stock: 3 },
  { name: 'Mewtwo ex', game: 'pokemon', set: 'Destined Rivals', rarity: 'rare', price: 800, stock: 5 },
  { name: 'Garchomp ex SIR', game: 'pokemon', set: 'Destined Rivals', rarity: 'secret', price: 5100, stock: 1 },
  { name: 'Blue-Eyes White Dragon', game: 'yugioh', set: 'Structure Deck', rarity: 'rare', price: 1200, stock: 4 },
  { name: 'Dark Magician', game: 'yugioh', set: 'Structure Deck', rarity: 'rare', price: 600, stock: 6 },
  { name: 'MetalGarurumon', game: 'digimon', set: 'BT-15', rarity: 'rare', price: 850, stock: 4 },
  { name: 'Luffy Leader', game: 'onepiece', set: 'OP-10', rarity: 'rare', price: 650, stock: 5 },
  { name: 'Goku Ultra Instinct', game: 'dragonball', set: 'Series 2', rarity: 'ultra', price: 1800, stock: 2 },
  { name: 'Pikachu ex', game: 'pokemon', set: 'Scarlet & Violet', rarity: 'rare', price: 350, stock: 10 },
  { name: 'Venusaur ex', game: 'pokemon', set: 'Paldea Evolved', rarity: 'ultra', price: 1200, stock: 3 },
];

const sampleProducts = [
  { name: 'Charizard ex Ultra Premium Collection', game: 'pokemon', set: 'Phantasmal Flames', type: 'PREMIUM', price: 2990, badge: 'NUEVO', stock: 5 },
  { name: 'Mega Evolution Elite Trainer Box', game: 'pokemon', set: 'Mega Evolution', type: 'ELITE_TRAINER', price: 1590, badge: 'OFERTA', discountPercent: 12, stock: 3 },
  { name: 'Prismatic Evolutions Booster Box', game: 'pokemon', set: 'Scarlet & Violet', type: 'BOOSTER_BOX', price: 5800, badge: 'PREVENTA', stock: 10 },
  { name: 'Marvel Super Heroes Commander Deck', game: 'magic', set: 'Marvel', type: 'DECK', price: 890, badge: 'NUEVO', stock: 8 },
  { name: 'Destined Rivals Booster Bundle', game: 'pokemon', set: 'Scarlet & Violet', type: 'BUNDLE', price: 950, stock: 12 },
  { name: 'Digimon BT-15 Booster Box', game: 'digimon', set: 'BT-15', type: 'BOOSTER_BOX', price: 2200, badge: 'NUEVO', stock: 4 },
  { name: 'Dragon Ball Super Starter Deck', game: 'dragonball', set: 'Series 1', type: 'STARTER', price: 450, stock: 6 },
  { name: 'One Piece OP-10 Booster Box', game: 'onepiece', set: 'Royal Blood', type: 'BOOSTER_BOX', price: 1800, badge: 'PREVENTA', stock: 7 },
];

async function main() {
  console.log('🌱 Starting seed...');

  // Crear juegos
  console.log('Creating games...');
  let gameIds = {};
  for (const game of games) {
    const created = await prisma.game.upsert({
      where: { name: game.name },
      update: {},
      create: game
    });
    gameIds[game.name] = created.id;
  }
  console.log('✅ Games created');

  // Crear cartas de ejemplo
  console.log('Creating sample cards...');
  for (const card of sampleCards) {
    const existing = await prisma.card.findFirst({
      where: { name: card.name }
    });
    if (!existing) {
      await prisma.card.create({
        data: {
          name: card.name,
          gameId: gameIds[card.game],
          set: card.set,
          rarity: card.rarity,
          condition: 'NM',
          price: card.price,
          stock: card.stock,
          active: true
        }
      });
    }
  }
  console.log('✅ Sample cards created');

  // Crear productos de ejemplo
  console.log('Creating sample products...');
  for (const product of sampleProducts) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name }
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          name: product.name,
          gameId: gameIds[product.game],
          set: product.set,
          type: product.type,
          price: product.price,
          badge: product.badge,
          discountPercent: product.discountPercent || 0,
          stock: product.stock,
          active: true
        }
      });
    }
  }
  console.log('✅ Sample products created');

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
