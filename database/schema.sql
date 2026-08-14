-- Онлайн-чат: Структура базы данных MySQL

-- 1. Таблица клиентов (абонентов)
CREATE TABLE IF NOT EXISTS `clients` (
  `client_id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(13) NOT NULL UNIQUE COMMENT 'Формат: +992987654321',
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `channel` ENUM('web', 'mobile') NOT NULL DEFAULT 'web',
  `account_id` VARCHAR(100) NULL COMMENT 'Лицевой счёт',
  `contract` VARCHAR(100) NULL,
  `personal_account` VARCHAR(100) NULL,
  `language` ENUM('ru', 'tj', 'en') NOT NULL DEFAULT 'ru',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_phone` (`phone`),
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Таблица операторов
CREATE TABLE IF NOT EXISTS `operators` (
  `operator_id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('operator', 'admin', 'supervisor') NOT NULL DEFAULT 'operator',
  `status_presence` ENUM('online', 'away', 'offline') NOT NULL DEFAULT 'offline',
  `max_active_chats` INT NOT NULL DEFAULT 5,
  `last_seen_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
  INDEX `idx_status` (`status_presence`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Таблица очередей
CREATE TABLE IF NOT EXISTS `queues` (
  `queue_id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `department` VARCHAR(100) NULL COMMENT 'интернет/iptv/оплата/техподдержка',
  `routing_mode` ENUM('round-robin', 'least-active', 'skill-based') NOT NULL DEFAULT 'least-active',
  `working_hours` JSON NULL COMMENT 'Расписание работы',
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Связь операторов и очередей (многие ко многим)
CREATE TABLE IF NOT EXISTS `operator_queues` (
  `operator_id` INT NOT NULL,
  `queue_id` INT NOT NULL,
  `priority` INT DEFAULT 0 COMMENT 'Приоритет оператора в очереди',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`operator_id`, `queue_id`),
  FOREIGN KEY (`operator_id`) REFERENCES `operators`(`operator_id`) ON DELETE CASCADE,
  FOREIGN KEY (`queue_id`) REFERENCES `queues`(`queue_id`) ON DELETE CASCADE,
  INDEX `idx_queue` (`queue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Таблица диалогов (Conversations/Tickets)
CREATE TABLE IF NOT EXISTS `conversations` (
  `conversation_id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `status` ENUM('bot', 'queued', 'assigned', 'in_progress', 'closed') NOT NULL DEFAULT 'bot',
  `priority` ENUM('low', 'normal', 'high', 'critical') NOT NULL DEFAULT 'normal',
  `department` VARCHAR(100) NULL COMMENT 'интернет/iptv/оплата/техподдержка',
  `queue_id` INT NULL,
  `assigned_operator_id` INT NULL,
  `tags` JSON NULL COMMENT 'Массив тегов',
  `rating` INT NULL COMMENT 'Оценка 1-5 после закрытия',
  `rating_comment` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `closed_at` TIMESTAMP NULL,
  `queued_at` TIMESTAMP NULL COMMENT 'Когда перешёл в очередь',
  `assigned_at` TIMESTAMP NULL COMMENT 'Когда назначен оператор',
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`client_id`) ON DELETE CASCADE,
  FOREIGN KEY (`assigned_operator_id`) REFERENCES `operators`(`operator_id`) ON DELETE SET NULL,
  FOREIGN KEY (`queue_id`) REFERENCES `queues`(`queue_id`) ON DELETE SET NULL,
  INDEX `idx_client` (`client_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_operator` (`assigned_operator_id`),
  INDEX `idx_queue` (`queue_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Таблица сообщений
CREATE TABLE IF NOT EXISTS `messages` (
  `message_id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT NOT NULL,
  `sender_type` ENUM('client', 'bot', 'operator', 'system') NOT NULL,
  `sender_id` INT NULL COMMENT 'ID клиента или оператора (NULL для bot/system)',
  `text` TEXT NOT NULL,
  `attachments` JSON NULL COMMENT 'Массив вложений',
  `read_by_operator_at` TIMESTAMP NULL,
  `read_by_client_at` TIMESTAMP NULL,
  `edited_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE,
  INDEX `idx_conversation` (`conversation_id`),
  INDEX `idx_created` (`created_at`),
  INDEX `idx_sender` (`sender_type`, `sender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Таблица шаблонов ответов для операторов
CREATE TABLE IF NOT EXISTS `message_templates` (
  `template_id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `text` TEXT NOT NULL,
  `category` VARCHAR(100) NULL,
  `language` ENUM('ru', 'tj', 'en') NOT NULL DEFAULT 'ru',
  `created_by` INT NULL COMMENT 'ID оператора, создавшего шаблон',
  `is_public` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `operators`(`operator_id`) ON DELETE SET NULL,
  INDEX `idx_category` (`category`),
  INDEX `idx_language` (`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Таблица для логирования действий операторов
CREATE TABLE IF NOT EXISTS `operator_actions` (
  `action_id` INT AUTO_INCREMENT PRIMARY KEY,
  `operator_id` INT NOT NULL,
  `conversation_id` INT NULL,
  `action_type` VARCHAR(100) NOT NULL COMMENT 'accept, close, transfer, pause, etc.',
  `details` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`operator_id`) REFERENCES `operators`(`operator_id`) ON DELETE CASCADE,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE SET NULL,
  INDEX `idx_operator` (`operator_id`),
  INDEX `idx_conversation` (`conversation_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Вставка начальных данных

-- Создание очередей по умолчанию
INSERT INTO `queues` (`name`, `department`, `routing_mode`) VALUES
('Техподдержка', 'техподдержка', 'least-active'),
('Оплата', 'оплата', 'least-active'),
('Подключение', 'подключение', 'least-active'),
('Интернет', 'интернет', 'least-active'),
('IPTV', 'iptv', 'least-active')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Создание админа по умолчанию
-- Пароль: admin123
-- ВАЖНО: После первого запуска приложения измените пароль!
-- Хеш для пароля "admin123": $2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq
-- Для генерации нового хеша используйте: node -e "console.log(require('bcrypt').hashSync('your-password', 10))"
INSERT INTO `operators` (`name`, `email`, `password_hash`, `role`, `status_presence`) VALUES
('Администратор', 'admin@example.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'admin', 'offline')
ON DUPLICATE KEY UPDATE `name`=`name`;


-- Таблица чёрного списка (заблокированные клиенты)
CREATE TABLE IF NOT EXISTS `blocked_clients` (
  `blocked_id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(13) NOT NULL COMMENT 'Формат: +992987654321',
  `name` VARCHAR(255) NULL COMMENT 'Имя клиента на момент блокировки',
  `reason` TEXT NULL COMMENT 'Причина блокировки',
  `blocked_by_operator_id` INT NULL COMMENT 'Кто заблокировал',
  `blocked_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `unblocked_at` TIMESTAMP NULL,
  `is_active` BOOLEAN DEFAULT TRUE COMMENT 'Активна ли блокировка',
  INDEX `idx_phone` (`phone`),
  INDEX `idx_is_active` (`is_active`),
  INDEX `idx_blocked_by` (`blocked_by_operator_id`),
  FOREIGN KEY (`blocked_by_operator_id`) REFERENCES `operators`(`operator_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
