import { createSchema } from './schema';

async function main() {
  try {
    await createSchema();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();

