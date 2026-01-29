-- Обновление enum для поля language в таблице clients
-- Добавление значения 'en' к существующему enum

ALTER TABLE `clients` 
MODIFY COLUMN `language` ENUM('ru', 'tj', 'en') NOT NULL DEFAULT 'ru';

