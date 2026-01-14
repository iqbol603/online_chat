import * as bcrypt from 'bcrypt';

// Скрипт для генерации хеша пароля
// Использование: npx ts-node scripts/create-admin.ts

const password = process.argv[2] || 'admin123';

async function generateHash() {
  const hash = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  console.log('\nSQL для вставки:');
  console.log(`INSERT INTO operators (name, email, password_hash, role, status_presence) VALUES`);
  console.log(`('Администратор', 'admin@example.com', '${hash}', 'admin', 'offline');`);
}

generateHash();

