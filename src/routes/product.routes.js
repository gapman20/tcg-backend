const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Listar productos sellados
router.get('/', async (req, res) => {
  try {
    const {
      game,
      type,
      badge,
      inStock,
      page = 1,
      limit = 20,
      sort = 'name',
      order = 'asc'
    } = req.query;

    const where = { active: true };

    if (game && game !== 'all') {
      const gameRecord = await prisma.game.findFirst({
        where: { name: game.toLowerCase() }
      });
      if (gameRecord) {
        where.gameId = gameRecord.id;
      }
    }

    if (type) {
      where.type = type;
    }

    if (badge) {
      where.badge = badge;
    }

    if (inStock === 'true') {
      where.stock = { gt: 0 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { game: { select: { name: true, displayName: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { [sort]: order }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Obtener producto por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { game: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Crear producto (admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      name,
      game,
      gameId: gameIdInput,
      set,
      type,
      price,
      discountPercent,
      badge,
      stock,
      imageUrl,
      description
    } = req.body;

    let finalGameId = gameIdInput;
    
    if (!finalGameId && game) {
      const gameRecord = await prisma.game.findFirst({
        where: { name: game.toLowerCase() }
      });
      if (gameRecord) {
        finalGameId = gameRecord.id;
      }
    }

    if (!finalGameId) {
      return res.status(400).json({ error: 'Se requiere gameId o game válido' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        gameId: finalGameId,
        set,
        type,
        price,
        discountPercent: discountPercent || 0,
        badge,
        stock: stock || 0,
        imageUrl,
        description
      },
      include: { game: true }
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Actualizar producto (admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { game, gameId: gameIdInput, ...updateData } = req.body;

    let finalGameId = gameIdInput;
    
    if (!finalGameId && game) {
      const gameRecord = await prisma.game.findFirst({
        where: { name: game.toLowerCase() }
      });
      if (gameRecord) {
        finalGameId = gameRecord.id;
      }
    }

    if (finalGameId) {
      updateData.gameId = finalGameId;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { game: true }
    });

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Eliminar producto (admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({ where: { id } });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
