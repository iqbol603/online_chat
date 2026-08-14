# Docker — backend

После обновления `tsconfig.build.json` точка входа изменилась:

| Было (старое) | Стало (новое) |
|---------------|---------------|
| `node dist/src/main.js` | `node dist/main.js` |

Если контейнер падает с `Cannot find module '/app/dist/src/main.js'` — обновите команду запуска.

## Быстрый фикс на сервере

```bash
cd /home/marketing/projects/online_chat
git pull

# Найти где указан старый путь
grep -r "dist/src/main" .

# Пересобрать и перезапустить (docker-compose из репозитория)
docker compose build backend
docker compose up -d backend

docker logs -f online_chat_back_cnt
```

## Если docker-compose свой (не из git)

В `docker-compose.yml` или Dockerfile замените:

```yaml
# было
command: node dist/src/main.js

# стало
command: node dist/main.js
```

или:

```yaml
command: npm run start:prod
```

## Проверка

```bash
docker logs online_chat_back_cnt --tail 20
curl -i http://localhost:3060/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

В логах должно быть: `🚀 Server running on:`
