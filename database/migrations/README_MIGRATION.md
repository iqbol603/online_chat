# Как выполнить SQL миграцию для чёрного списка

## Способ 1: Через командную строку (самый простой)

### Вариант A: Прямо из файла

```bash
# На сервере, в папке проекта:
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat < database/migrations/add_blocked_clients_table.sql
```

### Вариант B: Через MySQL консоль

```bash
# 1. Подключитесь к MySQL:
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat

# 2. В MySQL консоли выполните:
SOURCE /полный/путь/к/проекту/database/migrations/add_blocked_clients_table.sql;

# Или скопируйте и вставьте содержимое файла напрямую:
CREATE TABLE IF NOT EXISTS `blocked_clients` (
  `blocked_id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(13) NOT NULL COMMENT 'Формат: +992987654321',
  `name` VARCHAR(255) NULL COMMENT 'Имя клиента на момент блокировки',
  `reason` TEXT NULL COMMENT 'Причина блокировки',
  `blocked_by_operator_id` INT NULL COMMENT 'Кто заблокировал',
  `blocked_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `unblocked_at` TIMESTAMP NULL,
  `is_active` BOOLEAN DEFAULT TRUE COMMENT 'Активна ли блокировка',
  INDEX `idx_phone` (`phone`),
  INDEX `idx_is_active` (`is_active`),
  INDEX `idx_blocked_by` (`blocked_by_operator_id`),
  FOREIGN KEY (`blocked_by_operator_id`) REFERENCES `operators`(`operator_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

# 3. Выйдите из MySQL:
EXIT;
```

## Способ 2: Через phpMyAdmin или другой GUI

1. Откройте phpMyAdmin (или другой инструмент для работы с MySQL)
2. Выберите базу данных `online_chat`
3. Перейдите на вкладку "SQL"
4. Скопируйте содержимое файла `database/migrations/add_blocked_clients_table.sql`
5. Вставьте в поле SQL запроса
6. Нажмите "Выполнить"

## Проверка

После выполнения миграции проверьте, что таблица создана:

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat -e "SHOW TABLES LIKE 'blocked_clients';"
```

Должна появиться строка: `blocked_clients`

Или проверьте структуру таблицы:

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat -e "DESCRIBE blocked_clients;"
```

## Если таблица уже существует

Если таблица уже существует, миграция не создаст дубликат (благодаря `CREATE TABLE IF NOT EXISTS`), но можно проверить:

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat -e "SELECT COUNT(*) FROM blocked_clients;"
```
