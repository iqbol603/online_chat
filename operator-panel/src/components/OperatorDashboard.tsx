import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import AdminPanel from './AdminPanel';
import './OperatorDashboard.css';

interface Operator {
  operator_id: number;
  name: string;
  email: string;
  role: string;
}

interface Message {
  message_id: number;
  conversation_id: number;
  sender_type: 'client' | 'bot' | 'operator' | 'system';
  sender_id?: number;
  text: string;
  created_at: string;
  read_by_operator_at?: string | null;
  read_by_client_at?: string | null;
  attachments?: any[];
}

interface Conversation {
  conversation_id: number;
  client_id: number;
  status: string;
  assigned_operator_id?: number;
  client?: {
    name: string;
    phone: string;
    email?: string;
    channel: string;
  };
  messages?: Message[];
  created_at: string;
  queued_at?: string;
}

interface OperatorDashboardProps {
  operator: Operator;
  onLogout: () => void;
  apiUrl: string;
}

const OperatorDashboard: React.FC<OperatorDashboardProps> = ({ operator, onLogout, apiUrl }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [queuedConversations, setQueuedConversations] = useState<Conversation[]>([]);
  const [activeConversations, setActiveConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'online' | 'away' | 'offline'>('offline');
  const [activeTab, setActiveTab] = useState<'chats' | 'admin'>('chats');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isClientTyping, setIsClientTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  // Refs to avoid stale closures inside socket event handlers
  const selectedConversationRef = useRef<Conversation | null>(null);
  const activeConversationsRef = useRef<Conversation[]>([]);
  const queuedConversationsRef = useRef<Conversation[]>([]);
  const isAdmin = operator.role === 'admin';
  const isSupervisor = operator.role === 'supervisor' || operator.role === 'admin';

  const showNotification = (clientName: string, messageText: string) => {
    // Проверяем поддержку браузерных уведомлений
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`Новое сообщение от ${clientName}`, {
        body: messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
        icon: '/favicon.ico',
        tag: `message-${Date.now()}`,
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // Запрашиваем разрешение
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          showNotification(clientName, messageText);
        }
      });
    }
    
    // Также показываем визуальное уведомление в интерфейсе
    const notificationElement = document.createElement('div');
    notificationElement.className = 'message-notification';
    notificationElement.innerHTML = `
      <div class="notification-content">
        <strong>${clientName}</strong>
        <span>${messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText}</span>
      </div>
    `;
    document.body.appendChild(notificationElement);
    
    // Анимация появления
    setTimeout(() => {
      notificationElement.classList.add('show');
    }, 10);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
      notificationElement.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notificationElement)) {
          document.body.removeChild(notificationElement);
        }
      }, 300);
    }, 5000);
  };

  useEffect(() => {
    // Запрашиваем разрешение на уведомления при загрузке
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Автоматическое определение WebSocket URL
    const getWsUrl = () => {
      const hostname = window.location.hostname;
      // Локально backend на 3060, на сервере backend на https://wifi.babilon-t.tj:3063
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3060';
      }
      return 'wss://wifi.babilon-t.tj:3063';
    };
    
    // Подключение к WebSocket
    const newSocket = io(getWsUrl(), {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      newSocket.emit('operator:register', { operatorId: operator.operator_id });
      setStatus('online');
      updateOperatorStatus('online');
    });

    newSocket.on('conversations:queued', (conversations: Conversation[]) => {
      setQueuedConversations(conversations);
      queuedConversationsRef.current = conversations;
    });

    newSocket.on('conversations:active', (conversations: Conversation[]) => {
      setActiveConversations(conversations);
      activeConversationsRef.current = conversations;
    });

    newSocket.on('conversation:assigned', (conversation: Conversation) => {
      setQueuedConversations((prev) => {
        const next = prev.filter((c) => c.conversation_id !== conversation.conversation_id);
        queuedConversationsRef.current = next;
        return next;
      });
      setActiveConversations((prev) => {
        const next = [...prev, conversation];
        activeConversationsRef.current = next;
        return next;
      });
    });

    newSocket.on('message:new', (message: Message) => {
      // Проверяем, открыт ли этот диалог (через ref, чтобы не ловить stale state)
      const isCurrentConversation =
        selectedConversationRef.current?.conversation_id === message.conversation_id;
      
      // Если это сообщение от клиента и диалог не открыт - показываем уведомление
      if (message.sender_type === 'client' && !isCurrentConversation) {
        // Находим информацию о клиенте из текущих состояний (через refs)
        const conversation =
          activeConversationsRef.current.find((c) => c.conversation_id === message.conversation_id) ||
          queuedConversationsRef.current.find((c) => c.conversation_id === message.conversation_id);
        const clientName = conversation?.client?.name || 'Клиент';
        
        // Показываем уведомление
        showNotification(clientName, message.text);
        
        // Увеличиваем счетчик непрочитанных
        setUnreadCounts((prev) => ({
          ...prev,
          [message.conversation_id]: (prev[message.conversation_id] || 0) + 1,
        }));
      }
      
      // Если диалог открыт - добавляем сообщение в список
      if (isCurrentConversation) {
        setMessages((prev) => {
          // Проверяем, нет ли уже такого сообщения (избегаем дубликатов)
          const exists = prev.some(m => m.message_id === message.message_id);
          if (exists) {
            // Обновляем существующее сообщение (для обновления статуса прочитанности)
            return prev.map(m => m.message_id === message.message_id ? message : m);
          }
          return [...prev, message];
        });
        scrollToBottom();
        
        // Помечаем сообщения клиента как прочитанные оператором
        if (message.sender_type === 'client' && !message.read_by_operator_at) {
          axios.patch(`${apiUrl}/messages/${message.message_id}/read-operator`).catch(console.error);
        }
      }
    });

    newSocket.on('message:updated', (message: Message) => {
      // Автоматическое обновление статуса прочитанности
      setMessages((prev) => {
        return prev.map(m => m.message_id === message.message_id ? message : m);
      });
    });

    newSocket.on('message:sent', (message: Message) => {
      // Обработка подтверждения отправки (для обратной совместимости)
      setMessages((prev) => {
        const exists = prev.some(m => m.message_id === message.message_id);
        if (exists) return prev;
        return [...prev, message];
      });
      scrollToBottom();
    });

    newSocket.on('messages:history', (msgs: Message[]) => {
      setMessages(msgs);
      scrollToBottom();
    });

    newSocket.on('typing:start', (data: { conversationId: number; name?: string }) => {
      if (selectedConversationRef.current && selectedConversationRef.current.conversation_id === data.conversationId) {
        setIsClientTyping(true);
      }
    });

    newSocket.on('typing:stop', (data: { conversationId: number }) => {
      if (selectedConversationRef.current && selectedConversationRef.current.conversation_id === data.conversationId) {
        setIsClientTyping(false);
      }
    });

    setSocket(newSocket);

    // Загрузка данных
    loadQueuedConversations();
    loadActiveConversations();

    return () => {
      newSocket.close();
      updateOperatorStatus('offline');
    };
  }, [operator.operator_id, apiUrl]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isClientTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadQueuedConversations = async () => {
    try {
      const response = await axios.get(`${apiUrl}/conversations/status/queued`);
      setQueuedConversations(response.data);
      queuedConversationsRef.current = response.data;
    } catch (error) {
      console.error('Error loading queued conversations:', error);
    }
  };

  const loadActiveConversations = async () => {
    try {
      // Supervisor/Admin видит все диалоги, Operator - только свои
      if (isSupervisor) {
        // Загружаем все диалоги для супервизора/админа
        const response = await axios.get(`${apiUrl}/conversations/status/in_progress`);
        const filtered = response.data.filter(
          (c: Conversation) => c.status === 'in_progress'
        );
        setActiveConversations(filtered);
        activeConversationsRef.current = filtered;
      } else {
        // Для обычного оператора - только свои диалоги
        const response = await axios.get(`${apiUrl}/conversations/status/in_progress`);
        const filtered = response.data.filter(
          (c: Conversation) => c.status === 'in_progress' && c.assigned_operator_id === operator.operator_id
        );
        setActiveConversations(filtered);
        activeConversationsRef.current = filtered;
      }
    } catch (error) {
      console.error('Error loading active conversations:', error);
    }
  };

  const updateOperatorStatus = async (newStatus: 'online' | 'away' | 'offline') => {
    try {
      await axios.patch(`${apiUrl}/operators/${operator.operator_id}/status`, { status: newStatus });
      setStatus(newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAcceptConversation = async (conversationId: number) => {
    if (!socket) return;

    socket.emit('operator:accept', { conversationId });
    
    // Загружаем полную информацию о диалоге
    try {
      const response = await axios.get(`${apiUrl}/conversations/${conversationId}`);
      setSelectedConversation(response.data);
      selectedConversationRef.current = response.data;
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    selectedConversationRef.current = conversation;
    setIsClientTyping(false);
    // Сбрасываем счетчик непрочитанных для этого диалога
    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[conversation.conversation_id];
      return newCounts;
    });
    try {
      const response = await axios.get(`${apiUrl}/messages/conversation/${conversation.conversation_id}`);
      setMessages(response.data);
      // Помечаем как прочитанное
      await axios.patch(`${apiUrl}/messages/conversation/${conversation.conversation_id}/read-operator`);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !socket || !selectedConversation) return;

    socket.emit('operator:message:send', {
      conversationId: selectedConversation.conversation_id,
      text: inputText.trim(),
    });

    // Останавливаем typing при отправке
    socket.emit('operator:typing:stop', { conversationId: selectedConversation.conversation_id });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setInputText('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    // Отправляем typing:start при начале ввода
    if (socket && selectedConversation && selectedConversation.status === 'in_progress') {
      socket.emit('operator:typing:start', { conversationId: selectedConversation.conversation_id });
      
      // Очищаем предыдущий таймер
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Отправляем typing:stop через 2 секунды бездействия
      typingTimeoutRef.current = setTimeout(() => {
        if (socket && selectedConversation) {
          socket.emit('operator:typing:stop', { conversationId: selectedConversation.conversation_id });
        }
      }, 2000);
    }
  };

  const handleCloseConversation = async () => {
    if (!socket || !selectedConversation) return;

    socket.emit('operator:close', { conversationId: selectedConversation.conversation_id });
    
    setActiveConversations((prev) => {
      const filtered = prev.filter((c) => c.conversation_id !== selectedConversation.conversation_id);
      activeConversationsRef.current = filtered;
      return filtered;
    });
    setSelectedConversation(null);
    selectedConversationRef.current = null;
    setMessages([]);
  };

  const handleReassignConversation = async (conversationId: number) => {
    if (!isSupervisor) return;
    
    try {
      // Загружаем список операторов для выбора
      const operatorsResponse = await axios.get(`${apiUrl}/operators`);
      const operators = operatorsResponse.data.filter((op: any) => 
        op.role !== 'admin' && op.operator_id !== operator.operator_id
      );
      
      if (operators.length === 0) {
        alert('Нет доступных операторов для переназначения');
        return;
      }
      
      const operatorList = operators.map((op: any, idx: number) => 
        `${idx + 1}. ${op.name} (${op.email})`
      ).join('\n');
      
      const selected = prompt(`Выберите оператора (введите номер 1-${operators.length}):\n\n${operatorList}`);
      
      if (selected) {
        const operatorIndex = parseInt(selected) - 1;
        if (operatorIndex >= 0 && operatorIndex < operators.length) {
          const newOperatorId = operators[operatorIndex].operator_id;
          
          await axios.patch(`${apiUrl}/conversations/${conversationId}/reassign`, {
            operatorId: newOperatorId
          });
          
          alert(`Диалог переназначен оператору ${operators[operatorIndex].name}`);
          loadActiveConversations();
          
          // Обновляем выбранный диалог
          const response = await axios.get(`${apiUrl}/conversations/${conversationId}`);
          setSelectedConversation(response.data);
        } else {
          alert('Неверный номер оператора');
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Ошибка при переназначении');
      console.error('Error reassigning conversation:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getWaitingTime = (queuedAt?: string) => {
    if (!queuedAt) return '0 мин';
    const diff = Date.now() - new Date(queuedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    return `${minutes} мин`;
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Операторский кабинет</h1>
          <div className="operator-info">
            <span>{operator.name}</span>
            <span className={`status-badge status-${status}`}>{status === 'online' ? 'Онлайн' : status === 'away' ? 'Отошёл' : 'Офлайн'}</span>
          </div>
        </div>
        <div className="header-right">
          <select
            value={status}
            onChange={(e) => updateOperatorStatus(e.target.value as 'online' | 'away' | 'offline')}
            className="status-select"
          >
            <option value="online">Онлайн</option>
            <option value="away">Отошёл</option>
            <option value="offline">Офлайн</option>
          </select>
          <button onClick={onLogout} className="logout-button">
            Выйти
          </button>
        </div>
      </header>

      {isAdmin && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            💬 Чаты
          </button>
          <button
            className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            ⚙️ Управление операторами
          </button>
        </div>
      )}

      {activeTab === 'admin' && isAdmin ? (
        <AdminPanel apiUrl={apiUrl} />
      ) : (
        <div className="dashboard-content">
        <div className="conversations-sidebar">
          <div className="sidebar-section">
            <h2>Очередь ({queuedConversations.length})</h2>
            <div className="conversation-list">
              {queuedConversations.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className="conversation-item queued"
                  onClick={() => handleAcceptConversation(conv.conversation_id)}
                >
                  <div className="conversation-header">
                    <strong>{conv.client?.name || 'Клиент'}</strong>
                    <span className="waiting-time">{getWaitingTime(conv.queued_at)}</span>
                  </div>
                  <div className="conversation-meta">
                    <span>{conv.client?.phone}</span>
                    <span className="channel-badge">{conv.client?.channel}</span>
                  </div>
                </div>
              ))}
              {queuedConversations.length === 0 && (
                <div className="empty-state">Нет диалогов в очереди</div>
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h2>Активные ({activeConversations.length})</h2>
            <div className="conversation-list">
              {activeConversations.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className={`conversation-item ${selectedConversation?.conversation_id === conv.conversation_id ? 'active' : ''} ${unreadCounts[conv.conversation_id] ? 'has-unread' : ''}`}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <div className="conversation-header">
                    <strong>{conv.client?.name || 'Клиент'}</strong>
                    <div className="conversation-badges">
                      {unreadCounts[conv.conversation_id] > 0 && (
                        <span className="unread-badge">{unreadCounts[conv.conversation_id]}</span>
                      )}
                      {isSupervisor && conv.assigned_operator_id && conv.assigned_operator_id !== operator.operator_id && (
                        <span className="other-operator-badge">Другой оператор</span>
                      )}
                    </div>
                  </div>
                  <div className="conversation-meta">
                    <span>{conv.client?.phone}</span>
                    <span className="channel-badge">{conv.client?.channel}</span>
                  </div>
                </div>
              ))}
              {activeConversations.length === 0 && (
                <div className="empty-state">Нет активных диалогов</div>
              )}
            </div>
          </div>
        </div>

        <div className="chat-area">
          {selectedConversation ? (
            <>
              <div className="chat-header">
                <div className="chat-client-info">
                  <h3>{selectedConversation.client?.name || 'Клиент'}</h3>
                  <div className="client-details">
                    <span>📞 {selectedConversation.client?.phone}</span>
                    {selectedConversation.client?.email && (
                      <span>📧 {selectedConversation.client.email}</span>
                    )}
                    <span className="channel-badge">{selectedConversation.client?.channel}</span>
                  </div>
                </div>
                <div className="chat-header-actions">
                  {isSupervisor && selectedConversation && (
                    <button 
                      onClick={() => handleReassignConversation(selectedConversation.conversation_id)}
                      className="reassign-button"
                      title="Переназначить диалог"
                    >
                      🔄 Переназначить
                    </button>
                  )}
                  <button onClick={handleCloseConversation} className="close-chat-button">
                    Закрыть диалог
                  </button>
                </div>
              </div>

              <div className="messages-container">
                {messages.map((message) => (
                  <div
                    key={message.message_id}
                    className={`message ${message.sender_type === 'operator' ? 'message-operator' : 'message-client'}`}
                  >
                    <div className="message-header">
                      <span className="message-sender">
                        {message.sender_type === 'operator'
                          ? 'Вы'
                          : message.sender_type === 'client'
                          ? selectedConversation.client?.name || 'Клиент'
                          : message.sender_type === 'bot'
                          ? 'Бот'
                          : 'Система'}
                      </span>
                      <span className="message-time">{formatTime(message.created_at)}</span>
                    </div>
                    <div className="message-text">{message.text}</div>
                    {message.sender_type === 'operator' && (
                      <div className="message-status">
                        <span className={`message-read-status ${message.read_by_client_at ? 'read' : ''}`}>
                          {message.read_by_client_at ? '✓✓' : '✓'}
                        </span>
                      </div>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="message-attachments">
                        {message.attachments.map((attachment: any, idx: number) => {
                          // Если это кнопки (от бота)
                          if (attachment.buttons) {
                            return (
                              <div key={idx} className="message-buttons">
                                {attachment.buttons.map((btn: string, btnIdx: number) => (
                                  <button
                                    key={btnIdx}
                                    className="message-button"
                                    onClick={() => {
                                      if (socket && selectedConversation) {
                                        socket.emit('operator:message:send', {
                                          conversationId: selectedConversation.conversation_id,
                                          text: btn,
                                        });
                                      }
                                    }}
                                  >
                                    {btn}
                                  </button>
                                ))}
                              </div>
                            );
                          }
                          // Если это изображение
                          if (attachment.type === 'image' || attachment.mimetype?.startsWith('image/')) {
                            const imageUrl = attachment.url.startsWith('http') 
                              ? attachment.url 
                              : `${apiUrl.replace('/api', '')}${attachment.url}`;
                            return (
                              <div key={idx} className="message-image">
                                <img 
                                  src={imageUrl}
                                  alt={attachment.filename || 'Изображение'}
                                  onClick={() => {
                                    window.open(imageUrl, '_blank');
                                  }}
                                />
                                {attachment.filename && (
                                  <span className="image-filename">{attachment.filename}</span>
                                )}
                              </div>
                            );
                          }
                          // Если это обычный файл
                          const fileUrl = attachment.url.startsWith('http')
                            ? attachment.url
                            : `${apiUrl.replace('/api', '')}${attachment.url}`;
                          return (
                            <div key={idx} className="message-file">
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="file-link"
                              >
                                📎 {attachment.filename || 'Файл'}
                                {attachment.size && (
                                  <span className="file-size">
                                    {' '}({(attachment.size / 1024).toFixed(1)} KB)
                                  </span>
                                )}
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {isClientTyping && (
                  <div className="typing-indicator">
                    <span className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                    <span className="typing-text">{selectedConversation.client?.name || 'Клиент'} набирает сообщение...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                      // Останавливаем typing при отправке
                      if (socket && selectedConversation) {
                        socket.emit('operator:typing:stop', { conversationId: selectedConversation.conversation_id });
                        if (typingTimeoutRef.current) {
                          clearTimeout(typingTimeoutRef.current);
                          typingTimeoutRef.current = null;
                        }
                      }
                    }
                  }}
                  placeholder="Введите сообщение..."
                  className="message-input"
                />
                <button onClick={handleSendMessage} disabled={!inputText.trim()} className="send-button">
                  Отправить
                </button>
              </div>
            </>
          ) : (
            <div className="no-conversation-selected">
              <p>Выберите диалог из списка или примите новый из очереди</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default OperatorDashboard;

