import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { AppModule } from './app.module';
import * as os from 'os';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { getBackendRoot, getUploadsPath } from './common/uploads-path';

// Загрузка .env относительно папки backend (важно для cPanel и Docker)
const pathToEnv = join(getBackendRoot(), '.env');
if (existsSync(pathToEnv)) {
  const content = readFileSync(pathToEnv, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
  console.log('[main] Loaded .env from', pathToEnv);
} else {
  console.warn('[main] No .env at', pathToEnv, '- using process.env');
}
// Проверка переменных при старте (без вывода секретов)
console.log('[main] DB_HOST=', process.env.DB_HOST ? 'set' : 'MISSING', 'JWT_SECRET=', process.env.JWT_SECRET ? 'set' : 'MISSING');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Опциональный глобальный префикс для всех маршрутов (например, /chat_backend)
  // На cPanel можно задать переменную окружения GLOBAL_PREFIX=chat_backend
  const globalPrefix = process.env.GLOBAL_PREFIX;
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
    console.log(`[main] Global prefix set: ${globalPrefix}`);
  }
  
  const uploadsPath = getUploadsPath();
  console.log(`📁 Uploads directory: ${uploadsPath}`);

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
  });
  
  // Валидация - отключаем enableImplicitConversion чтобы избежать проблем с query параметрами
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: {
      enableImplicitConversion: false, // Отключаем автоматическое преобразование типов
    },
  }));

  // CORS - разрешаем доступ с локальной сети
  app.enableCors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, мобильные приложения, Postman)



      if (!origin) {
        return callback(null, true);
      }
      
      // Разрешаем localhost на любом порту (для разработки)
      const isLocalhost = origin.includes('localhost') || 
                         origin.includes('127.0.0.1') || 
                         origin.includes('0.0.0.0') ||
                         /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(origin);
      
      // Разрешаем локальную сеть
      const isLocalNetwork = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin);
      
      // Разрешаем порты 3001 и 3002 (frontend и operator-panel)
      const isAllowedPort = /:300[12]/.test(origin);
      
      // Разрешаем домен сервера wifi.babilon-t.tj, babilon-t.tj и основной сайт / поддомены babilon-t.com
      const isServerDomain = 
        /^https?:\/\/wifi\.babilon-t\.tj/.test(origin) || 
        /^https?:\/\/chatbt\.babilon-t\.com/.test(origin) || 
        /^https?:\/\/(www\.)?babilon-t\.com/.test(origin) ||
        /^https?:\/\/babilon-t\.com/.test(origin) ||
        /^https?:\/\/(www\.)?babilon-t\.tj/.test(origin) ||
        /^https?:\/\/babilon-t\.tj/.test(origin);
      
      // Разрешаем localhost на любом порту (для разработки)
      if (isLocalhost) {
        console.log('[CORS] Allowing localhost origin:', origin);
        return callback(null, true);
      }
      
      if (isLocalNetwork && isAllowedPort) {
        console.log('[CORS] Allowing local network origin:', origin);
        return callback(null, true);
      }
      
      if (isServerDomain) {
        console.log('[CORS] Allowing server domain origin:', origin);
        console.log('[CORS] Origin details:', {
          origin,
          hostname: origin ? new URL(origin).hostname : 'N/A',
          protocol: origin ? new URL(origin).protocol : 'N/A',
        });
        return callback(null, true);
      }
      
      // Проверяем явно указанные origins из переменной окружения
      const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [];
      if (corsOrigins.includes(origin)) {
        console.log('[CORS] Allowing CORS_ORIGIN origin:', origin);
        return callback(null, true);
      }
      
      // Логируем только блокированные запросы (важно для отладки)
      console.warn('[CORS] Blocking origin:', origin);
      console.warn('[CORS] Allowed: localhost, local network, wifi.babilon-t.tj, babilon-t.com, babilon-t.tj, CORS_ORIGIN');
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  const port = process.env.PORT || 3060;
  const host = '0.0.0.0'; // Слушаем на всех интерфейсах
  
  await app.listen(port, host);
  
  // Получаем локальный IP адрес
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost';
  
  for (const interfaceName of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[interfaceName] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== 'localhost') break;
  }
  
  console.log(`🚀 Server running on:`);
  console.log(`   http://localhost:${port}`);
  console.log(`   http://${localIp}:${port}`);
  console.log(`📡 WebSocket available at:`);
  console.log(`   ws://localhost:${port}`);
  console.log(`   ws://${localIp}:${port}`);
}

bootstrap();

