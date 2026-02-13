import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { AppModule } from './app.module';
import * as os from 'os';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Настройка статических файлов для загрузок
  // После компиляции __dirname будет dist/src, поэтому нужно подняться на 2 уровня вверх
  // В development: __dirname = backend/src, нужно ../uploads
  // В production: __dirname = backend/dist/src, нужно ../../uploads
  const uploadsPath = __dirname.includes('dist')
    ? join(__dirname, '..', '..', 'uploads')
    : join(__dirname, '..', 'uploads');
  
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
      
      // Разрешаем домен сервера wifi.babilon-t.tj
      const isServerDomain = /^https?:\/\/wifi\.babilon-t\.tj/.test(origin) || /^https?:\/\/(www\.)?babilon-t\.com/.test(origin);
      
      // Разрешаем localhost на любом порту (для разработки)
      if (isLocalhost) {
        return callback(null, true);
      }
      
      if (isLocalNetwork && isAllowedPort) {
        return callback(null, true);
      }
      
      if (isServerDomain) {
        return callback(null, true);
      }
      
      // Проверяем явно указанные origins из переменной окружения
      const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [];
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Логируем только блокированные запросы (важно для отладки)
      console.warn('[CORS] Blocking origin:', origin);
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

