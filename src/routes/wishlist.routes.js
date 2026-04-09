const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId: req.userId },
      include: { 
        card: { include: { game: true } },
        product: { include: { game: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(wishlist);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { cardId, productId } = req.body;

    if (!cardId && !productId) {
      return res.status(400).json({ error: 'Must provide cardId or productId' });
    }

    if (cardId && productId) {
      return res.status(400).json({ error: 'Cannot provide both cardId and productId' });
    }

    let itemExists = false;
    let itemType = '';

    if (cardId) {
      const card = await prisma.card.findUnique({ where: { id: cardId } });
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      itemExists = true;
      itemType = 'card';
    }

    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      itemExists = true;
      itemType = 'product';
    }

    if (cardId) {
      const existing = await prisma.wishlistItem.findUnique({
        where: { userId_cardId: { userId: req.userId, cardId } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Card already in wishlist' });
      }
    }

    if (productId) {
      const existing = await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId: req.userId, productId } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Product already in wishlist' });
      }
    }

    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: req.userId,
        cardId: cardId || null,
        productId: productId || null
      },
      include: { 
        card: { include: { game: true } },
        product: { include: { game: true } }
      }
    });

    res.status(201).json(wishlistItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:type/:id', authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== 'card' && type !== 'product') {
      return res.status(400).json({ error: 'Invalid type. Use card or product' });
    }

    if (type === 'card') {
      await prisma.wishlistItem.deleteMany({
        where: { userId: req.userId, cardId: id }
      });
    } else {
      await prisma.wishlistItem.deleteMany({
        where: { userId: req.userId, productId: id }
      });
    }

    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
