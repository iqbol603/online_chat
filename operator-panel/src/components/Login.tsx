import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

interface LoginProps {
  onLogin: (operator: any, token: string) => void;
  apiUrl: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, apiUrl }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password,
      });

      onLogin(response.data.operator, response.data.access_token);
    } catch (err: any) {
      let message = 'Ошибка входа. Проверьте email и пароль.';

      if (!err.response) {
        message = `Нет связи с сервером (${apiUrl}). Проверьте, что backend запущен на порту 3060/3063.`;
      } else if (err.response.status === 401) {
        message = 'Неверный email или пароль.';
      } else if (err.response.status >= 500) {
        message = err.response.data?.message
          || 'Ошибка сервера. Проверьте backend/.env и логи (pm2 logs).';
      } else if (err.response.data?.message) {
        message = err.response.data.message;
      }

      console.error('[Login] error:', {
        apiUrl,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Операторский кабинет</h1>
        <p className="login-subtitle">Войдите в систему для работы с чатами</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        
      </div>
    </div>
  );
};

export default Login;


