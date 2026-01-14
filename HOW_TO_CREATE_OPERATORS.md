# Как войти как Admin и создать операторов

## Способ 1: Через операторский кабинет (проще)

### Шаг 1: Войти как Admin

1. Откройте операторский кабинет: `http://localhost:3002`
2. Введите данные:
   - **Email**: `admin@example.com`
   - **Пароль**: `admin123`

### Шаг 2: Создать оператора через API (из браузера)

После входа откройте консоль браузера (F12) и выполните:

```javascript
// Получить токен из localStorage
const token = localStorage.getItem('operator_token');

// Создать оператора
fetch('http://localhost:3000/api/operators', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Иван Оператор',
    email: 'operator@example.com',
    password: 'operator123',
    role: 'operator',
    max_active_chats: 5
  })
})
.then(r => r.json())
.then(console.log);
```

### Шаг 3: Создать супервизора

```javascript
const token = localStorage.getItem('operator_token');

fetch('http://localhost:3000/api/operators', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Петр Супервизор',
    email: 'supervisor@example.com',
    password: 'supervisor123',
    role: 'supervisor',
    max_active_chats: 10
  })
})
.then(r => r.json())
.then(console.log);
```

## Способ 2: Через терминал (curl)

### Шаг 1: Получить токен админа

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Ответ будет примерно таким:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "operator": {
    "operator_id": 1,
    "name": "Администратор",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Шаг 2: Создать оператора

```bash
# Замените YOUR_TOKEN на токен из шага 1
curl -X POST http://localhost:3000/api/operators \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Иван Оператор",
    "email": "operator@example.com",
    "password": "operator123",
    "role": "operator",
    "max_active_chats": 5
  }'
```

### Шаг 3: Создать супервизора

```bash
curl -X POST http://localhost:3000/api/operators \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Петр Супервизор",
    "email": "supervisor@example.com",
    "password": "supervisor123",
    "role": "supervisor",
    "max_active_chats": 10
  }'
```

## Способ 3: Через скрипт (самый простой)

Создайте файл `create-operator.sh`:

```bash
#!/bin/bash

# Сначала получите токен
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.access_token')

# Создать оператора
curl -X POST http://localhost:3000/api/operators \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "'"$1"'",
    "email": "'"$2"'",
    "password": "'"$3"'",
    "role": "'"$4"'",
    "max_active_chats": 5
  }'

echo ""
```

Использование:
```bash
chmod +x create-operator.sh
./create-operator.sh "Иван Оператор" "operator@example.com" "operator123" "operator"
./create-operator.sh "Петр Супервизор" "supervisor@example.com" "supervisor123" "supervisor"
```

## Проверка созданных операторов

```bash
# Получить токен
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.access_token')

# Список всех операторов
curl -X GET http://localhost:3000/api/operators \
  -H "Authorization: Bearer $TOKEN"
```

## Важно

- Только пользователь с ролью `admin` может создавать операторов
- Роли: `operator`, `supervisor`, `admin`
- После создания оператор может войти в систему с указанными email и паролем


