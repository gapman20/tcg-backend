const { PrismaClient } = require('@prisma/client');

// Singleton pattern to prevent multiple database connections
// IMPORTANT: Only one PrismaClient instance should exist in the application

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use global to prevent hot-reload from creating new instances
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
