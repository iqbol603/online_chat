import React, { useState, useEffect } from 'react';
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
}

const AdminPanel: React.FC<AdminPanelProps> = ({ apiUrl }) => {
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

  useEffect(() => {
    loadOperators();
  }, []);

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

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Управление операторами</h2>
        <button onClick={() => { setShowForm(true); resetForm(); setEditingOperator(null); }} className="btn-primary">
          + Создать оператора
        </button>
      </div>

      {showForm && (
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
    </div>
  );
};

export default AdminPanel;

