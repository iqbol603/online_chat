import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ClientsModule } from './clients/clients.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { OperatorsModule } from './operators/operators.module';
import { QueuesModule } from './queues/queues.module';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { ChatModule } from './chat/chat.module';
import { RoutingModule } from './routing/routing.module';
import { BlockedClientsModule } from './blocked-clients/blocked-clients.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'online_chat'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Отключено, так как БД уже создана вручную
        logging: configService.get<string>('NODE_ENV') === 'development',
        // ВАЖНО: фиксируем таймзону для записи/чтения дат, чтобы не было сдвига -5 часов
        // (на сервере Asia/Dushanbe, +05:00)
        timezone: '+05:00',
        extra: {
          timezone: '+05:00',
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    ClientsModule,
    ConversationsModule,
    MessagesModule,
    OperatorsModule,
    QueuesModule,
    AuthModule,
    BotModule,
    RoutingModule,
    ChatModule,
    BlockedClientsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

