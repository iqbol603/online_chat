-- Миграция: сделать email необязательным в таблице clients
-- Выполнить: mysql -h 217.11.176.136 -u mbcc -p'SA37WY5' online_chat < database/migrations/make_email_nullable.sql

ALTER TABLE `clients` 
MODIFY COLUMN `email` VARCHAR(255) NULL;

