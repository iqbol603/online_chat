# Скрипты

## create-admin.ts

Генерирует bcrypt hash для пароля администратора.

```bash
npx ts-node scripts/create-admin.ts [password]
```

Если пароль не указан, используется `admin123` по умолчанию.

Пример:
```bash
npx ts-node scripts/create-admin.ts mypassword
```

