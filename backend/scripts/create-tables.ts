async function createTables() {
  const mysql = require('mysql2/promise');
  const fs = require('fs');
  const path = require('path');
  
  const connection = await mysql.createConnection({
    host: '217.11.176.136',
    user: 'mbcc',
    password: 'SA37WY5',
    database: 'online_chat',
    multipleStatements: true,
  });

  try {
    console.log('Подключение к базе данных...');
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, '../../database/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Удаляем строки с INSERT для админа (создадим его отдельно)
    const sqlWithoutAdmin = sql.replace(
      /-- Создание админа по умолчанию[\s\S]*?ON DUPLICATE KEY UPDATE `name`=`name`;/,
      '-- Администратор будет создан отдельно'
    );
    
    console.log('Создание таблиц...');
    
    // Выполняем SQL
    await connection.query(sqlWithoutAdmin);
    
    console.log('✅ Таблицы успешно созданы!');
    
    // Проверяем созданные таблицы
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\nСозданные таблицы:');
    (tables as any[]).forEach((table: any) => {
      console.log(`  - ${Object.values(table)[0]}`);
    });
    
    // Проверяем очереди
    const [queues] = await connection.query('SELECT * FROM queues');
    console.log('\nСозданные очереди:');
    (queues as any[]).forEach((queue: any) => {
      console.log(`  - ${queue.name} (${queue.department})`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при создании таблиц:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createTables()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Ошибка:', error);
    process.exit(1);
  });

