const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Listar todos los juegos
router.get('/', async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { cards: true, products: true }
        }
      }
    });

    res.json(games);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Obtener un juego por ID o nombre
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findFirst({
      where: {
        OR: [
          { id },
          { name: id.toLowerCase() }
        ]
      },
      include: {
        _count: {
          select: { cards: true, products: true }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
