import { Injectable } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';

interface BotResponse {
  text: string;
  buttons?: string[];
  shouldTransferToOperator?: boolean;
}

@Injectable()
export class BotService {
  private readonly transferKeywords = [
    'оператор',
    'соедини',
    'человек',
    'саппорт',
    'позови оператора',
    'свяжи',
    'помощь оператора',
    'живой человек',
  ];

  private readonly faq: Record<string, { ru: string; tj: string; buttons?: string[] }> = {
    tariffs: {
      ru: 'Наши тарифы:\n• Базовый: 50 Мбит/с - 100 сомони/мес\n• Стандарт: 100 Мбит/с - 150 сомони/мес\n• Премиум: 200 Мбит/с - 250 сомони/мес\n\nХотите узнать больше или подключить?',
      tj: 'Тарифҳои мо:\n• Асосӣ: 50 Мбит/с - 100 сомонӣ/моҳ\n• Стандарт: 100 Мбит/с - 150 сомонӣ/моҳ\n• Премиум: 200 Мбит/с - 250 сомонӣ/моҳ\n\nМехоҳед бештар бидонед ё пайваст кунед?',
      buttons: ['Подключить', 'Соединить с оператором'],
    },
    payment: {
      ru: 'Способы оплаты:\n• Онлайн через мобильное приложение\n• Терминалы оплаты\n• Банковский перевод\n• Наличными в офисе\n\nНужна помощь с оплатой?',
      tj: 'Усулҳои пардохт:\n• Онлайн тавассути барномаи мобилӣ\n• Терминалҳои пардохт\n• Гузарониши бонкӣ\n• Нақд дар офис\n\nКӯмак бо пардохт лозим аст?',
      buttons: ['Соединить с оператором'],
    },
    internet_not_working: {
      ru: 'Проверьте следующее:\n1. Роутер включен и индикаторы горят\n2. Кабель подключен правильно\n3. Перезагрузите роутер (выключите на 30 сек)\n4. Проверьте баланс\n\nЕсли не помогло, опишите проблему подробнее.',
      tj: 'Инро санҷед:\n1. Роутер фаъол аст ва нишондиҳандаҳо мешавананд\n2. Кабел дуруст пайваст аст\n3. Роутерро аз нав оғоз кунед (30 сония хомӯш кунед)\n4. Баллансро санҷед\n\nАгар кӯмак накард, мушкилиро ба тафсилот тавсиф кунед.',
      buttons: ['Не помогло', 'Соединить с оператором'],
    },
    slow_internet: {
      ru: 'Возможные причины медленного интернета:\n• Перегрузка сети в часы пик\n• Проблемы с роутером\n• Много устройств подключено\n• Вирусы на устройстве\n\nПопробуйте перезагрузить роутер. Если не поможет, нужны детали.',
      tj: 'Сабабҳои эҳтимолии интернети суст:\n• Боркашӣ дар соатҳои пик\n• Мушкилоти роутер\n• Бисёр асбобҳо пайваст шудаанд\n• Вирусҳо дар асбоб\n\nРоутерро аз нав оғоз кунед. Агар кӯмак накард, тафсилот лозим аст.',
      buttons: ['Соединить с оператором'],
    },
    connection: {
      ru: 'Для подключения интернета:\n1. Оставьте заявку на сайте\n2. Или позвоните по телефону\n3. Наш специалист приедет в удобное время\n\nХотите оставить заявку?',
      tj: 'Барои пайваст кардани интернет:\n1. Дархостро дар сомона гузоред\n2. Ё ба телефон занг занед\n3. Мутахассиси мо дар вақти мусоид меояд\n\nМехоҳед дархост гузоред?',
      buttons: ['Оставить заявку', 'Соединить с оператором'],
    },
    contacts: {
      ru: 'Наши контакты:\n📞 Телефон: +992 93 123 45 67\n📧 Email: support@example.com\n📍 Адрес: г. Душанбе, ул. Примерная, 123\n\nРаботаем: Пн-Пт 9:00-18:00',
      tj: 'Тамосҳои мо:\n📞 Телефон: +992 93 123 45 67\n📧 Email: support@example.com\n📍 Суроға: Душанбе, кӯчаи Намуна, 123\n\nКор: Душ-Ҷум 9:00-18:00',
      buttons: ['Соединить с оператором'],
    },
  };

  constructor(
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  async processMessage(
    conversationId: number,
    text: string,
    language: 'ru' | 'tj' = 'ru',
  ): Promise<BotResponse> {
    const lowerText = text.toLowerCase().trim();

    // Проверка на запрос оператора
    if (this.shouldTransferToOperator(lowerText)) {
      await this.transferToOperator(conversationId, language);
      return {
        text: language === 'ru'
          ? 'Передаю оператору. Обычно ответ занимает несколько минут. Пожалуйста, оставайтесь в чате.'
          : 'Ба оператор мегузаронам. Одатан ҷавоб чанд дақиқа мегирад. Лутфан дар чат бимонед.',
        shouldTransferToOperator: true,
      };
    }

    // Обработка кнопок
    if (lowerText.includes('интернет не работает') || lowerText.includes('интернет кор намекунад')) {
      return this.getFAQResponse('internet_not_working', language);
    }

    if (lowerText.includes('медленный интернет') || lowerText.includes('интернети суст')) {
      return this.getFAQResponse('slow_internet', language);
    }

    if (lowerText.includes('оплата') || lowerText.includes('пардохт')) {
      return this.getFAQResponse('payment', language);
    }

    if (lowerText.includes('тариф') || lowerText.includes('тарифҳо')) {
      return this.getFAQResponse('tariffs', language);
    }

    if (lowerText.includes('подключ') || lowerText.includes('пайваст')) {
      return this.getFAQResponse('connection', language);
    }

    if (lowerText.includes('контакт') || lowerText.includes('тамос')) {
      return this.getFAQResponse('contacts', language);
    }

    // Если вопрос слишком короткий или непонятный
    if (text.length < 10) {
      return {
        text: language === 'ru'
          ? 'Пожалуйста, опишите ваш вопрос подробнее. Или выберите один из вариантов:'
          : 'Лутфан, саволи худро ба тафсилот тавсиф кунед. Ё яке аз вариантҳоро интихоб кунед:',
        buttons: [
          language === 'ru' ? 'Интернет не работает' : 'Интернет кор намекунад',
          language === 'ru' ? 'Медленный интернет' : 'Интернети суст',
          language === 'ru' ? 'Оплата' : 'Пардохт',
          language === 'ru' ? 'Тарифы' : 'Тарифҳо',
          language === 'ru' ? 'Соединить с оператором' : 'Ба оператор пайваст кардан',
        ],
      };
    }

    // Стандартный ответ
    return {
      text: language === 'ru'
        ? 'Понял ваш вопрос. Давайте уточним детали. Могу помочь с тарифами, оплатой, подключением или техническими проблемами. Что именно вас интересует?'
        : 'Саволро фаҳмидам. Биёед тафсилотро равшан кунем. Метавонам бо тарифҳо, пардохт, пайвасткунӣ ё мушкилоти техникӣ кӯмак кунам. Чӣ шумо мавриди қайд аст?',
      buttons: [
        language === 'ru' ? 'Интернет не работает' : 'Интернет кор намекунад',
        language === 'ru' ? 'Оплата' : 'Пардохт',
        language === 'ru' ? 'Тарифы' : 'Тарифҳо',
        language === 'ru' ? 'Соединить с оператором' : 'Ба оператор пайваст кардан',
      ],
    };
  }

  private shouldTransferToOperator(text: string): boolean {
    return this.transferKeywords.some((keyword) => text.includes(keyword));
  }

  private getFAQResponse(key: string, language: 'ru' | 'tj'): BotResponse {
    const faq = this.faq[key];
    if (!faq) {
      return {
        text: language === 'ru' ? 'Извините, не понял вопрос.' : 'Бубахшед, саволро нафаҳмидам.',
      };
    }

    return {
      text: language === 'ru' ? faq.ru : faq.tj,
      buttons: faq.buttons,
    };
  }

  async transferToOperator(conversationId: number, language: 'ru' | 'tj'): Promise<void> {
    await this.conversationsService.updateStatus(conversationId, 'queued');
    
    const systemMessage = language === 'ru'
      ? 'Диалог передан оператору. Пожалуйста, подождите.'
      : 'Муколама ба оператор супорида шуд. Лутфан интизор шавед.';

    await this.messagesService.create({
      conversation_id: conversationId,
      sender_type: 'system',
      text: systemMessage,
    });
  }

  async sendBotMessage(conversationId: number, text: string, buttons?: string[]): Promise<void> {
    await this.messagesService.create({
      conversation_id: conversationId,
      sender_type: 'bot',
      text,
    });

    // Если есть кнопки, отправляем их как отдельное сообщение
    if (buttons && buttons.length > 0) {
      await this.messagesService.create({
        conversation_id: conversationId,
        sender_type: 'bot',
        text: 'Выберите вариант:',
        attachments: [{ type: 'buttons', buttons }],
      });
    }
  }
}

