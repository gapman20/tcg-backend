const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');

const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/campaigns - Listar todas las campañas
router.get('/', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/campaigns/active - Obtener campaña activa (puede ser usado públicamente)
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    
    const campaign = await prisma.campaign.findFirst({
      where: {
        active: true,
        OR: [
          { endDate: null },
          { endDate: { gt: now } }
        ]
      }
    });
    
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching active campaign:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/campaigns/:id - Obtener campaña por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await prisma.campaign.findUnique({
      where: { id }
    });
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/campaigns - Crear campaña (admin)
router.post('/',
  authMiddleware,
  adminMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('discountPercent').optional().isInt({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        discountPercent,
        startDate,
        endDate,
        active,
        bannerText,
        bannerColor,
        selectedProducts
      } = req.body;

      const campaign = await prisma.campaign.create({
        data: {
          name,
          discountPercent: parseInt(discountPercent) || 0,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          active: active || false,
          bannerText,
          bannerColor: bannerColor || '#ef4444',
          selectedProducts: selectedProducts || []
        }
      });

      res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/campaigns/:id - Actualizar campaña (admin)
router.put('/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        discountPercent,
        startDate,
        endDate,
        active,
        bannerText,
        bannerColor,
        selectedProducts
      } = req.body;

      // Build update data
      const updateData = {};
      
      if (name !== undefined) updateData.name = name;
      if (discountPercent !== undefined) updateData.discountPercent = parseInt(discountPercent);
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      if (active !== undefined) updateData.active = active;
      if (bannerText !== undefined) updateData.bannerText = bannerText;
      if (bannerColor !== undefined) updateData.bannerColor = bannerColor;
      if (selectedProducts !== undefined) updateData.selectedProducts = selectedProducts;

      const campaign = await prisma.campaign.update({
        where: { id },
        data: updateData
      });

      res.json(campaign);
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/campaigns/:id - Eliminar campaña (admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.campaign.delete({ where: { id } });

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;