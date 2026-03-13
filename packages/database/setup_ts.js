const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Running TimescaleDB setup...');
    await prisma.$executeRawUnsafe(`SELECT create_hypertable('journey_logs', 'timestamp', migrate_data => true, if_not_exists => true)`);
    console.log('✅ TimescaleDB Hypertable initialized successfully on "journey_logs".');
  } catch (e) {
    console.error('⚠️ TimescaleDB Error. It might already be a hypertable or the extension is missing from Postgres.', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
