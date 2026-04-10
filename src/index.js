require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const prisma = require('./config/prisma');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const gameRoutes = require('./routes/game.routes');
const cardRoutes = require('./routes/card.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const cartRoutes = require('./routes/cart.routes');
const contactRoutes = require('./routes/contact.routes');
const stripeRoutes = require('./routes/stripe.routes');

const app = express();
app.set('trust proxy', 1);

// Security: Helmet adds important HTTP security headers
// Includes: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.
app.use(helmet());

// Security: Limit request body size to prevent payload attacks
app.use(express.json({ limit: '50kb' }));

// CORS Configuration
// CURRENT: Allows any .vercel.app domain for development flexibility
// TODO (STRICT MODE): For production, restrict to specific domains only:
// const allowedOrigins = [
//   'http://localhost:5173',
//   'https://your-production-domain.vercel.app'
// ];
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
      'https://tcg-frontend-one.vercel.app',
      'https://tcg-frontend-kyv70lave-gabriel-alvarez-s-projects.vercel.app',
      'https://tcg-frontend-kpsj56kft-gabriel-alvarez-s-projects.vercel.app'
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Allow any .vercel.app domain for flexibility
    // SECURITY NOTE: For stricter security, comment out the line below
    // and only allow specific domains in allowedOrigins array above
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.warn('CORS rejected origin:', origin);
      // For strict mode, uncomment the line below:
      // callback(new Error('Not allowed by CORS'));
      callback(null, true); // Currently allowing for flexibility
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// Aplicar rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // 500 requests por window
  message: { error: 'Demasiadas solicitudes. Por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos de login por window
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 intentos de pago por minuto
  message: { error: 'Demasiadas solicitudes de pago. Por favor espera.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/stripe/', paymentLimiter);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/stripe', stripeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(500).json({
    error: 'Something went wrong!',
    message: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 TCG Backend running on port ${PORT}`);
  console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
