const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();
const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Registro de usuario
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, phone } = req.body;

    // Verificar si el usuario existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Encriptar password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    // Generar token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verificar password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generar token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login de admin
router.post('/admin/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Primero verificar si hay un usuario admin en la base de datos
    const adminUser = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        role: 'ADMIN'
      }
    });

    let isValidAdmin = false;
    let adminName = 'Administrator';

    if (adminUser) {
      // Verificar contraseña del usuario admin en DB
      isValidAdmin = await bcrypt.compare(password, adminUser.password);
      adminName = adminUser.name;
    } else if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      // Fallback a variables de entorno
      isValidAdmin = email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD;
    }

    if (!isValidAdmin) {
      return res.status(401).json({ error: 'Credenciales de administrador inválidas' });
    }

    // Generar token de admin
    const token = jwt.sign(
      { id: adminUser?.id || 'admin', role: 'ADMIN' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ 
      token,
      user: {
        id: adminUser?.id || 'admin',
        email: adminUser?.email || email,
        name: adminName,
        role: 'ADMIN'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Verificar token
router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ valid: false });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({ valid: false });
    }

    res.json({ valid: true, user });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

// Google OAuth - Login or Register
router.post('/google', async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({ error: 'Google token is required' });
    }

    // Verify the Google token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError.message);
      // Alternative: decode the JWT directly
      const parts = googleToken.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('Decoded token payload:', decoded);
        payload = decoded;
      } else {
        return res.status(401).json({ error: 'Invalid Google token', details: verifyError.message });
      }
    }

    if (!payload) {
      return res.status(401).json({ error: 'Could not extract token payload' });
    }

    const { email, name, picture } = payload;

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10),
          image: picture
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          image: true,
          createdAt: true
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ user, token });
  } catch (error) {
    console.error('Google OAuth error:', error.message);
    res.status(401).json({ error: 'Invalid Google token', details: error.message });
  }
});

// Recuperar contraseña - Solicitar código
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // No revelar si el usuario existe o no
    if (!user) {
      return res.json({ message: 'Si el email existe, recibirás un código de recuperación' });
    }

    // Generar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Guardar código de recuperación (vigencia 15 minutos)
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        resetPasswordToken: resetCode,
        resetPasswordExpires: expires
      }
    });

    // En producción: enviar email con el código
    // await sendEmail(email, 'Código de recuperación', `Tu código es: ${resetCode}`);
    
    console.log(`🔐 Código de recuperación para ${email}: ${resetCode}`);

    res.json({ message: 'Si el email existe, recibirás un código de recuperación' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Confirmar código y cambiar contraseña
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, código y nueva contraseña son requeridos' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    // Verificar código y fecha de expiración
    if (user.resetPasswordToken !== code) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
    }

    // Actualizar contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
