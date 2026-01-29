# Пошаговая инструкция по настройке Apache для WebSocket

## ШАГ 1: Включить модули Apache

Выполните на сервере:

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo systemctl restart apache2
```

Проверьте, что модули включены:

```bash
apache2ctl -M | grep -E "proxy|wstunnel|rewrite"
```

Должны увидеть:
- `proxy_module`
- `proxy_http_module`
- `proxy_wstunnel_module`
- `rewrite_module`

---

## ШАГ 2: Найти и открыть конфиг

Найдите файл конфигурации для порта 3063:

```bash
# Вариант 1: в sites-available
sudo nano /etc/apache2/sites-available/wifi.babilon-t.tj.conf

# Вариант 2: в sites-enabled
sudo nano /etc/apache2/sites-enabled/wifi.babilon-t.tj.conf

# Или найдите все конфиги с 3063:
sudo grep -r "3063" /etc/apache2/sites-available/
sudo grep -r "3063" /etc/apache2/sites-enabled/
```

---

## ШАГ 3: Заменить конфиг

Найдите блок `<VirtualHost *:3063>` и **полностью замените** его на:

```apache
<VirtualHost *:3063>
    ServerAdmin webmaster@localhost
    ServerName wifi.babilon-t.tj
    ServerAlias www.wifi.babilon-t.tj
#    DocumentRoot /var/www/html

    ErrorLog ${APACHE_LOG_DIR}/wifi-error.log
    CustomLog ${APACHE_LOG_DIR}/wifi-access.log combined

    ProxyPreserveHost On
    
    # ===== SOCKET.IO WEBSOCKET - ОБЯЗАТЕЛЬНО ПЕРВЫМ! =====
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /socket.io/(.*) ws://127.0.0.1:3060/socket.io/$1 [P,L]
    
    # HTTP polling fallback для Socket.IO
    ProxyPass /socket.io/ http://127.0.0.1:3060/socket.io/
    ProxyPassReverse /socket.io/ http://127.0.0.1:3060/socket.io/
    
    # ===== Остальные пути (API, uploads, фронт) =====
    ProxyPass        "/" "http://127.0.0.1:3060/"
    ProxyPassReverse "/" "http://127.0.0.1:3060/"

    SSLCertificateFile /etc/letsencrypt/live/wifi.babilon-t.tj/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/wifi.babilon-t.tj/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
```

**ВАЖНО:** 
- Блок для `/socket.io/` должен быть **ПЕРЕД** общим `ProxyPass "/"`
- Сохраните файл: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## ШАГ 4: Проверить конфиг и перезапустить

```bash
# Проверка синтаксиса
sudo apache2ctl configtest

# Должно вывести: Syntax OK
# Если есть ошибки - исправьте их

# Перезапустить Apache
sudo systemctl restart apache2

# Проверить статус
sudo systemctl status apache2
```

---

## ШАГ 5: Проверить логи

В одном терминале смотрите логи ошибок:

```bash
sudo tail -f /var/log/apache2/wifi-error.log
```

В другом терминале смотрите логи доступа:

```bash
sudo tail -f /var/log/apache2/wifi-access.log
```

---

## ШАГ 6: Проверить работу

1. Откройте в браузере:
   - Оператор панель: `https://wifi.babilon-t.tj:3061/`
   - Фронт часть: `https://wifi.babilon-t.tj:3062/` (или какой у вас порт)

2. Откройте консоль разработчика (F12)

3. Перейдите на вкладку **Console** или **Network**

4. Обновите страницу

5. Проверьте:
   - В Console не должно быть ошибок `WebSocket connection to 'wss://wifi.babilon-t.tj:3063/socket.io/...' failed`
   - В Network → WS должны быть успешные подключения к `wss://wifi.babilon-t.tj:3063/socket.io/...`

---

## Если не работает:

### Проверьте, что backend запущен:

```bash
# На сервере проверьте, что backend слушает на 3060
sudo netstat -tlnp | grep 3060
# или
sudo ss -tlnp | grep 3060

# Должно быть что-то вроде:
# tcp  0  0 127.0.0.1:3060  0.0.0.0:*  LISTEN  ...
```

### Проверьте подключение к backend:

```bash
curl http://127.0.0.1:3060/health
# Должен вернуть ответ от backend
```

### Проверьте логи Apache:

```bash
# Ошибки
sudo tail -50 /var/log/apache2/wifi-error.log

# Доступы (ищите запросы к /socket.io/)
sudo tail -50 /var/log/apache2/wifi-access.log | grep socket
```

### Проверьте, что порт 3063 открыт:

```bash
sudo netstat -tlnp | grep 3063
# или
sudo ss -tlnp | grep 3063
```

---

## Дополнительная информация:

- **Оператор панель** работает на порту **3061**
- **Фронт часть** работает на порту **3062** (или другом)
- **Backend** работает на порту **3060** (внутри Docker)
- **Apache** проксирует запросы с порта **3063** на backend **3060**

Все запросы к `https://wifi.babilon-t.tj:3063` (API и WebSocket) идут через Apache на backend.


