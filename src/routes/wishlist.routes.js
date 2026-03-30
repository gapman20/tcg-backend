const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const { authMiddleware } = require('../middleware/auth');

// Obtener wishlist del usuario
router.get('/', authMiddleware, async (req, res) => {
  try {
    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId: req.userId },
      include: { card: { include: { game: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json(wishlist);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Agregar carta a wishlist
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { cardId } = req.body;

    // Verificar que la carta existe
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Verificar si ya está en wishlist
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        userId_cardId: {
          userId: req.userId,
          cardId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Card already in wishlist' });
    }

    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: req.userId,
        cardId
      },
      include: { card: { include: { game: true } } }
    });

    res.status(201).json(wishlistItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Eliminar carta de wishlist
router.delete('/:cardId', authMiddleware, async (req, res) => {
  try {
    const { cardId } = req.params;

    await prisma.wishlistItem.deleteMany({
      where: {
        userId: req.userId,
        cardId
      }
    });

    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
