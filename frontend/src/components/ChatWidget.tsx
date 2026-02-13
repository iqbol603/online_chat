import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import './ChatWidget.css';

// Автоматическое определение API URL на основе текущего хоста
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Проверка параметра URL для явного указания локального режима
    const urlParams = new URLSearchParams(window.location.search);
    const forceLocal = urlParams.get('local') === 'true' || urlParams.get('local') === '1';
    
    const hostname = window.location.hostname;
    
    // Проверка на локальный режим (localhost, 127.0.0.1, локальные IP)
    const isLocal = 
      forceLocal ||
      hostname === 'localhost' || 
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      (hostname.startsWith('172.') && 
       parseInt(hostname.split('.')[1] || '0') >= 16 && 
       parseInt(hostname.split('.')[1] || '0') <= 31);
    
    // Локально: backend на 3060, на сервере: https://wifi.babilon-t.tj:3063
    if (isLocal) {
      // Если фронтенд на другом порту (например, 3001), используем localhost:3060
      return 'http://localhost:3000/api';
    }
    return 'https://wifi.babilon-t.tj:3063/api';
  }
  return 'http://localhost:3000/api';
};

const getWsUrl = () => {
  if (typeof window !== 'undefined') {
    // Проверка параметра URL для явного указания локального режима
    const urlParams = new URLSearchParams(window.location.search);
    const forceLocal = urlParams.get('local') === 'true' || urlParams.get('local') === '1';
    
    const hostname = window.location.hostname;
    
    // Проверка на локальный режим (localhost, 127.0.0.1, локальные IP)
    const isLocal = 
      forceLocal ||
      hostname === 'localhost' || 
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      (hostname.startsWith('172.') && 
       parseInt(hostname.split('.')[1] || '0') >= 16 && 
       parseInt(hostname.split('.')[1] || '0') <= 31);
    
    if (isLocal) {
      return 'http://localhost:3000';
    }
    // WebSocket для https-домена
    return 'wss://wifi.babilon-t.tj:3063';
  }
  return 'http://localhost:3000';
};

const API_URL = getApiUrl();
const WS_URL = getWsUrl();

interface Message {
  message_id: number;
  conversation_id?: number;
  sender_type: 'client' | 'bot' | 'operator' | 'system';
  text: string;
  created_at: string;
  attachments?: any[];
  read_by_operator_at?: string | null;
  read_by_client_at?: string | null;
}

interface Conversation {
  conversation_id: number;
  status: string;
  client_id: number;
  rating?: number | null;
  rating_comment?: string | null;
}

interface Client {
  client_id: number;
  name: string;
  phone: string;
  email: string;
  language: 'ru' | 'tj' | 'en';
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isOperatorTyping, setIsOperatorTyping] = useState(false);
  const [operatorTypingName, setOperatorTypingName] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    language: 'ru' as 'ru' | 'tj' | 'en',
    channel: 'web' as 'web' | 'mobile',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const conversationClosedRef = useRef(false);

  useEffect(() => {
    // Проверяем сохраненные данные в localStorage
    const savedClientId = localStorage.getItem('clientId');
    const savedConversationId = localStorage.getItem('conversationId');

    if (savedClientId && savedConversationId) {
      loadConversation(parseInt(savedClientId), parseInt(savedConversationId));
    }
  }, []);

  useEffect(() => {
    // Сбрасываем флаг закрытия при открытии нового чата
    if (isOpen && client && conversation) {
      conversationClosedRef.current = false;
    }
    
    if (isOpen && client && conversation) {
      const newSocket = io(WS_URL, {
        transports: ['websocket', 'polling'], // Fallback на polling если WebSocket не работает
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        newSocket.emit('client:register', {
          clientId: client.client_id,
          conversationId: conversation.conversation_id,
        });
      });

      newSocket.on('messages:history', (msgs: Message[]) => {
        setMessages(msgs);
      });

      newSocket.on('messages:update', (msgs: Message[]) => {
        setMessages(msgs);
      });

      newSocket.on('message:new', (message: Message) => {
        setMessages((prev) => {
          // Проверяем, нет ли уже такого сообщения (избегаем дубликатов)
          const exists = prev.some(m => m.message_id === message.message_id);
          if (exists) {
            // Обновляем существующее сообщение (для обновления статуса прочитанности)
            return prev.map(m => m.message_id === message.message_id ? message : m);
          }
          return [...prev, message];
        });
        
        // Если это системное сообщение о закрытии диалога, обновляем статус
        if (message.sender_type === 'system' && message.text.includes('закрыт')) {
          setConversation((prevConv) => {
            if (prevConv && prevConv.conversation_id === message.conversation_id && prevConv.status !== 'closed') {
              conversationClosedRef.current = true;
              return { ...prevConv, status: 'closed' };
            }
            return prevConv;
          });
        }
        
        // Помечаем сообщения оператора как прочитанные клиентом
        if (message.sender_type === 'operator' && !message.read_by_client_at) {
          axios.patch(`${API_URL}/messages/${message.message_id}/read-client`).catch(console.error);
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
      });

      newSocket.on('conversation:status', (data: { status: string }) => {
        if (conversation) {
          setConversation({ ...conversation, status: data.status });
        }
      });

      newSocket.on('typing:start', (data: { conversationId: number; name: string }) => {
        if (conversation && conversation.conversation_id === data.conversationId) {
          setIsOperatorTyping(true);
          setOperatorTypingName(data.name);
        }
      });

      newSocket.on('typing:stop', (data: { conversationId: number }) => {
        if (conversation && conversation.conversation_id === data.conversationId) {
          setIsOperatorTyping(false);
          setOperatorTypingName('');
        }
      });

      newSocket.on('conversation:closed', (data: { conversationId: number } | Conversation) => {
        // Обрабатываем как объект с conversationId, так и полный объект Conversation
        const conversationId = 'conversationId' in data ? data.conversationId : (data as Conversation).conversation_id;
        
        // Защита от повторных вызовов
        if (conversationClosedRef.current) {
          return;
        }
        conversationClosedRef.current = true;
        
        // Обновляем состояние
        setConversation((prevConv) => {
          if (prevConv && prevConv.conversation_id === conversationId && prevConv.status !== 'closed') {
            // Сохраняем информацию о необходимости показа формы оценки
            const shouldShowRating = !prevConv.rating;
            
            // Показываем форму оценки асинхронно, чтобы не блокировать обновление состояния
            if (shouldShowRating) {
              setTimeout(() => {
                setRatingSubmitted((currentRatingSubmitted) => {
                  if (!currentRatingSubmitted) {
                    setShowRating(true);
                  }
                  return currentRatingSubmitted;
                });
              }, 100);
            }
            
            return { ...prevConv, status: 'closed' };
          }
          return prevConv;
        });
        
        // Обновляем другие состояния
        setIsOperatorTyping(false);
        setOperatorTypingName('');
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [isOpen, client, conversation]);

  useEffect(() => {
    // Если диалог уже закрыт (например, после перезагрузки), показываем оценку
    if (isOpen && isRegistered && conversation?.status === 'closed' && !ratingSubmitted && !conversation.rating) {
      setShowRating(true);
    }
  }, [isOpen, isRegistered, conversation?.status]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOperatorTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async (clientId: number, conversationId: number) => {
    try {
      const response = await axios.get(`${API_URL}/chat/conversation/${conversationId}`);
      const conv = response.data.conversation as Conversation;
      // Если диалог уже закрыт, не блокируем пользователя в закрытом чате
      if (conv.status === 'closed') {
        localStorage.removeItem('clientId');
        localStorage.removeItem('conversationId');
        setClient(null);
        setConversation(null);
        setMessages([]);
        setIsRegistered(false);
        setShowRating(false);
        setRatingSubmitted(false);
      } else {
        setClient({ client_id: clientId } as Client);
        setConversation(conv);
        setMessages(response.data.messages);
        setIsRegistered(true);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      localStorage.removeItem('clientId');
      localStorage.removeItem('conversationId');
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.name.length < 2) {
      errors.name = 'Имя должно содержать минимум 2 символа';
    }

    const digits = formData.phone.replace(/\D/g, '');
    if (digits.length !== 9) {
      errors.phone = 'Введите ровно 9 цифр номера после +992';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartChat = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // Формируем полный номер в формате +992xxxxxxxxx
      const phone = `+992${formData.phone.replace(/\D/g, '').slice(0, 9)}`;

      const response = await axios.post(`${API_URL}/chat/start`, {
        ...formData,
        phone,
      });

      setClient(response.data.client);
      setConversation(response.data.conversation);
      setMessages(response.data.messages);
      setIsRegistered(true);

      // Сохраняем в localStorage
      localStorage.setItem('clientId', response.data.client.client_id.toString());
      localStorage.setItem('conversationId', response.data.conversation.conversation_id.toString());
    } catch (error: any) {
      console.error('Error starting chat:', error);
      alert(error.response?.data?.message || 'Ошибка при запуске чата');
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedFile) || !socket || !conversation) return;
    if (conversation.status === 'closed') return;

    let attachments: any[] = [];

    // Если есть выбранный файл, загружаем его
    if (selectedFile) {
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await axios.post(`${API_URL}/messages/upload`, formData, {
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

    socket.emit('message:send', {
      conversationId: conversation.conversation_id,
      text: inputText.trim() || (selectedFile ? `📎 ${selectedFile.name}` : ''),
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // Останавливаем typing при отправке
    socket.emit('client:typing:stop', { conversationId: conversation.conversation_id });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setInputText('');
  };

  const handleCloseConversation = () => {
    if (!socket || !conversation || conversation.status === 'closed' || conversationClosedRef.current) {
      return;
    }
    
    // Предотвращаем повторные вызовы
    conversationClosedRef.current = true;
    
    // Сохраняем информацию о необходимости показа формы оценки
    const shouldShowRating = !conversation.rating;
    
    // Оптимистично обновляем UI сразу одним батчем
    setConversation((prevConv) => {
      if (prevConv && prevConv.status !== 'closed') {
        return { ...prevConv, status: 'closed' };
      }
      return prevConv;
    });
    
    setIsOperatorTyping(false);
    setOperatorTypingName('');
    
    // Показываем форму оценки асинхронно, если нужно
    if (shouldShowRating) {
      setTimeout(() => {
        setRatingSubmitted((currentRatingSubmitted) => {
          if (!currentRatingSubmitted) {
            setShowRating(true);
          }
          return currentRatingSubmitted;
        });
      }, 100);
    }
    
    // Отправляем событие закрытия на сервер (без callback для ускорения)
    try {
      socket.emit('client:close', { conversationId: conversation.conversation_id });
    } catch (error) {
      console.error('Error closing conversation:', error);
      // При ошибке разрешаем повторную попытку
      conversationClosedRef.current = false;
    }
  };

  const handleSubmitRating = async () => {
    if (!client || !conversation) return;
    if (ratingValue < 1 || ratingValue > 5) return;

    try {
      setRatingSubmitting(true);
      await axios.post(`${API_URL}/conversations/${conversation.conversation_id}/rating`, {
        client_id: client.client_id,
        rating: ratingValue,
        comment: ratingComment?.trim() ? ratingComment.trim() : undefined,
      });
      setRatingSubmitted(true);
      setShowRating(false);
      // После оценки разрешаем начать новый диалог
      localStorage.removeItem('clientId');
      localStorage.removeItem('conversationId');
      setClient(null);
      setConversation(null);
      setMessages([]);
      setIsRegistered(false);
      setInputText('');
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      alert(error.response?.data?.message || 'Ошибка при отправке оценки');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Проверяем размер файла (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
      // Останавливаем typing при отправке
      if (socket && conversation) {
        socket.emit('client:typing:stop', { conversationId: conversation.conversation_id });
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    // Отправляем typing:start при начале ввода
    if (socket && conversation && conversation.status === 'in_progress') {
      socket.emit('client:typing:start', { conversationId: conversation.conversation_id });
      
      // Очищаем предыдущий таймер
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Отправляем typing:stop через 2 секунды бездействия
      typingTimeoutRef.current = setTimeout(() => {
        if (socket && conversation) {
          socket.emit('client:typing:stop', { conversationId: conversation.conversation_id });
        }
      }, 2000);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const locale = client?.language === 'en' ? 'en-US' : client?.language === 'tj' ? 'tg-TJ' : 'ru-RU';
    // Сервер уже в Asia/Dushanbe, используем локальное время браузера
    try {
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      // Фолбэк, если вдруг Intl или таймзона недоступны
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getBotName = (language?: 'ru' | 'tj' | 'en') => {
    const lang = language || client?.language || 'ru';
    switch (lang) {
      case 'ru':
        return 'Онлайн помощник';
      case 'tj':
        return 'Ёрдамчии онлайн';
      case 'en':
        return 'Online Assistant';
      default:
        return 'Онлайн помощник';
    }
  };

  return (
    <div className="chat-widget">
      {!isOpen ? (
        <button className="chat-button" onClick={() => setIsOpen(true)}>
          💬 Чат
        </button>
      ) : (
        <div className="chat-container">
          <div className="chat-header">
            <h3>Онлайн-чат</h3>
            <div className="chat-header-actions">
              {isRegistered && conversation && conversation.status !== 'closed' && (
                <button 
                  className="close-conversation-button" 
                  onClick={handleCloseConversation}
                  title="Закрыть диалог"
                >
                  Закрыть диалог
                </button>
              )}
              <button className="close-button" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>
          </div>

          {!isRegistered ? (
            <div className="chat-form">
              <h4>Начните общение</h4>
              <div className="form-group">
                <label>Имя *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ваше имя"
                />
                {formErrors.name && <span className="error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label>Телефон *</label>
                <div className="phone-input-wrapper">
                  <span className="phone-prefix">+992</span>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      // Оставляем только цифры и ограничиваем 9 знаками
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setFormData({ ...formData, phone: digits });
                    }}
                    maxLength={9}
                    placeholder="987654321"
                  />
                </div>
                {formErrors.phone && <span className="error">{formErrors.phone}</span>}
              </div>

              <div className="form-group">
                <label>Язык</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value as 'ru' | 'tj' | 'en' })}
                >
                  <option value="ru">Русский</option>
                  <option value="tj">Тоҷикӣ</option>
                  <option value="en">English</option>
                </select>
              </div>

              <button className="submit-button" onClick={handleStartChat}>
                Начать чат
              </button>
            </div>
          ) : (
            <>
              <div className="chat-messages">
                {messages.map((message) => (
                  <div
                    key={message.message_id}
                    className={`message ${message.sender_type === 'client' ? 'message-client' : 'message-other'}`}
                  >
                    <div className="message-header">
                      <span className="message-sender">
                        {message.sender_type === 'client'
                          ? (client?.language === 'en' ? 'You' : client?.language === 'tj' ? 'Шумо' : 'Вы')
                          : message.sender_type === 'bot'
                          ? getBotName(client?.language)
                          : message.sender_type === 'operator'
                          ? (client?.language === 'en' ? 'Operator' : client?.language === 'tj' ? 'Оператор' : 'Оператор')
                          : (client?.language === 'en' ? 'System' : client?.language === 'tj' ? 'Система' : 'Система')}
                      </span>
                      <span className="message-time">{formatTime(message.created_at)}</span>
                    </div>
                    <div className="message-text">{message.text}</div>
                    {message.sender_type === 'client' && (
                      <div className="message-status">
                        <span className={`message-read-status ${message.read_by_operator_at ? 'read' : ''}`}>
                          {message.read_by_operator_at ? '✓✓' : '✓'}
                        </span>
                      </div>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="message-attachments">
                        {message.attachments.map((attachment: any, idx: number) => {
                          // Если это кнопки
                          if (attachment.buttons) {
                            return (
                              <div key={idx} className="message-buttons">
                                {attachment.buttons.map((btn: string, btnIdx: number) => (
                                  <button
                                    key={btnIdx}
                                    className="message-button"
                                    onClick={() => {
                                      if (socket && conversation) {
                                        socket.emit('message:send', {
                                          conversationId: conversation.conversation_id,
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
                          // Если это файл/изображение
                          if (attachment.type === 'image' || attachment.mimetype?.startsWith('image/')) {
                            const imageUrl = attachment.url.startsWith('http') 
                              ? attachment.url 
                              : `${API_URL.replace('/api', '')}${attachment.url}`;
                            return (
                              <div key={idx} className="message-image">
                                <img 
                                  src={imageUrl}
                                  alt={attachment.filename || 'Изображение'}
                                  onClick={() => {
                                    setSelectedImage(imageUrl);
                                  }}
                                  style={{ cursor: 'pointer', maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                                />
                                {attachment.filename && (
                                  <span className="image-filename">{attachment.filename}</span>
                                )}
                              </div>
                            );
                          }
                          // Если это обычный файл
                          return (
                            <div key={idx} className="message-file">
                              <a
                                href={`${API_URL.replace('/api', '')}${attachment.url}`}
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
                {isOperatorTyping && (
                  <div className="typing-indicator">
                    <span className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                    <span className="typing-text">{operatorTypingName} набирает сообщение...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {showRating && (
                <div className="rating-overlay">
                  <div className="rating-modal">
                    <div className="rating-title">Оцените качество обслуживания</div>
                    <div className="rating-stars">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          className={`rating-star ${ratingValue >= v ? 'active' : ''}`}
                          onClick={() => setRatingValue(v)}
                          disabled={ratingSubmitting}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="rating-comment"
                      placeholder="Комментарий (необязательно)"
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      disabled={ratingSubmitting}
                      maxLength={1000}
                    />
                    <div className="rating-actions">
                      <button
                        type="button"
                        className="rating-skip"
                        onClick={() => {
                          setShowRating(false);
                          // При пропуске тоже даём возможность начать новый чат
                          localStorage.removeItem('clientId');
                          localStorage.removeItem('conversationId');
                          setClient(null);
                          setConversation(null);
                          setMessages([]);
                          setIsRegistered(false);
                          setInputText('');
                          setSelectedFile(null);
                        }}
                        disabled={ratingSubmitting}
                      >
                        Пропустить
                      </button>
                      <button
                        type="button"
                        className="rating-submit"
                        onClick={handleSubmitRating}
                        disabled={ratingSubmitting || ratingValue < 1}
                      >
                        {ratingSubmitting ? 'Отправка...' : 'Отправить'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="chat-input">
                {selectedFile && (
                  <div className="selected-file">
                    <span>📎 {selectedFile.name}</span>
                    <button onClick={handleRemoveFile} className="remove-file-btn">×</button>
                  </div>
                )}
                <div className="input-row">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    disabled={conversation?.status === 'closed' || uploadingFile}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="attach-button"
                    disabled={conversation?.status === 'closed' || uploadingFile}
                    title="Прикрепить файл"
                  >
                    📎
                  </button>
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Введите сообщение..."
                    disabled={conversation?.status === 'closed' || uploadingFile}
                  />
                  <button 
                    onClick={handleSendMessage} 
                    disabled={(!inputText.trim() && !selectedFile) || conversation?.status === 'closed' || uploadingFile}
                  >
                    {uploadingFile ? '⏳' : <span className="send-icon">➤</span>}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Модальное окно для просмотра фото */}
      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-modal-close"
              onClick={() => setSelectedImage(null)}
              title={client?.language === 'en' ? 'Close' : client?.language === 'tj' ? 'Пӯшидан' : 'Закрыть'}
            >
              ✕
            </button>
            <img src={selectedImage} alt={client?.language === 'en' ? 'View image' : client?.language === 'tj' ? 'Намоиши тасвир' : 'Просмотр изображения'} className="image-modal-image" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;

