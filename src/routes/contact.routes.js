const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { body, validationResult } = require('express-validator');
const { adminMiddleware } = require('../middleware/auth');

// Validación
const contactValidation = [
  body('name').notEmpty().withMessage('El nombre es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('message').notEmpty().withMessage('El mensaje es requerido'),
];

// Crear mensaje de contacto (público - no requiere auth)
router.post('/', contactValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, subject, message } = req.body;

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject: subject || null,
        message,
      },
    });

    res.status(201).json(contactMessage);
  } catch (error) {
    console.error('Error creating contact message:', error);
    res.status(500).json({ error: 'Error al guardar el mensaje' });
  }
});

// Obtener todos los mensajes (solo admin)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
});

// Marcar mensaje como leído (solo admin)
router.put('/:id/read', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const message = await prisma.contactMessage.update({
      where: { id },
      data: { read: true },
    });
    res.json(message);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Error al actualizar el mensaje' });
  }
});

// Eliminar mensaje (solo admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.contactMessage.delete({
      where: { id },
    });
    res.json({ message: 'Mensaje eliminado' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Error al eliminar el mensaje' });
  }
});

module.exports = router;
