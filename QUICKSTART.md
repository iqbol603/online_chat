# Быстрый старт

## 1. Настройка базы данных

```bash
# Подключитесь к удаленной БД и создайте схему
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5'
CREATE DATABASE IF NOT EXISTS online_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE online_chat;
SOURCE database/schema.sql;
EXIT;
```

Или примените схему напрямую:
```bash
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat < database/schema.sql
```

## 2. Создание администратора

```bash
cd backend
npm install

# Сгенерируйте хеш пароля
npx ts-node scripts/create-admin.ts admin123

# Скопируйте сгенерированный хеш и выполните SQL:
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat
INSERT INTO operators (name, email, password_hash, role, status_presence) VALUES
('Администратор', 'admin@example.com', 'СКОПИРУЙТЕ_ХЕШ_СЮДА', 'admin', 'offline');
EXIT;
```

## 3. Настройка Backend

```bash
cd backend
# Скопируйте конфигурацию
cp env.config .env

# Файл .env уже содержит правильные данные БД:
# DB_HOST=217.11.176.136
# DB_USERNAME=mbcc
# DB_PASSWORD=SA37WY5
# DB_DATABASE=online_chat

# При необходимости измените JWT_SECRET

npm run start:dev
```

Backend запустится на `http://localhost:3000`

## 4. Настройка Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend запустится на `http://localhost:3001`

## 5. Тестирование

1. Откройте `http://localhost:3001` в браузере
2. Нажмите на кнопку "Чат" внизу справа
3. Заполните форму (имя, телефон, email)
4. Начните общение с ботом
5. Напишите "соединить с оператором" для передачи оператору

## 6. Вход оператора

Для входа оператора используйте API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Вы получите `access_token`, который нужно использовать для авторизованных запросов.

## Следующие шаги

- Создайте операторский кабинет (frontend для операторов)
- Настройте дополнительные очереди
- Добавьте больше операторов через API или админ-панель
- Настройте шаблоны ответов

