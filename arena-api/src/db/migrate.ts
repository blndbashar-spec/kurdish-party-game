import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { client, db } from '../config/db';

// جێبەجێکردنی هەموو مایگرەیشنەکانی /drizzle
async function main() {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ مایگرەیشنەکان جێبەجێکران');
}

main()
  .catch((e) => {
    console.error('❌ مایگرەیشن هەڵەیەکی ڕوویدا:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    client.end().catch(() => {});
  });
