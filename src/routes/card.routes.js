const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');

const router = express.Router();
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
router.post('/', 
  authMiddleware, 
  adminMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Card name is required'),
    body('gameId').optional().isUUID().withMessage('gameId must be a valid UUID'),
    body('game').optional().trim().notEmpty().withMessage('Game name cannot be empty'),
    body('rarity').optional().isIn(['common', 'uncommon', 'rare', 'holo', 'ultra', 'mythic', 'secret', 'full-art', 'alternate-art', 'promo']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        gameId,
        game,
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

      let finalGameId = gameId;

      if (!finalGameId && game) {
        let gameRecord = await prisma.game.findFirst({
          where: { name: game.toLowerCase() }
        });
        // Create game if not exists
        if (!gameRecord) {
          gameRecord = await prisma.game.create({
            data: {
              name: game.toLowerCase(),
              displayName: game.charAt(0).toUpperCase() + game.slice(1)
            }
          });
        }
        if (gameRecord) {
          finalGameId = gameRecord.id;
        }
      }

      if (!finalGameId) {
        return res.status(400).json({ error: 'gameId or game is required' });
      }

      const card = await prisma.card.create({
        data: {
          name,
          gameId: finalGameId,
          set,
          setCode,
          rarity,
          condition: condition || 'NM',
          price: parseFloat(price) || 0,
          priceFoil: priceFoil ? parseFloat(priceFoil) : undefined,
          stock: parseInt(stock) || 0,
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
  }
);

// Actualizar carta (admin)
router.put('/:id', 
  authMiddleware, 
  adminMiddleware,
  [
    body('name').optional().trim().notEmpty().withMessage('Card name cannot be empty'),
    body('gameId').optional().isUUID().withMessage('gameId must be a valid UUID'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    // Allow any string for imageUrl (including blob URLs)
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { game, gameId, ...rest } = req.body;

      let updateData = { ...rest };
      
      // Remove invalid fields that might come from frontend
      delete updateData.game;
      delete updateData.gameId;
      delete updateData.gameDisplayName;
      delete updateData.createdAt;

      if (game && !gameId) {
        const gameRecord = await prisma.game.findFirst({
          where: { name: game.toLowerCase() }
        });
        if (gameRecord) {
          updateData.gameId = gameRecord.id;
        }
      } else if (gameId) {
        updateData.gameId = gameId;
      }

      // Convert numeric fields
      if (updateData.price !== undefined) updateData.price = parseFloat(updateData.price);
      if (updateData.stock !== undefined) updateData.stock = parseInt(updateData.stock);

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
  }
);

// Eliminar carta (admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Use deleteMany instead of delete to avoid error if not found
    const result = await prisma.card.deleteMany({ where: { id } });
    
    if (result.count === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
