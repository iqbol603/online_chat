#!/bin/bash

# Скрипт для создания оператора/супервизора
# Использование: ./create-operator.sh "Имя" "email@example.com" "password" "role"
# Роли: operator, supervisor, admin

if [ $# -lt 4 ]; then
  echo "Использование: $0 \"Имя\" \"email@example.com\" \"password\" \"role\""
  echo "Роли: operator, supervisor, admin"
  exit 1
fi

NAME=$1
EMAIL=$2
PASSWORD=$3
ROLE=$4

# Получить токен админа
echo "Получение токена админа..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Ошибка: Не удалось получить токен. Проверьте, что backend запущен и админ существует."
  exit 1
fi

echo "Создание оператора..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/operators \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"$NAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"role\": \"$ROLE\",
    \"max_active_chats\": 5
  }")

echo "$RESPONSE" | grep -q "operator_id" && echo "✅ Оператор успешно создан!" || echo "❌ Ошибка: $RESPONSE"


