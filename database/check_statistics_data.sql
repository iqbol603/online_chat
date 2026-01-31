-- Проверка данных для статистики операторов

-- 1. Проверка операторов
SELECT 
    operator_id,
    name,
    email,
    role,
    status_presence
FROM operators
ORDER BY name;

-- 2. Проверка закрытых разговоров с назначенными операторами
SELECT 
    c.conversation_id,
    c.assigned_operator_id,
    o.name as operator_name,
    c.status,
    c.closed_at,
    c.rating,
    c.rating_comment,
    c.created_at
FROM conversations c
LEFT JOIN operators o ON c.assigned_operator_id = o.operator_id
WHERE c.status = 'closed'
  AND c.assigned_operator_id IS NOT NULL
  AND c.closed_at IS NOT NULL
ORDER BY c.closed_at DESC
LIMIT 20;

-- 3. Статистика по операторам за текущий месяц
SELECT 
    o.operator_id,
    o.name,
    o.email,
    o.role,
    COUNT(c.conversation_id) as total_closed,
    COUNT(CASE WHEN c.rating IS NOT NULL THEN 1 END) as total_rated,
    AVG(c.rating) as average_rating
FROM operators o
LEFT JOIN conversations c ON c.assigned_operator_id = o.operator_id
    AND c.status = 'closed'
    AND c.closed_at IS NOT NULL
    AND YEAR(c.closed_at) = YEAR(CURRENT_DATE)
    AND MONTH(c.closed_at) = MONTH(CURRENT_DATE)
GROUP BY o.operator_id, o.name, o.email, o.role
ORDER BY o.name;

-- 4. Проверка разговоров за период (пример: декабрь 2025 - январь 2026)
SELECT 
    o.operator_id,
    o.name,
    COUNT(c.conversation_id) as total_closed,
    COUNT(CASE WHEN c.rating IS NOT NULL THEN 1 END) as total_rated,
    AVG(c.rating) as average_rating
FROM operators o
LEFT JOIN conversations c ON c.assigned_operator_id = o.operator_id
    AND c.status = 'closed'
    AND c.closed_at IS NOT NULL
    AND c.closed_at >= '2025-12-20 00:00:00'
    AND c.closed_at <= '2026-01-30 23:59:59'
GROUP BY o.operator_id, o.name
ORDER BY o.name;
