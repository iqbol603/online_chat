# Инструкция по развертыванию

## Предварительные требования

- Node.js 18+ 
- MySQL 8+
- npm или yarn

## Пошаговая установка

### Шаг 1: Клонирование и установка зависимостей

```bash
cd onlineChat

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Шаг 2: Настройка базы данных

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

### Шаг 3: Создание администратора

```bash
cd backend

# Сгенерируйте хеш пароля
npx ts-node scripts/create-admin.ts admin123

# Скопируйте выведенный хеш и выполните:
mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat
INSERT INTO operators (name, email, password_hash, role, status_presence) 
VALUES ('Администратор', 'admin@example.com', 'ВАШ_ХЕШ_ЗДЕСЬ', 'admin', 'offline');
EXIT;
```

### Шаг 4: Настройка Backend

```bash
cd backend

# Файл .env уже создан с правильными данными БД:
# DB_HOST=217.11.176.136
# DB_PORT=3306
# DB_USERNAME=mbcc
# DB_PASSWORD=SA37WY5
# DB_DATABASE=online_chat

# При необходимости измените JWT_SECRET на более безопасный
```

### Шаг 5: Запуск Backend

```bash
cd backend
npm run start:dev
```

Backend будет доступен на `http://localhost:3000`

### Шаг 6: Запуск Frontend

В новом терминале:

```bash
cd frontend
npm run dev
```

Frontend будет доступен на `http://localhost:3001`

## Проверка работы

1. Откройте `http://localhost:3001` в браузере
2. Нажмите кнопку "Чат" внизу справа
3. Заполните форму регистрации
4. Начните общение с ботом
5. Попробуйте написать "соединить с оператором"

## Вход оператора

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Ответ будет содержать `access_token` для использования в заголовке:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Создание оператора через API

```bash
curl -X POST http://localhost:3000/api/operators \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Иван Иванов",
    "email": "operator@example.com",
    "password": "password123",
    "role": "operator",
    "max_active_chats": 5
  }'
```

## Назначение оператора в очередь

```bash
curl -X POST http://localhost:3000/api/operators/1/queues/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priority": 0}'
```

## Продакшн развертывание

### Backend

1. Отключите `synchronize: true` в `app.module.ts`
2. Используйте миграции TypeORM
3. Настройте переменные окружения
4. Используйте PM2 или systemd для запуска
5. Настройте Nginx как reverse proxy
6. Включите HTTPS

### Frontend

```bash
cd frontend
npm run build
# Файлы будут в dist/
```

Настройте Nginx для раздачи статических файлов.

### База данных

- Создайте отдельного пользователя БД с ограниченными правами
- Настройте резервное копирование
- Используйте connection pooling

## Мониторинг

Рекомендуется настроить:
- Логирование (Winston, Pino)
- Мониторинг ошибок (Sentry)
- Метрики (Prometheus)
- Health checks

## Безопасность

- ✅ Используйте сильные пароли
- ✅ Настройте HTTPS
- ✅ Ограничьте CORS
- ✅ Добавьте rate limiting
- ✅ Валидируйте все входные данные
- ✅ Используйте prepared statements (TypeORM делает это автоматически)
- ✅ Регулярно обновляйте зависимости

