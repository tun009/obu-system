const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

// Tạo Prisma Client và giới hạn Singleton để không tràn kết nối khi load lại code
const prisma = globalForPrisma.prisma || new PrismaClient({
    log: ['warn', 'error']
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = { prisma };
