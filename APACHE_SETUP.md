# Настройка Apache2 для Socket.IO WebSocket

## Шаг 1: Включите необходимые модули Apache

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo a2enmod ssl  # Если используете HTTPS
sudo a2enmod headers  # Для CORS заголовков

sudo systemctl restart apache2
```

## Шаг 2: Проверьте, что модули включены

```bash
apache2ctl -M | grep -E "proxy|wstunnel|rewrite|ssl|headers"
```

Должны увидеть:
- `proxy_module`
- `proxy_http_module`
- `proxy_wstunnel_module`
- `rewrite_module`
- `ssl_module` (если используете HTTPS)
- `headers_module`

## Шаг 3: Создайте или отредактируйте VirtualHost

Создайте файл конфигурации:

```bash
sudo nano /etc/apache2/sites-available/wifi.babilon-t.tj.conf
```

Или отредактируйте существующий конфиг для порта 3063.

## Шаг 4: Добавьте конфигурацию

**ВАЖНО:** Блок для `/socket.io/` должен быть ПЕРЕД блоком `/api/`!

```apache
<VirtualHost *:3063>
    ServerName wifi.babilon-t.tj
    
    # SSL настройки (если используете HTTPS)
    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    
    # ============================================
    # SOCKET.IO WEBSOCKET - ОБЯЗАТЕЛЬНО ПЕРВЫМ!
    # ============================================
    ProxyPreserveHost On
    
    # WebSocket для Socket.IO
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /socket.io/(.*) ws://127.0.0.1:3060/socket.io/$1 [P,L]
    
    # HTTP polling fallback для Socket.IO
    ProxyPass /socket.io/ http://127.0.0.1:3060/socket.io/
    ProxyPassReverse /socket.io/ http://127.0.0.1:3060/socket.io/
    
    # ============================================
    # REST API
    # ============================================
    ProxyPass /api/ http://127.0.0.1:3060/api/
    ProxyPassReverse /api/ http://127.0.0.1:3060/api/
    
    # ============================================
    # STATIC FILES (uploads)
    # ============================================
    ProxyPass /uploads/ http://127.0.0.1:3060/uploads/
    ProxyPassReverse /uploads/ http://127.0.0.1:3060/uploads/
    
    # Логирование
    ErrorLog ${APACHE_LOG_DIR}/wifi.babilon-t.tj-error.log
    CustomLog ${APACHE_LOG_DIR}/wifi.babilon-t.tj-access.log combined
</VirtualHost>
```

## Шаг 5: Активируйте сайт (если создали новый)

```bash
sudo a2ensite wifi.babilon-t.tj.conf
sudo systemctl reload apache2
```

## Шаг 6: Проверьте конфигурацию

```bash
sudo apache2ctl configtest
```

Должно быть: `Syntax OK`

## Шаг 7: Перезапустите Apache

```bash
sudo systemctl restart apache2
```

## Шаг 8: Проверьте логи

Если WebSocket не работает, проверьте логи:

```bash
# Ошибки
sudo tail -f /var/log/apache2/wifi.babilon-t.tj-error.log

# Доступы
sudo tail -f /var/log/apache2/wifi.babilon-t.tj-access.log
```

## Альтернативный вариант (если Rewrite не работает)

Если Rewrite не работает, попробуйте этот вариант:

```apache
<VirtualHost *:3063>
    ServerName wifi.babilon-t.tj
    
    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    
    ProxyPreserveHost On
    
    # Socket.IO - используем mod_proxy_wstunnel напрямую
    <LocationMatch "^/socket\.io/">
        ProxyPass ws://127.0.0.1:3060/socket.io/ upgrade=websocket
        ProxyAddHeaders Off
        ProxyPreserveHost On
    </LocationMatch>
    
    # HTTP fallback для Socket.IO polling
    ProxyPass /socket.io/ http://127.0.0.1:3060/socket.io/
    ProxyPassReverse /socket.io/ http://127.0.0.1:3060/socket.io/
    
    # REST API
    ProxyPass /api/ http://127.0.0.1:3060/api/
    ProxyPassReverse /api/ http://127.0.0.1:3060/api/
    
    # Static files
    ProxyPass /uploads/ http://127.0.0.1:3060/uploads/
    ProxyPassReverse /uploads/ http://127.0.0.1:3060/uploads/
</VirtualHost>
```

## Проверка работы

1. Откройте браузер и перейдите на `https://wifi.babilon-t.tj:3063`
2. Откройте консоль разработчика (F12)
3. Проверьте, что WebSocket подключается без ошибок
4. В логах Apache должны быть записи о подключениях к `/socket.io/`

## Решение проблем

### WebSocket не подключается

1. **Проверьте, что backend запущен:**
   ```bash
   curl http://127.0.0.1:3060/health
   ```

2. **Проверьте, что модули включены:**
   ```bash
   apache2ctl -M | grep proxy
   ```

3. **Проверьте логи Apache:**
   ```bash
   sudo tail -50 /var/log/apache2/error.log
   ```

4. **Проверьте, что порт 3063 открыт:**
   ```bash
   sudo netstat -tlnp | grep 3063
   ```

### 502 Bad Gateway

Это означает, что Apache не может подключиться к backend. Проверьте:
- Backend запущен на `127.0.0.1:3060`
- Нет файрвола, блокирующего подключение
- Docker контейнер доступен из хоста

### SSL ошибки

Убедитесь, что:
- SSL сертификаты указаны правильно
- Порты 443 и 3063 открыты
- Сертификат действителен для домена `wifi.babilon-t.tj`


