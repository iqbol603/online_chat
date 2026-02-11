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
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator' as 'operator' | 'supervisor' | 'admin',
    max_active_chats: 5,
  });
  
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
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (operatorRole === 'admin' || operatorRole === 'supervisor') {
      loadOperators();
    }
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
  }, []);

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

  const loadOperators = async () => {
    try {
      const response = await axios.get(`${apiUrl}/operators`);
      setOperators(response.data);
    } catch (error) {
      console.error('Error loading operators:', error);
      alert('Ошибка загрузки операторов');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingOperator) {
        // Редактирование - отправляем только заполненные поля
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          max_active_chats: formData.max_active_chats,
        };
        
        // Пароль добавляем только если он заполнен
        if (formData.password && formData.password.trim() !== '') {
          updateData.password = formData.password;
        }
        
        await axios.patch(`${apiUrl}/operators/${editingOperator.operator_id}`, updateData);
        alert('Оператор обновлен!');
      } else {
        // Создание - все поля обязательны
        await axios.post(`${apiUrl}/operators`, formData);
        const roleName = formData.role === 'admin' ? 'Администратор' : formData.role === 'supervisor' ? 'Супервизор' : 'Оператор';
        alert(`${roleName} успешно создан!`);
      }
      setShowForm(false);
      setEditingOperator(null);
      resetForm();
      loadOperators();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Ошибка при сохранении';
      alert(errorMessage);
      console.error('Error:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (operator: Operator) => {
    setEditingOperator(operator);
    setFormData({
      name: operator.name,
      email: operator.email,
      password: '', // Не заполняем пароль при редактировании
      role: operator.role,
      max_active_chats: operator.max_active_chats,
    });
    setShowForm(true);
  };

  const handleDelete = async (operatorId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого оператора?')) {
      return;
    }

    try {
      await axios.delete(`${apiUrl}/operators/${operatorId}`);
      alert('Оператор удален!');
      loadOperators();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при удалении');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'operator',
      max_active_chats: 5,
    });
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; class: string }> = {
      online: { text: 'Онлайн', class: 'status-online' },
      away: { text: 'Отошёл', class: 'status-away' },
      offline: { text: 'Офлайн', class: 'status-offline' },
    };
    const badge = badges[status] || badges.offline;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

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
            includeAssigned,
            includeClosedBy,
          },
        }
      );
      setArchivedConversations(response.data);
    } catch (error: any) {
      console.error('Error loading archived conversations:', error);
      alert(error.response?.data?.message || 'Ошибка загрузки архивных чатов');
    } finally {
      setLoadingArchived(false);
    }
  };

  const loadConversationMessages = async (conversationId: number) => {
    setLoadingMessages(true);
    try {
      const response = await axios.get(`${apiUrl}/messages/conversation/${conversationId}`);
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


  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>{operatorRole === 'admin' ? 'Управление операторами' : 'Статистика операторов'}</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canViewStatistics && (
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
          )}
          {(operatorRole === 'admin' || operatorRole === 'supervisor') && (
            <>
              <button
                onClick={() => {
                  setShowAnalytics(!showAnalytics);
                  if (!showAnalytics && archivedConversations.length === 0) {
                    // Автоматически выбираем первого оператора если есть
                    if (operators.length > 0 && !selectedOperatorId) {
                      setSelectedOperatorId(operators[0].operator_id);
                    }
                  }
                }}
                className="btn-secondary"
              >
                {showAnalytics ? '📋 Скрыть аналитику' : '📋 Аналитика'}
              </button>
              <button onClick={() => { setShowForm(true); resetForm(); setEditingOperator(null); }} className="btn-primary">
                + Создать оператора
              </button>
            </>
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

      {operatorRole === 'admin' && showForm && (
        <div className="admin-form-modal">
          <div className="admin-form-content">
            <h3>{editingOperator ? 'Редактировать оператора' : 'Создать оператора'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Имя *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading || !!editingOperator}
                />
              </div>

              <div className="form-group">
                <label>Пароль {editingOperator ? '(оставьте пустым, чтобы не менять)' : '*'} </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingOperator}
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label>Роль *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  disabled={loading}
                >
                  <option value="operator">Оператор</option>
                  <option value="supervisor">Супервизор</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>

              <div className="form-group">
                <label>Макс. активных чатов</label>
                <input
                  type="number"
                  value={formData.max_active_chats}
                  onChange={(e) => setFormData({ ...formData, max_active_chats: parseInt(e.target.value) })}
                  min="1"
                  max="20"
                  disabled={loading}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Сохранение...' : editingOperator ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingOperator(null); resetForm(); }}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
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
                {operators.map((op) => (
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
                    <tr key={conv.conversation_id}>
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
                            setSelectedConversation(conv);
                            loadConversationMessages(conv.conversation_id);
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          Просмотр
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
                          background: msg.sender_type === 'operator' ? '#e3f2fd' : '#f5f5f5',
                          borderRadius: '4px',
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

      {operatorRole === 'admin' && (
        <div className="operators-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Макс. чатов</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => (
                <tr key={operator.operator_id}>
                  <td>{operator.operator_id}</td>
                  <td>{operator.name}</td>
                  <td>{operator.email}</td>
                  <td>{getRoleBadge(operator.role)}</td>
                  <td>{getStatusBadge(operator.status_presence)}</td>
                  <td>{operator.max_active_chats}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(operator)}
                      className="btn-edit"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(operator.operator_id)}
                      className="btn-delete"
                      title="Удалить"
                      disabled={operator.role === 'admin'}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {operators.length === 0 && (
            <div className="empty-state">Нет операторов</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

