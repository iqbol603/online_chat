# Быстрый старт: Создание операторов

## 🚀 Самый простой способ

### 1. Войти как Admin

Откройте: **http://localhost:3002**

**Данные для входа:**
- Email: `admin@example.com`
- Пароль: `admin123`

### 2. Создать оператора через консоль браузера

После входа нажмите **F12** (открыть консоль) и выполните:

```javascript
// Создать обычного оператора
fetch('http://localhost:3000/api/operators', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('operator_token')
  },
  body: JSON.stringify({
    name: 'Иван Оператор',
    email: 'operator@example.com',
    password: 'operator123',
    role: 'operator'
  })
}).then(r => r.json()).then(console.log);
```

### 3. Создать супервизора

```javascript
fetch('http://localhost:3000/api/operators', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('operator_token')
  },
  body: JSON.stringify({
    name: 'Петр Супервизор',
    email: 'supervisor@example.com',
    password: 'supervisor123',
    role: 'supervisor'
  })
}).then(r => r.json()).then(console.log);
```

## 📋 Готовые команды для копирования

### Оператор
```javascript
fetch('http://localhost:3000/api/operators', {method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('operator_token')}, body: JSON.stringify({name: 'Оператор', email: 'operator@example.com', password: 'operator123', role: 'operator'})}).then(r => r.json()).then(console.log);
```

### Супервизор
```javascript
fetch('http://localhost:3000/api/operators', {method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('operator_token')}, body: JSON.stringify({name: 'Супервизор', email: 'supervisor@example.com', password: 'supervisor123', role: 'supervisor'})}).then(r => r.json()).then(console.log);
```

## ✅ После создания

Новые пользователи могут войти в систему:
- **Оператор**: `operator@example.com` / `operator123`
- **Супервизор**: `supervisor@example.com` / `supervisor123`

## 🔧 Через терминал (альтернатива)

```bash
cd backend/scripts
./create-operator.sh "Имя Оператора" "email@example.com" "password" "operator"
```


