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
    language?: 'ru' | 'tj' | 'en';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(null);
  const [reassigningConversationId, setReassigningConversationId] = useState<number | null>(null);
  // Refs to avoid stale closures inside socket event handlers
  const selectedConversationRef = useRef<Conversation | null>(null);
  const activeConversationsRef = useRef<Conversation[]>([]);
  const queuedConversationsRef = useRef<Conversation[]>([]);
  const isAdmin = operator.role === 'admin';
  const isSupervisor = operator.role === 'supervisor' || operator.role === 'admin';

  const playNotificationSound = () => {
    try {
      // Создаем звук уведомления программно
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Настройки звука (короткий бип)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  const showNotification = (clientName: string, messageText: string) => {
    // Воспроизводим звуковое уведомление
    playNotificationSound();
    
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
        return 'http://localhost:3000';
      }
      return 'wss://wifi.babilon-t.tj:3063';
    };
    
    // Подключение к WebSocket
    const newSocket = io(getWsUrl(), {
      transports: ['websocket', 'polling'], // Fallback на polling если WebSocket не работает
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
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
      console.log('[OperatorDashboard] received conversations:active', conversations.length);
      // Полностью заменяем список активных диалогов (важно для переназначения)
      setActiveConversations(conversations);
      activeConversationsRef.current = conversations;
      
      // Если выбранный диалог больше не в списке активных - закрываем его
      if (selectedConversationRef.current) {
        const stillActive = conversations.some(
          (c) => c.conversation_id === selectedConversationRef.current?.conversation_id
        );
        if (!stillActive) {
          console.log('[OperatorDashboard] selected conversation no longer active, closing');
          setSelectedConversation(null);
          selectedConversationRef.current = null;
          setMessages([]);
        }
      }
    });

    newSocket.on('conversation:assigned', (conversation: Conversation) => {
      console.log('[OperatorDashboard] received conversation:assigned', conversation.conversation_id);
      
      // Удаляем из очереди если был там
      setQueuedConversations((prev) => {
        const next = prev.filter((c) => c.conversation_id !== conversation.conversation_id);
        queuedConversationsRef.current = next;
        return next;
      });
      
      // Добавляем в активные (избегаем дубликатов)
      setActiveConversations((prev) => {
        const exists = prev.some((c) => c.conversation_id === conversation.conversation_id);
        if (exists) {
          // Обновляем существующий
          const next = prev.map((c) =>
            c.conversation_id === conversation.conversation_id ? conversation : c
          );
          activeConversationsRef.current = next;
          return next;
        } else {
          // Добавляем новый
          const next = [...prev, conversation];
          activeConversationsRef.current = next;
          return next;
        }
      });
      
      // Автоматически выбираем переназначенный диалог у нового оператора
      setSelectedConversation(conversation);
      selectedConversationRef.current = conversation;

      // Явное уведомление оператору, что диалог ему передан / он присоединился
      const clientNameForAssign =
        (conversation.client && (conversation.client as any).name) ||
        'Клиент';
      const notifyTextAssign = `Диалог клиента ${clientNameForAssign} назначен вам`;
      showNotification(clientNameForAssign, notifyTextAssign);
      
      // Загружаем историю сообщений для переназначенного диалога
      axios
        .get(`${apiUrl}/messages/conversation/${conversation.conversation_id}`)
        .then((response) => {
          setMessages(response.data);
          scrollToBottom();
          // Помечаем как прочитанное
          axios
            .patch(`${apiUrl}/messages/conversation/${conversation.conversation_id}/read-operator`)
            .catch(console.error);
        })
        .catch((error) => {
          console.error('Error loading messages for reassigned conversation:', error);
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

    newSocket.on('conversation:closed', (conversation: Conversation) => {
      console.log('[OperatorDashboard] received conversation:closed', conversation.conversation_id);

      // Показываем явное уведомление, кто закрыл диалог
      const clientNameForClose =
        (conversation.client && (conversation.client as any).name) ||
        (selectedConversationRef.current?.client as any)?.name ||
        'Клиент';
      const notificationText = `Диалог закрыт клиентом ${clientNameForClose}`;
      showNotification(clientNameForClose, notificationText);

      // Удаляем диалог из активных
      setActiveConversations((prev) => {
        const next = prev.filter(
          (c) => c.conversation_id !== conversation.conversation_id
        );
        activeConversationsRef.current = next;
        return next;
      });

      // Если сейчас открыт этот диалог - закрываем его во UI
      if (selectedConversationRef.current?.conversation_id === conversation.conversation_id) {
        setSelectedConversation(null);
        selectedConversationRef.current = null;
        setMessages([]);
      }
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
      
      // Помечаем все сообщения как прочитанные оператором
      await axios.patch(`${apiUrl}/messages/conversation/${conversationId}/read-operator`);
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

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedFile) || !socket || !selectedConversation) return;

    let attachments: any[] = [];

    // Если есть выбранный файл, загружаем его
    if (selectedFile) {
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await axios.post(`${apiUrl}/messages/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        attachments = [{
          type: response.data.type,
          url: response.data.url,
          filename: response.data.filename,
          size: response.data.size,
          mimetype: response.data.mimetype,
        }];

        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Ошибка при загрузке файла');
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    socket.emit('operator:message:send', {
      conversationId: selectedConversation.conversation_id,
      text: inputText.trim() || (selectedFile ? `📎 ${selectedFile.name}` : ''),
      attachments: attachments.length > 0 ? attachments : undefined,
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

  const canCurrentOperatorReassign = (conversation?: Conversation | null) => {
    if (!conversation) return false;
    if (isSupervisor) return true;
    // Обычный оператор может переназначать только свои активные диалоги
    return conversation.assigned_operator_id === operator.operator_id;
  };

  const handleReassignConversation = async (conversationId: number) => {
    if (!canCurrentOperatorReassign(selectedConversation)) {
      alert('Вы можете переназначать только диалоги, назначенные на вас');
      return;
    }
    
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
      
      setAvailableOperators(operators);
      setReassigningConversationId(conversationId);
      setSelectedOperatorId(null);
      setShowReassignModal(true);
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Ошибка при загрузке операторов');
      console.error('Error loading operators:', error);
    }
  };

  const handleConfirmReassign = async () => {
    if (!reassigningConversationId || !selectedOperatorId) {
      alert('Выберите оператора');
      return;
    }
    
    try {
      await axios.patch(`${apiUrl}/conversations/${reassigningConversationId}/reassign`, {
        operatorId: selectedOperatorId
      });
      
      const selectedOperator = availableOperators.find(op => op.operator_id === selectedOperatorId);
      alert(`Диалог переназначен оператору ${selectedOperator?.name || 'оператору'}`);
      
      setShowReassignModal(false);
      setReassigningConversationId(null);
      setSelectedOperatorId(null);
      loadActiveConversations();
      
      // Обновляем выбранный диалог
      if (reassigningConversationId) {
        const response = await axios.get(`${apiUrl}/conversations/${reassigningConversationId}`);
        setSelectedConversation(response.data);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Ошибка при переназначении');
      console.error('Error reassigning conversation:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    // Отображаем время в часовом поясе Душанбе (+5)
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dushanbe',
      }).format(date);
    } catch {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
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

      {(isAdmin || isSupervisor) && (
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
            {isAdmin ? '⚙️ Управление операторами' : '📊 Статистика'}
          </button>
        </div>
      )}

      {activeTab === 'admin' && (isAdmin || isSupervisor) ? (
        <AdminPanel apiUrl={apiUrl} operatorRole={operator.role as 'operator' | 'supervisor' | 'admin'} />
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
                  {selectedConversation && canCurrentOperatorReassign(selectedConversation) && (
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
                          ? (selectedConversation.client?.language === 'en' 
                              ? 'Online Assistant' 
                              : selectedConversation.client?.language === 'tj' 
                              ? 'Ёрдамчии онлайн' 
                              : 'Онлайн помощник')
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
                  type="file"
                  ref={fileInputRef}
                  className="file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 10 * 1024 * 1024) {
                      alert('Файл слишком большой. Максимальный размер 10MB');
                      e.target.value = '';
                      return;
                    }
                    setSelectedFile(file);
                  }}
                />
                {selectedFile && (
                  <div className="selected-file-info">
                    📎 {selectedFile.name}{' '}
                    <button
                      type="button"
                      className="clear-file-button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
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
                <button
                  onClick={handleSendMessage}
                  disabled={uploadingFile || (!inputText.trim() && !selectedFile)}
                  className="send-button"
                >
                  {uploadingFile ? 'Отправка...' : 'Отправить'}
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

      {/* Модальное окно для переназначения оператора */}
      {showReassignModal && (
        <div className="modal-overlay" onClick={() => setShowReassignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Переназначить диалог</h3>
              <button className="modal-close" onClick={() => setShowReassignModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Выберите оператора для переназначения:</p>
              <div className="operator-list">
                {availableOperators.map((op) => (
                  <label key={op.operator_id} className="operator-option">
                    <input
                      type="radio"
                      name="operator"
                      value={op.operator_id}
                      checked={selectedOperatorId === op.operator_id}
                      onChange={() => setSelectedOperatorId(op.operator_id)}
                    />
                    <span>{op.name} ({op.email})</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowReassignModal(false)}>
                Отмена
              </button>
              <button 
                className="modal-confirm" 
                onClick={handleConfirmReassign}
                disabled={!selectedOperatorId}
              >
                Переназначить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorDashboard;

