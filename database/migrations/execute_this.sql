-- ============================================
-- SQL МИГРАЦИЯ: Таблица чёрного списка
-- Скопируйте и выполните этот скрипт в MySQL
-- ============================================

USE online_chat;

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

-- Проверка создания таблицы
SELECT 'Таблица blocked_clients успешно создана!' AS status;
SHOW TABLES LIKE 'blocked_clients';
