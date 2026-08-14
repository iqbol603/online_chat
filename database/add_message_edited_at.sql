-- Поле для отметки редактирования сообщений оператором
ALTER TABLE `messages`
ADD COLUMN `edited_at` TIMESTAMP NULL DEFAULT NULL AFTER `read_by_client_at`;
