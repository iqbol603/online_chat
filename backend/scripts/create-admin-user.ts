async function createAdmin() {
  const mysql = require('mysql2/promise');
  const bcrypt = require('bcrypt');
  
  const connection = await mysql.createConnection({
    host: '217.11.176.136',
    user: 'mbcc',
    password: 'SA37WY5',
    database: 'online_chat',
  });

  try {
    console.log('Подключение к базе данных...');
    
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);
    
    console.log('Создание администратора...');
    console.log(`Email: admin@example.com`);
    console.log(`Password: ${password}`);
    
    await connection.query(
      `INSERT INTO operators (name, email, password_hash, role, status_presence) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['Администратор', 'admin@example.com', hash, 'admin', 'offline']
    );
    
    console.log('✅ Администратор успешно создан!');
    
    // Проверяем созданного админа
    const [admins] = await connection.query(
      'SELECT operator_id, name, email, role FROM operators WHERE email = ?',
      ['admin@example.com']
    );
    
    console.log('\nСозданный администратор:');
    console.log(admins);
    
  } catch (error) {
    console.error('❌ Ошибка при создании администратора:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createAdmin()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Ошибка:', error);
    process.exit(1);
  });

