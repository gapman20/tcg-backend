const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Listar cartas con filtros
router.get('/', async (req, res) => {
  try {
    const {
      game,
      search,
      rarity,
      condition,
      minPrice,
      maxPrice,
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

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (rarity) {
      where.rarity = rarity;
    }

    if (condition) {
      where.condition = condition;
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    if (inStock === 'true') {
      where.stock = { gt: 0 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        include: { game: { select: { name: true, displayName: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { [sort]: order }
      }),
      prisma.card.count({ where })
    ]);

    res.json({
      cards,
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

// Obtener carta por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const card = await prisma.card.findUnique({
      where: { id },
      include: { game: true }
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json(card);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Crear carta (admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      name,
      gameId,
      set,
      setCode,
      rarity,
      condition,
      price,
      priceFoil,
      stock,
      imageUrl,
      description,
      scryfallId
    } = req.body;

    const card = await prisma.card.create({
      data: {
        name,
        gameId,
        set,
        setCode,
        rarity,
        condition: condition || 'NM',
        price,
        priceFoil,
        stock: stock || 0,
        imageUrl,
        description,
        scryfallId
      },
      include: { game: true }
    });

    res.status(201).json(card);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Actualizar carta (admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const card = await prisma.card.update({
      where: { id },
      data: updateData,
      include: { game: true }
    });

    res.json(card);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Eliminar carta (admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.card.delete({ where: { id } });

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
