const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

function formatCartItem(item) {
  return {
    id: item.id,
    userId: item.userId,
    cardId: item.cardId,
    productId: item.productId,
    itemType: item.cardId ? 'CARD' : 'PRODUCT',
    quantity: item.quantity,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    item: item.cardId ? item.card : item.product
  };
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: {
        card: { include: { game: true } },
        product: { include: { game: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(cartItems.map(formatCartItem));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { cardId, productId, quantity = 1 } = req.body;

    if (!cardId && !productId) {
      return res.status(400).json({ error: 'Must provide cardId or productId' });
    }

    if (cardId) {
      const card = await prisma.card.findUnique({ where: { id: cardId } });
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
    } else {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
    }

    const whereClause = cardId
      ? { userId_cardId: { userId: req.userId, cardId } }
      : { userId_productId: { userId: req.userId, productId } };

    const existingItem = await prisma.cartItem.findUnique({
      where: whereClause
    });

    if (existingItem) {
      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
        include: {
          card: { include: { game: true } },
          product: { include: { game: true } }
        }
      });
      return res.json(formatCartItem(updatedItem));
    }

    const cartItem = await prisma.cartItem.create({
      data: {
        userId: req.userId,
        cardId: cardId || null,
        productId: productId || null,
        quantity
      },
      include: {
        card: { include: { game: true } },
        product: { include: { game: true } }
      }
    });

    res.status(201).json(formatCartItem(cartItem));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id, userId: req.userId }
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (quantity === 0) {
      await prisma.cartItem.delete({ where: { id } });
      return res.json({ message: 'Item removed from cart' });
    }

    try {
      const updatedItem = await prisma.cartItem.update({
        where: { id },
        data: { quantity },
        include: {
          card: { include: { game: true } },
          product: { include: { game: true } }
        }
      });
      res.json(formatCartItem(updatedItem));
    } catch (e) {
      console.error('Error updating cart item:', e);
      return res.status(404).json({ error: 'Cart item not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const cartItem = await prisma.cartItem.findFirst({
      where: { id, userId: req.userId }
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await prisma.cartItem.delete({ where: { id } });

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/', authMiddleware, async (req, res) => {
  try {
    await prisma.cartItem.deleteMany({
      where: { userId: req.userId }
    });

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/merge', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array required' });
    }

    for (const item of items) {
      const { cardId, productId, quantity = 1 } = item;

      if (!cardId && !productId) continue;

      const whereClause = cardId
        ? { userId_cardId: { userId: req.userId, cardId } }
        : { userId_productId: { userId: req.userId, productId } };

      const existingItem = await prisma.cartItem.findUnique({
        where: whereClause
      });

      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + quantity }
        });
      } else {
        await prisma.cartItem.create({
          data: {
            userId: req.userId,
            cardId: cardId || null,
            productId: productId || null,
            quantity
          }
        });
      }
    }

    const finalCart = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: {
        card: { include: { game: true } },
        product: { include: { game: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(finalCart.map(formatCartItem));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
