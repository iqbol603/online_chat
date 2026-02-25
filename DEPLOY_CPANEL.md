# Запуск онлайн-чата на cPanel

Проект состоит из **Node.js (NestJS)** бэкенда и **React** фронтендов. На cPanel нужна поддержка **Node.js** (раздел «Setup Node.js App» или «Application Manager»).

---

## 1. Что нужно на хостинге

- cPanel с **Node.js** (версия 18 или 20).
- **MySQL** (база данных).
- Доступ по **SSH** (желательно) или загрузка файлов через File Manager / Git.

Проверка: в cPanel найдите **«Setup Node.js App»** или **«Node.js Selector»**. Если такого нет — на обычном shared-хостинге без Node.js этот бэкенд не запустить, понадобится VPS или хостинг с Node.js.

---

## 2. База данных MySQL

1. В cPanel откройте **MySQL® Databases**.
2. Создайте базу (например `username_onlinechat`).
3. Создайте пользователя и пароль, привяжите пользователя к базе с полными правами (ALL PRIVILEGES).
4. Импортируйте схему:
   - **phpMyAdmin** → ваша база → вкладка **Import** → выберите файл `database/schema.sql` из проекта и выполните импорт.
5. При необходимости выполните миграции из `database/migrations/` (например `execute_this.sql` для таблицы чёрного списка).

Запомните: **хост** (часто `localhost`), **имя базы**, **логин**, **пароль**.

---

## 3. Загрузка проекта на сервер

### Вариант A: через Git (если в cPanel есть Terminal / Git)

```bash
cd ~
git clone https://github.com/iqbol603/online_chat.git
cd online_chat
```

### Вариант B: через архив

1. Локально соберите проект (см. ниже), упакуйте папки `backend`, `frontend`, `operator-panel`, `database` и нужные файлы в ZIP.
2. В cPanel → **File Manager** → загрузите архив в нужную папку (например `online_chat`) и распакуйте.

---

## 4. Бэкенд (NestJS) на cPanel

### 4.1. Создание Node.js приложения в cPanel

1. cPanel → **Setup Node.js App** (или **Application Manager**).
2. **Create Application**:
   - **Node.js version**: 18 или 20.
   - **Application root**: путь к папке бэкенда, например `online_chat/backend` или `backend` (зависит от того, куда вы загрузили проект).
   - **Application URL**: оставьте как есть или укажите поддомен/путь, например `chat-api` (будет `https://ваш-домен.com/chat-api`).
   - **Application startup file**: в репозитории есть только исходник `src/main.ts`. Файл `dist/main.js` **появляется после сборки** (п. 4.3). Укажите в панели: `dist/main.js` — его запускают уже после выполнения `npm run build`.

3. Сохраните приложение.

### 4.2. Переменные окружения (.env)

В папке `backend` должен быть файл `.env`. Создайте или отредактируйте его (через File Manager или по SSH):

```env
# Database (данные из шага 2)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=ваш_mysql_логин
DB_PASSWORD=ваш_mysql_пароль
DB_DATABASE=ваш_имя_базы

# JWT (придумайте длинный случайный ключ)
JWT_SECRET=ваш-секретный-ключ-минимум-32-символа
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=production

# CORS — домены, с которых разрешён доступ (ваш сайт и панель операторов)
CORS_ORIGIN=https://ваш-сайт.com,https://операторы.ваш-сайт.com
```

Важно: замените `ваш-сайт.com` на реальные домены.

### 4.3. Сборка и запуск бэкенда

В репозитории есть только **исходники** (`src/main.ts` и др.). Команда `npm run build` компилирует TypeScript в папку **dist/** — там появится **dist/main.js**, его и запускает cPanel.

Через **Terminal** в cPanel (или по SSH):

```bash
cd ~/online_chat/backend   # или ваш путь к backend

# Установка зависимостей
npm install --production

# Сборка (создаёт dist/main.js из src/main.ts)
npm run build

# Проверка запуска (для теста)
node dist/main.js
```

Остановите тест (Ctrl+C). Дальше приложение должен запускать cPanel (см. пункт 4.1 — startup file `dist/main.js`). В некоторых панелях после создания приложения нужно нажать **Run NPM Install** и **Start App** в интерфейсе Node.js App.

Если в cPanel просят указать **команду запуска**, укажите:

```text
node dist/main.js
```

Или, если приложение должно слушать порт, который выдаёт cPanel (через переменную `PORT`), убедитесь, что в коде используется `process.env.PORT || 3000` (в NestJS обычно уже так).

---

## 5. Фронтенды (виджет чата и панель операторов)

На cPanel фронты удобнее не запускать как Node.js, а **собрать в статику** и раздавать через веб-сервер (Apache на cPanel).

### 5.1. Сборка локально (рекомендуется)

На своём компьютере в папке проекта:

```bash
# Виджет чата (для вставки на сайт)
cd frontend
npm install
npm run build

# Панель операторов
cd ../operator-panel
npm install
npm run build
```

В `frontend` и `operator-panel` появятся папки `dist/` с готовыми файлами.

### 5.2. Настройка URL API и WebSocket

Перед сборкой убедитесь, что в коде указаны правильные адреса бэкенда для продакшена:

- **frontend** (`frontend/src`): где задаётся `API_URL` / `WS_URL` — должен быть ваш домен API, например `https://ваш-домен.com/api` или `https://chat-api.ваш-домен.com`.
- **operator-panel** (`operator-panel/src`): то же — реальный URL бэкенда (в `App.tsx` и при создании socket в `OperatorDashboard.tsx`).

Пересоберите после смены URL.

### 5.3. Загрузка на cPanel

1. Содержимое **frontend/dist** залейте в папку, которая будет открываться по нужному адресу (например поддомен для виджета или каталог `chat`).
2. Содержимое **operator-panel/dist** залейте в папку для панели операторов (например поддомен `operators` или каталог `operator-panel`).

В cPanel для поддомена укажите **Document Root** на соответствующую папку с `index.html` и статикой.

---

## 6. Проксирование API и WebSocket на бэкенд

Обычно Node.js приложение в cPanel слушает внутренний порт (например 3000 или выданный панелью). Запросы с сайта нужно проксировать на этот порт.

### Вариант A: через .htaccess (если бэкенд за поддоменом/путь)

Пример для поддомена `api.ваш-сайт.com`, когда Node.js слушает порт 3000:

В **Document Root** поддомена создайте или измените `.htaccess`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/socket.io
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
ProxyPass /socket.io ws://127.0.0.1:3000/socket.io
```

Точный способ зависит от хостинга (иногда нужны `ProxyPass`/`ProxyPassReverse` в конфиге виртуального хоста, к которому у пользователя нет доступа). Уточните у поддержки хостинга, как проксировать HTTP и WebSocket на порт Node.js приложения.

### Вариант B: отдельный порт (если хостинг разрешает)

Если хостинг даёт доступ к внешнему порту для Node.js приложения, фронтенды могут обращаться к бэкенду напрямую, например `https://ваш-домен.com:3000`. Тогда в CORS укажите этот домен с портом.

---

## 7. Краткий чеклист

| Шаг | Действие |
|-----|----------|
| 1 | Создать MySQL базу и пользователя, импортировать `database/schema.sql` |
| 2 | Загрузить проект (Git или ZIP) в папку на сервере |
| 3 | В cPanel создать Node.js App, указать папку `backend` и startup file `dist/main.js` |
| 4 | В `backend` создать `.env` с DB_*, JWT_SECRET, PORT, CORS_ORIGIN |
| 5 | В папке backend: `npm install`, `npm run build`, запуск через панель Node.js |
| 6 | Локально собрать frontend и operator-panel с правильными API/WS URL |
| 7 | Залить статику frontend и operator-panel в нужные каталоги/поддомены |
| 8 | Настроить прокси с домена на порт Node.js (если нужно) |

---

## 8. Если на хостинге нет Node.js

На многих дешёвых shared-хостингах Node.js нет. Тогда возможны варианты:

- Перейти на хостинг с поддержкой Node.js (например тот же cPanel, но с включённым Node.js).
- Арендовать **VPS** и развернуть бэкенд там (NestJS + nginx + PM2), а на cPanel оставить только статику фронтов и основной сайт.
- Использовать **облачные сервисы** (Railway, Render, Fly.io и т.п.) для бэкенда, а на cPanel — только фронты и сайт.

Если напишете, какой у вас тариф cPanel и есть ли там «Setup Node.js App», можно сузить инструкцию под ваш случай.
