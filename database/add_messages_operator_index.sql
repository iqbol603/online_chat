-- Индекс для поиска диалогов, где оператор писал сообщения (аналитика)
ALTER TABLE `messages`
ADD INDEX `idx_conv_sender` (`conversation_id`, `sender_type`, `sender_id`);
