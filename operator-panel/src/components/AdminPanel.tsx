import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './AdminPanel.css';

interface Operator {
  operator_id: number;
  name: string;
  email: string;
  role: 'operator' | 'supervisor' | 'admin';
  status_presence: 'online' | 'away' | 'offline';
  max_active_chats: number;
}

interface AdminPanelProps {
  apiUrl: string;
  operatorRole?: 'operator' | 'supervisor' | 'admin';
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('operator_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface OperatorStatistics {
  operator_id: number;
  name: string;
  email: string;
  role: string;
  total_closed: number;
  total_rated: number;
  average_rating: number | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ apiUrl, operatorRole }) => {
  // Статистика
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState<OperatorStatistics[]>([]);
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [statisticsPeriod, setStatisticsPeriod] = useState({
    startDate: '',
    endDate: '',
  });

  const canViewStatistics = operatorRole === 'admin' || operatorRole === 'supervisor';
  const statisticsLoadedRef = useRef(false);

  // Аналитика (только для admin)
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const [analyticsPeriod, setAnalyticsPeriod] = useState({ startDate: today, endDate: today });
  const [includeAssigned, setIncludeAssigned] = useState(true);
  const [includeClosedBy, setIncludeClosedBy] = useState(true);
  const [archivedConversations, setArchivedConversations] = useState<any[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [selectedArchivedId, setSelectedArchivedId] = useState<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Чёрный список
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [blockedClients, setBlockedClients] = useState<any[]>([]);
  const [loadingBlacklist, setLoadingBlacklist] = useState(false);
  const [blockPhone, setBlockPhone] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockClientName, setBlockClientName] = useState('');

  // Быстрая статистика обращений
  const [quickStats, setQuickStats] = useState<{ total: number; conversations: any[] } | null>(null);
  const [loadingQuickStats, setLoadingQuickStats] = useState(false);
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [quickStatsPeriod, setQuickStatsPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Операторы для аналитики
  const [operatorsForAnalytics, setOperatorsForAnalytics] = useState<Operator[]>([]);

  useEffect(() => {
    // Устанавливаем период по умолчанию (текущий месяц)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStatisticsPeriod({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0],
    });
    // Автоматически показываем статистику для супервизоров
    if (canViewStatistics && operatorRole === 'supervisor') {
      setShowStatistics(true);
    }
    // Загружаем операторов для аналитики
    if (operatorRole === 'admin' || operatorRole === 'supervisor') {
      loadOperatorsForAnalytics();
    }
  }, []);

  const loadOperatorsForAnalytics = async () => {
    try {
      const response = await axios.get(`${apiUrl}/operators`);
      setOperatorsForAnalytics(response.data);
    } catch (error) {
      console.error('Error loading operators for analytics:', error);
    }
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { text: string; class: string }> = {
      admin: { text: 'Админ', class: 'badge-admin' },
      supervisor: { text: 'Супервизор', class: 'badge-supervisor' },
      operator: { text: 'Оператор', class: 'badge-operator' },
    };
    const badge = badges[role] || badges.operator;
    return <span className={`role-badge ${badge.class}`}>{badge.text}</span>;
  };

  useEffect(() => {
    // Автоматически загружаем статистику для супервизоров при открытии
    if (
      canViewStatistics &&
      operatorRole === 'supervisor' &&
      showStatistics &&
      !statisticsLoadedRef.current &&
      statisticsPeriod.startDate &&
      statisticsPeriod.endDate
    ) {
      statisticsLoadedRef.current = true;
      loadStatistics();
    }
  }, [showStatistics, statisticsPeriod.startDate, statisticsPeriod.endDate]);

  const loadArchivedConversations = async () => {
    if (!selectedOperatorId || !analyticsPeriod.startDate || !analyticsPeriod.endDate) {
      alert('Выберите оператора и период (от-до)');
      return;
    }

    setLoadingArchived(true);
    try {
      const response = await axios.get(
        `${apiUrl}/conversations/operator/${selectedOperatorId}/archived`,
        {
          params: {
            startDate: analyticsPeriod.startDate,
            endDate: analyticsPeriod.endDate,
            includeAssigned: String(includeAssigned),
            includeClosedBy: String(includeClosedBy),
            limit: 500,
          },
          headers: getAuthHeaders(),
          timeout: 120000,
        }
      );
      setArchivedConversations(response.data);
      setSelectedArchivedId(null);
      setSelectedConversation(null);
      setConversationMessages([]);
    } catch (error: any) {
      console.error('Error loading archived conversations:', error);
      const msg = error.response?.data?.message
        || (error.code === 'ECONNABORTED' ? 'Превышено время ожидания. Сузьте период или обновите backend.' : null)
        || (error.code === 'ERR_NETWORK' ? 'Нет связи с сервером. Проверьте API и авторизацию.' : error.message)
        || 'Ошибка загрузки архивных чатов';
      alert(msg);
    } finally {
      setLoadingArchived(false);
    }
  };

  const loadConversationMessages = async (conversationId: number) => {
    setLoadingMessages(true);
    try {
      const response = await axios.get(`${apiUrl}/messages/conversation/${conversationId}`, {
        headers: getAuthHeaders(),
      });
      setConversationMessages(response.data);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      alert('Ошибка загрузки сообщений');
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const loadStatistics = async () => {
    if (!statisticsPeriod.startDate || !statisticsPeriod.endDate) {
      alert('Выберите период для статистики');
      return;
    }

    setLoadingStatistics(true);
    try {
      const response = await axios.get(`${apiUrl}/operators/statistics`, {
        params: {
          startDate: statisticsPeriod.startDate,
          endDate: statisticsPeriod.endDate,
        },
        headers: getAuthHeaders(),
      });
      setStatistics(response.data.statistics);
      setShowStatistics(true);
    } catch (error: any) {
      console.error('Error loading statistics:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Ошибка загрузки статистики';
      alert(`Ошибка: ${errorMessage}\n\nПроверьте консоль для подробностей.`);
    } finally {
      setLoadingStatistics(false);
    }
  };

  // Чёрный список
  const loadBlacklist = async () => {
    setLoadingBlacklist(true);
    try {
      const token = localStorage.getItem('operator_token');
      const response = await axios.get(`${apiUrl}/blocked-clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBlockedClients(response.data);
    } catch (error: any) {
      console.error('Error loading blacklist:', error);
      alert(error.response?.data?.message || 'Ошибка загрузки чёрного списка');
    } finally {
      setLoadingBlacklist(false);
    }
  };

  const handleBlockClient = async () => {
    if (!blockPhone.trim()) {
      alert('Введите номер телефона');
      return;
    }
    try {
      const token = localStorage.getItem('operator_token');
      await axios.post(
        `${apiUrl}/blocked-clients/block`,
        {
          phone: blockPhone,
          reason: blockReason || 'Заблокирован оператором',
          clientName: blockClientName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      alert('Клиент заблокирован');
      setBlockPhone('');
      setBlockReason('');
      setBlockClientName('');
      loadBlacklist();
    } catch (error: any) {
      console.error('Error blocking client:', error);
      alert(error.response?.data?.message || 'Ошибка блокировки клиента');
    }
  };

  const handleUnblockClient = async (phone: string) => {
    if (!confirm('Разблокировать этого клиента?')) return;
    try {
      const token = localStorage.getItem('operator_token');
      await axios.delete(`${apiUrl}/blocked-clients/unblock/${encodeURIComponent(phone)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Клиент разблокирован');
      loadBlacklist();
    } catch (error: any) {
      console.error('Error unblocking client:', error);
      alert(error.response?.data?.message || 'Ошибка разблокировки клиента');
    }
  };

  // Быстрая статистика обращений
  const loadQuickStats = async () => {
    if (!quickStatsPeriod.startDate || !quickStatsPeriod.endDate) {
      alert('Выберите период');
      return;
    }
    setLoadingQuickStats(true);
    try {
      const token = localStorage.getItem('operator_token');
      const response = await axios.get(`${apiUrl}/conversations/archived/by-period`, {
        params: {
          startDate: quickStatsPeriod.startDate,
          endDate: quickStatsPeriod.endDate,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const conversations = response.data || [];
      setQuickStats({ total: conversations.length, conversations });
      setShowQuickStats(true);
    } catch (error: any) {
      console.error('Error loading quick stats:', error);
      alert(error.response?.data?.message || 'Ошибка загрузки статистики');
    } finally {
      setLoadingQuickStats(false);
    }
  };


  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>{operatorRole === 'admin' ? 'Админ-панель' : 'Панель супервизора'}</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canViewStatistics && (
            <>
              <button
                onClick={() => {
                  setShowStatistics(!showStatistics);
                  if (!showStatistics && statistics.length === 0) {
                    loadStatistics();
                  }
                }}
                className="btn-secondary"
              >
                {showStatistics ? '📊 Скрыть статистику' : '📊 Статистика'}
              </button>
              <button
                onClick={() => {
                  setShowQuickStats(!showQuickStats);
                  if (!showQuickStats && !quickStats) {
                    loadQuickStats();
                  }
                }}
                className="btn-secondary"
                title="Быстрый просмотр количества обращений за период"
              >
                {showQuickStats ? '📈 Скрыть статистику' : quickStats ? `📈 Обращений: ${quickStats.total}` : '📈 Быстрая статистика'}
              </button>
              <button
                onClick={() => {
                  setShowBlacklist(!showBlacklist);
                  if (!showBlacklist && blockedClients.length === 0) {
                    loadBlacklist();
                  }
                }}
                className="btn-secondary"
              >
                {showBlacklist ? '🚫 Скрыть чёрный список' : '🚫 Чёрный список'}
              </button>
            </>
          )}
          {(operatorRole === 'admin' || operatorRole === 'supervisor') && (
            <button
              onClick={() => {
                setShowAnalytics(!showAnalytics);
                if (!showAnalytics && archivedConversations.length === 0) {
                  // Автоматически выбираем первого оператора если есть
                  if (operatorsForAnalytics.length > 0 && !selectedOperatorId) {
                    setSelectedOperatorId(operatorsForAnalytics[0].operator_id);
                  }
                }
              }}
              className="btn-secondary"
            >
              {showAnalytics ? '📋 Скрыть аналитику' : '📋 Аналитика'}
            </button>
          )}
        </div>
      </div>

      {canViewStatistics && (
        <div className="statistics-section">
          {!showStatistics && (
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => {
                  setShowStatistics(true);
                  if (statistics.length === 0) {
                    loadStatistics();
                  }
                }}
                className="btn-primary"
              >
                📊 Показать статистику
              </button>
            </div>
          )}
          {showStatistics && (
            <>
              <h3>Статистика по операторам</h3>
          <div className="statistics-period">
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Период:</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={statisticsPeriod.startDate}
                  onChange={(e) => setStatisticsPeriod({ ...statisticsPeriod, startDate: e.target.value })}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <span>—</span>
                <input
                  type="date"
                  value={statisticsPeriod.endDate}
                  onChange={(e) => setStatisticsPeriod({ ...statisticsPeriod, endDate: e.target.value })}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button
                  onClick={loadStatistics}
                  className="btn-primary"
                  disabled={loadingStatistics}
                  style={{ padding: '8px 16px' }}
                >
                  {loadingStatistics ? 'Загрузка...' : 'Показать'}
                </button>
              </div>
            </div>
          </div>

          {statistics.length > 0 ? (
            <div className="statistics-table">
              <table>
                <thead>
                  <tr>
                    <th>Оператор</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Обслужено абонентов</th>
                    <th>С оценкой</th>
                    <th>Средняя оценка</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.map((stat) => (
                    <tr key={stat.operator_id}>
                      <td>{stat.name}</td>
                      <td>{stat.email}</td>
                      <td>{getRoleBadge(stat.role)}</td>
                      <td>{stat.total_closed}</td>
                      <td>{stat.total_rated}</td>
                      <td>
                        {stat.average_rating !== null ? (
                          <span className="rating-value">
                            {stat.average_rating.toFixed(1)} ⭐
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">Нет данных за выбранный период</div>
          )}
            </>
          )}
        </div>
      )}

      {(operatorRole === 'admin' || operatorRole === 'supervisor') && showAnalytics && (
        <div className="analytics-section" style={{ marginTop: '30px', marginBottom: '30px' }}>
          <h3>Аналитика: Архивные чаты оператора</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <div className="form-group">
              <label>Оператор:</label>
              <select
                value={selectedOperatorId || ''}
                onChange={(e) => setSelectedOperatorId(Number(e.target.value))}
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' }}
              >
                <option value="">Выберите оператора</option>
                {operatorsForAnalytics.map((op) => (
                  <option key={op.operator_id} value={op.operator_id}>
                    {op.name} ({op.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Период:</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={analyticsPeriod.startDate}
                  onChange={(e) =>
                    setAnalyticsPeriod({ ...analyticsPeriod, startDate: e.target.value })
                  }
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <span>—</span>
                <input
                  type="date"
                  value={analyticsPeriod.endDate}
                  onChange={(e) =>
                    setAnalyticsPeriod({ ...analyticsPeriod, endDate: e.target.value })
                  }
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Участие оператора:</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={includeAssigned}
                    onChange={(e) => setIncludeAssigned(e.target.checked)}
                  />
                  Вёл диалог
                </label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={includeClosedBy}
                    onChange={(e) => setIncludeClosedBy(e.target.checked)}
                  />
                  Закрыл диалог
                </label>
              </div>
            </div>
            <button
              onClick={loadArchivedConversations}
              className="btn-primary"
              disabled={loadingArchived || !selectedOperatorId}
              style={{ padding: '8px 16px' }}
            >
              {loadingArchived ? 'Загрузка...' : 'Показать'}
            </button>
          </div>

          {archivedConversations.length > 0 ? (
            <div className="archived-conversations" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f5f5f5' }}>
                  <tr>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>ID</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Клиент</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Телефон</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Участие</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Закрыт</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedConversations.map((conv) => (
                    <tr
                      key={conv.conversation_id}
                      style={{
                        background: selectedArchivedId === conv.conversation_id ? '#e3f2fd' : undefined,
                      }}
                    >
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{conv.conversation_id}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{conv.client?.name || 'Клиент'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{conv.client?.phone || '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                        {[
                          conv.assigned_operator_id === selectedOperatorId ? 'Вёл' : null,
                          conv.closed_by_operator_id === selectedOperatorId ? 'Закрыл' : null,
                        ]
                          .filter(Boolean)
                          .join(', ') || '-'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                        {conv.closed_at ? formatTime(conv.closed_at) : '-'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                        <button
                          onClick={() => {
                            setSelectedArchivedId(conv.conversation_id);
                            setSelectedConversation(conv);
                            loadConversationMessages(conv.conversation_id);
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          {selectedArchivedId === conv.conversation_id ? '→ Открыт' : 'Просмотр'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : archivedConversations.length === 0 && !loadingArchived && selectedOperatorId ? (
            <div className="empty-state">Нет архивных чатов за выбранный период</div>
          ) : null}

          {selectedConversation && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => {
                setSelectedConversation(null);
                setSelectedArchivedId(null);
                setConversationMessages([]);
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  maxWidth: '800px',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  width: '90%',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3>
                    История диалога #{selectedConversation.conversation_id} - {selectedConversation.client?.name || 'Клиент'}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setSelectedArchivedId(null);
                      setConversationMessages([]);
                    }}
                    style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    ✕ Закрыть
                  </button>
                </div>

                {loadingMessages ? (
                  <div>Загрузка сообщений...</div>
                ) : (
                  <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {conversationMessages.map((msg) => (
                      <div
                        key={msg.message_id}
                        style={{
                          marginBottom: '12px',
                          padding: '8px',
                          background:
                            msg.sender_type === 'operator'
                              ? '#e3f2fd'
                              : msg.sender_type === 'bot'
                              ? '#f3e8ff'
                              : msg.sender_type === 'system'
                              ? '#fff8e1'
                              : '#f5f5f5',
                          borderRadius: '4px',
                          borderLeft:
                            msg.sender_type === 'bot'
                              ? '3px solid #9c27b0'
                              : msg.sender_type === 'system'
                              ? '3px solid #ff9800'
                              : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong>
                            {msg.sender_type === 'operator'
                              ? 'Оператор'
                              : msg.sender_type === 'client'
                              ? selectedConversation.client?.name || 'Клиент'
                              : msg.sender_type === 'bot'
                              ? 'Бот'
                              : 'Система'}
                          </strong>
                          <span style={{ fontSize: '12px', color: '#666' }}>{formatTime(msg.created_at)}</span>
                        </div>
                        <div>{msg.text}</div>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            {msg.attachments.map((att: any, idx: number) => (
                              <div key={idx} style={{ marginTop: '4px' }}>
                                {att.url ? (
                                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                                    📎 {att.filename || 'Вложение'}
                                  </a>
                                ) : (
                                  <span>📎 {att.filename || 'Вложение'}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Быстрая статистика */}
      {showQuickStats && (operatorRole === 'admin' || operatorRole === 'supervisor') && (
        <div className="quick-stats-section" style={{ marginTop: '30px' }}>
          <h3>📈 Быстрая статистика обращений</h3>
          
          {/* Выбор периода */}
          <div style={{ marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label>Период (от):</label>
                <input
                  type="date"
                  value={quickStatsPeriod.startDate}
                  onChange={(e) => setQuickStatsPeriod({ ...quickStatsPeriod, startDate: e.target.value })}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginLeft: '8px' }}
                />
              </div>
              <div>
                <label>Период (до):</label>
                <input
                  type="date"
                  value={quickStatsPeriod.endDate}
                  onChange={(e) => setQuickStatsPeriod({ ...quickStatsPeriod, endDate: e.target.value })}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginLeft: '8px' }}
                />
              </div>
              <button
                onClick={loadQuickStats}
                className="btn-primary"
                disabled={loadingQuickStats}
                style={{ padding: '8px 16px' }}
              >
                {loadingQuickStats ? 'Загрузка...' : 'Показать'}
              </button>
            </div>
          </div>

          {/* Результаты */}
          {quickStats && (
            <div>
              <div style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 'bold', color: '#667eea' }}>
                Всего обращений: {quickStats.total}
              </div>
              {quickStats.conversations.length === 0 ? (
                <div className="empty-state">Нет обращений за выбранный период</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>ID</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Клиент</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Телефон</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Канал</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Оператор</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Закрыт</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Кем закрыт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickStats.conversations.map((conv) => (
                      <tr key={conv.conversation_id}>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{conv.conversation_id}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{conv.client?.name || '-'}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{conv.client?.phone || '-'}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          {conv.department === 'web' ? '🌐 Web' : conv.department === 'mobile' ? '📱 Mobile' : conv.department || '-'}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          {conv.assigned_operator?.name || '-'}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          {conv.closed_at ? new Date(conv.closed_at).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : '-'}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          {conv.closed_by_type === 'client' ? 'Клиент' : conv.closed_by_type === 'operator' ? 'Оператор' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Чёрный список */}
      {showBlacklist && (operatorRole === 'admin' || operatorRole === 'supervisor') && (
        <div className="blacklist-section" style={{ marginTop: '30px' }}>
          <h3>🚫 Чёрный список (заблокированные клиенты)</h3>
          
          {/* Форма блокировки */}
          <div style={{ marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
            <h4>Заблокировать клиента</h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label>Номер телефона (+992...)</label>
                <input
                  type="text"
                  value={blockPhone}
                  onChange={(e) => setBlockPhone(e.target.value)}
                  placeholder="+992987654321"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label>Имя клиента (опционально)</label>
                <input
                  type="text"
                  value={blockClientName}
                  onChange={(e) => setBlockClientName(e.target.value)}
                  placeholder="Имя клиента"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ flex: '2 1 300px' }}>
                <label>Причина блокировки</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Причина блокировки"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <button onClick={handleBlockClient} className="btn-primary" style={{ padding: '8px 16px' }}>
                Заблокировать
              </button>
            </div>
          </div>

          {/* Список заблокированных */}
          <div>
            <button onClick={loadBlacklist} className="btn-secondary" disabled={loadingBlacklist} style={{ marginBottom: '12px' }}>
              {loadingBlacklist ? 'Загрузка...' : '🔄 Обновить список'}
            </button>
            {blockedClients.length === 0 ? (
              <div className="empty-state">Нет заблокированных клиентов</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Телефон</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Имя</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Причина</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Заблокирован</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Кем</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedClients.map((blocked) => (
                    <tr key={blocked.blocked_id}>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>{blocked.phone}</td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>{blocked.name || '-'}</td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>{blocked.reason || '-'}</td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        {new Date(blocked.blocked_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        {blocked.blocked_by_operator?.name || '-'}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <button
                          onClick={() => handleUnblockClient(blocked.phone)}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          Разблокировать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

