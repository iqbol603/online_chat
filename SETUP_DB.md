# Настройка базы данных

## Данные для подключения

- **Хост**: 217.11.176.136
- **Порт**: 3306 (по умолчанию)
- **Логин**: mbcc
- **Пароль**: SA37WY5
- **База данных**: online_chat (нужно создать)

## Шаг 1: Создание базы данных

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5'
```

В MySQL консоли:
```sql
CREATE DATABASE IF NOT EXISTS online_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE online_chat;
```

## Шаг 2: Применение схемы

### Вариант 1: Через файл

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat < database/schema.sql
```

### Вариант 2: Через MySQL консоль

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat
```

Затем в консоли:
```sql
SOURCE /полный/путь/к/проекту/database/schema.sql;
```

## Шаг 3: Создание администратора

```bash
cd backend
npm install
npx ts-node scripts/create-admin.ts admin123
```

Скопируйте выведенный хеш и выполните:

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat
```

В MySQL консоли:
```sql
INSERT INTO operators (name, email, password_hash, role, status_presence) 
VALUES ('Администратор', 'admin@example.com', 'ВАШ_ХЕШ_ЗДЕСЬ', 'admin', 'offline');
```

## Проверка подключения

```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat -e "SHOW TABLES;"
```

Должны увидеть список таблиц:
- clients
- conversations
- messages
- operators
- queues
- operator_queues
- message_templates
- operator_actions

## Настройка Backend

Файл `.env` в папке `backend/` должен содержать:

```env
DB_HOST=217.11.176.136
DB_PORT=3306
DB_USERNAME=mbcc
DB_PASSWORD=SA37WY5
DB_DATABASE=online_chat
```

Скопируйте `env.config` в `.env`:
```bash
cd backend
cp env.config .env
```

