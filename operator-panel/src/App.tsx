import { useState, useEffect } from 'react';
import axios from 'axios';
import OperatorDashboard from './components/OperatorDashboard';
import Login from './components/Login';
import './App.css';

// Автоматическое определение API URL на основе текущего хоста
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Локально: backend на 3060, на сервере: https://wifi.babilon-t.tj:3063
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    return 'https://chatbt.babilon-t.com/chat_backend/api';
    // return 'https://wifi.babilon-t.tj:3063/api';
  }
  return 'http://localhost:3000/api';
};

const API_URL = getApiUrl();

interface Operator {
  operator_id: number;
  name: string;
  email: string;
  role: string;
}

function App() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем сохраненный токен
    const savedToken = localStorage.getItem('operator_token');
    const savedOperator = localStorage.getItem('operator_data');
    
    if (savedToken && savedOperator) {
      setToken(savedToken);
      setOperator(JSON.parse(savedOperator));
      // Устанавливаем токен для axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }
  }, []);

  const handleLogin = (operatorData: Operator, accessToken: string) => {
    setOperator(operatorData);
    setToken(accessToken);
    localStorage.setItem('operator_token', accessToken);
    localStorage.setItem('operator_data', JSON.stringify(operatorData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  };

  const handleLogout = () => {
    setOperator(null);
    setToken(null);
    localStorage.removeItem('operator_token');
    localStorage.removeItem('operator_data');
    delete axios.defaults.headers.common['Authorization'];
  };

  if (!operator || !token) {
    return <Login onLogin={handleLogin} apiUrl={API_URL} />;
  }

  return <OperatorDashboard operator={operator} onLogout={handleLogout} apiUrl={API_URL} />;
}

export default App;

