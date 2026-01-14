# Права доступа и роли

## Роли в системе

### 1. Operator (Оператор)
**Базовый доступ:**
- ✅ Видит только свои активные диалоги
- ✅ Может принимать диалоги из очереди
- ✅ Может отвечать на сообщения
- ✅ Может закрывать свои диалоги
- ✅ Управление своим статусом (онлайн/офлайн)

**Ограничения:**
- ❌ Не видит диалоги других операторов
- ❌ Не может переназначать диалоги
- ❌ Не может управлять другими операторами

### 2. Supervisor (Супервизор)
**Все права Operator + дополнительно:**
- ✅ Видит ВСЕ диалоги в системе
- ✅ Может переназначать диалоги другим операторам
- ✅ Может просматривать аналитику
- ✅ Может видеть список всех операторов
- ✅ Может управлять очередями операторов

**Ограничения:**
- ❌ Не может создавать/удалять операторов
- ❌ Не может изменять настройки системы

### 3. Admin (Администратор)
**Все права Supervisor + дополнительно:**
- ✅ Полное управление операторами:
  - Создание новых операторов
  - Редактирование операторов
  - Удаление операторов
  - Назначение ролей
- ✅ Управление настройками системы
- ✅ Управление очередями
- ✅ Полный доступ к аналитике

## API Endpoints по ролям

### Operator
```
GET  /api/conversations/status/:status  - Только свои диалоги
GET  /api/conversations/:id             - Только свои диалоги
PATCH /api/conversations/:id/assign     - Принять диалог
PATCH /api/conversations/:id/close     - Закрыть свой диалог
POST /api/messages                      - Отправить сообщение
PATCH /api/operators/:id/status         - Изменить свой статус
```

### Supervisor
```
GET  /api/conversations                 - ВСЕ диалоги
GET  /api/conversations/status/:status  - ВСЕ диалоги по статусу
PATCH /api/conversations/:id/reassign   - Переназначить диалог
GET  /api/operators                     - Список всех операторов
POST /api/operators/:id/queues/:queueId - Назначить оператора в очередь
```

### Admin
```
POST   /api/operators                   - Создать оператора
PATCH  /api/operators/:id               - Редактировать оператора
DELETE /api/operators/:id               - Удалить оператора
GET    /api/operators                   - Список всех операторов
POST   /api/queues                      - Создать очередь
PATCH  /api/queues/:id                  - Редактировать очередь
```

## Реализация в коде

### Использование декораторов

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/operators')
export class OperatorsController {
  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles('admin')  // Только админ может создавать операторов
  async create(@Body() dto: CreateOperatorDto) {
    // ...
  }
}
```

### Проверка роли в сервисе

```typescript
// В контроллере
@Get('status/:status')
@UseGuards(JwtAuthGuard)
async findByStatus(@Param('status') status: string, @Request() req: any) {
  const user = req.user;
  
  if (user.role === 'supervisor' || user.role === 'admin') {
    // Видеть все диалоги
    return await this.conversationsService.findAll(status);
  } else {
    // Видеть только свои
    return await this.conversationsService.findByOperator(user.operator_id, status);
  }
}
```

## Операторский кабинет

Интерфейс операторского кабинета автоматически адаптируется под роль:

- **Operator**: Видит только свои диалоги
- **Supervisor**: Видит все диалоги + кнопка "Переназначить"
- **Admin**: Все функции Supervisor + вкладка "Управление операторами"

## Создание пользователей с разными ролями

### Создать Supervisor через API (требует админа):
```bash
curl -X POST http://localhost:3000/api/operators \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Супервизор",
    "email": "supervisor@example.com",
    "password": "password123",
    "role": "supervisor"
  }'
```

### Создать Operator через API (требует админа):
```bash
curl -X POST http://localhost:3000/api/operators \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Оператор",
    "email": "operator@example.com",
    "password": "password123",
    "role": "operator"
  }'
```

## Примечания

- Все операторы могут видеть очередь диалогов (`queued`)
- Только Supervisor и Admin могут видеть диалоги других операторов
- Только Admin может управлять операторами (создание, редактирование, удаление)
- Supervisor может переназначать диалоги, но не может управлять операторами


