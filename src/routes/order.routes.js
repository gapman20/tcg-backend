const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { emitEvent } = require('../config/sse');

const router = express.Router();
const { authMiddleware, adminMiddleware, optionalAuth } = require('../middleware/auth');

// Crear pedido
router.post('/', optionalAuth, [
  body('items').isArray({ min: 1 }),
  body('customerName').trim().isLength({ min: 2 }),
  body('customerEmail').isEmail(),
  body('customerPhone').trim().isLength({ min: 10 }),
  body('address').trim().isLength({ min: 5 })
], async (req, res) => {
  const t = await prisma.$transaction(async (tx) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw { status: 400, message: errors.array() };
      }

      const {
        items,
        customerName,
        customerEmail,
        customerPhone,
        address,
        city,
        state,
        zipCode,
        paymentMethod = 'paypal',
        paymentId
      } = req.body;

      // Calcular totales
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        if (item.cardId) {
          const card = await tx.card.findUnique({ where: { id: item.cardId } });
          if (!card) throw { status: 404, message: `Card ${item.cardId} not found` };
          if (card.stock < item.quantity) {
            throw { status: 400, message: `Insufficient stock for ${card.name}` };
          }
          orderItems.push({
            cardId: card.id,
            name: card.name,
            price: card.price,
            quantity: item.quantity,
            imageUrl: card.imageUrl
          });
          subtotal += parseFloat(card.price) * item.quantity;

          // Actualizar stock
          await tx.card.update({
            where: { id: card.id },
            data: { stock: card.stock - item.quantity }
          });
        } else if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw { status: 404, message: `Product ${item.productId} not found` };
          if (product.stock < item.quantity) {
            throw { status: 400, message: `Insufficient stock for ${product.name}` };
          }
          orderItems.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: item.quantity,
            imageUrl: product.imageUrl
          });
          subtotal += parseFloat(product.price) * item.quantity;

          await tx.product.update({
            where: { id: product.id },
            data: { stock: product.stock - item.quantity }
          });
        }
      }

      // Calcular envío (ejemplo: gratis si > 500)
      const shipping = subtotal >= 500 ? 0 : 100;
      const total = subtotal + shipping;

      // Crear pedido
      const orderNumber = `ORD-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: req.userId || null,
          customerName,
          customerEmail,
          customerPhone,
          address,
          city,
          state,
          zipCode,
          subtotal,
          shipping,
          total,
          paymentMethod,
          paymentId,
          items: {
            create: orderItems
          }
        },
        include: {
          items: true,
          user: { select: { id: true, email: true, name: true } }
        }
      });

      return order;
    } catch (error) {
      throw error;
    }
  });

  try {
    res.status(201).json(t);
    
    // Emit real-time event for admin notification
    emitEvent('new_order', {
      orderNumber: t.orderNumber,
      customerName: t.customerName,
      total: t.total,
      paymentMethod: t.paymentMethod,
      orderId: t.id,
    });
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Obtener pedidos del usuario
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Obtener estadísticas para admin (pending orders, unread messages)
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [pendingOrders, unreadMessages] = await Promise.all([
      // Count orders that are not DELIVERED or CANCELLED (still active)
      prisma.order.count({
        where: {
          status: {
            notIn: ['DELIVERED', 'CANCELLED']
          }
        }
      }),
      prisma.contactMessage.count({
        where: { read: false }
      })
    ]);

    res.json({ pendingOrders, unreadMessages });
  } catch (error) {
    console.error('Error loading admin stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Obtener pedido por ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: { select: { id: true, email: true, name: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verificar acceso
    if (order.userId && req.userId !== order.userId && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Listar todos los pedidos (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = status ? { status } : {};

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          user: { select: { id: true, email: true, name: true } }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
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

// Actualizar estado del pedido (admin)
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber } = req.body;

    const updateData = { status };
    
    // Si el estado es SHIPPED, guardar el número de seguimiento
    if (status === 'SHIPPED' && trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: { items: true }
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Confirmar pago manual (admin) - transferencia, OXXO, MercadoPago
router.put('/:id/confirm-payment', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentProof } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: { 
        status: 'PROCESSING',
        paymentId: paymentProof || `CONFIRMED-${Date.now()}`
      },
      include: { items: true }
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
