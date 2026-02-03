import { Injectable, Inject, forwardRef } from '@nestjs/common';
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
    'соединить с оператором',
    'ба оператор пайваст кардан',
    'operator',
    'connect',
    'human',
    'support',
    'call operator',
    'speak to operator',
    'connect to operator',
  ];

  private readonly faq: Record<string, { 
    ru: string; 
    tj: string; 
    en: string; 
    buttons?: { ru: string[]; tj: string[]; en: string[] } | string[];
  }> = {
    tariffs: {
      ru: 'Наши тарифы:\n\n• Зимистон 1: 30 Мбит/с, соц-сети 50 Мбит/с - 240 сомони/мес\n• Зимистон 2: 50 Мбит/с, соц-сети 50 Мбит/с - 320 сомони/мес\n• Зимистон 3: 70 Мбит/с, соц-сети 70 Мбит/с - 550 сомони/мес\n• Зимистон 4: 100 Мбит/с, соц-сети 100 Мбит/с - 770 сомони/мес\n• Зимистон 1А: 30 Мбит/с (200 ГБ, после окончания 15 Мбит/с), соц-сети 50 Мбит/с - 155 сомони/мес\n\nХотите узнать больше или подключить?',
      tj: 'Тарифҳои мо:\n\n• Зимистон 1: 30 Мбит/с, шабакаҳои иҷтимоӣ 50 Мбит/с - 240 сомонӣ/моҳ\n• Зимистон 2: 50 Мбит/с, шабакаҳои иҷтимоӣ 50 Мбит/с - 320 сомонӣ/моҳ\n• Зимистон 3: 70 Мбит/с, шабакаҳои иҷтимоӣ 70 Мбит/с - 550 сомонӣ/моҳ\n• Зимистон 4: 100 Мбит/с, шабакаҳои иҷтимоӣ 100 Мбит/с - 770 сомонӣ/моҳ\n• Зимистон 1А: 30 Мбит/с (200 ГБ, пас аз анҷом 15 Мбит/с), шабакаҳои иҷтимоӣ 50 Мбит/с - 155 сомонӣ/моҳ\n\nМехоҳед бештар бидонед ё пайваст кунед?',
      en: 'Our tariffs:\n\n• Zimiston 1: 30 Mbps, social networks 50 Mbps - 240 somoni/month\n• Zimiston 2: 50 Mbps, social networks 50 Mbps - 320 somoni/month\n• Zimiston 3: 70 Mbps, social networks 70 Mbps - 550 somoni/month\n• Zimiston 4: 100 Mbps, social networks 100 Mbps - 770 somoni/month\n• Zimiston 1A: 30 Mbps (200 GB, after traffic ends 15 Mbps), social networks 50 Mbps - 155 somoni/month\n\nWant to know more or connect?',
      buttons: {
        ru: ['Подключить', 'Соединить с оператором'],
        tj: ['Пайваст кардан', 'Ба оператор пайваст кардан'],
        en: ['Connect', 'Connect to operator'],
      },
    },
    payment: {
      ru: 'Способы оплаты:\n• Онлайн через мобильное приложение\n• Терминалы оплаты\n• Банковский перевод\n• Наличными в офисе\n\nНужна помощь с оплатой?',
      tj: 'Усулҳои пардохт:\n• Онлайн тавассути барномаи мобилӣ\n• Терминалҳои пардохт\n• Гузарониши бонкӣ\n• Нақд дар офис\n\nКӯмак бо пардохт лозим аст?',
      en: 'Payment methods:\n• Online via mobile app\n• Payment terminals\n• Bank transfer\n• Cash at office\n\nNeed help with payment?',
      buttons: {
        ru: ['Соединить с оператором'],
        tj: ['Ба оператор пайваст кардан'],
        en: ['Connect to operator'],
      },
    },
    internet_not_working: {
      ru: 'Проверьте следующее:\n1. Роутер включен и индикаторы горят\n2. Кабель подключен правильно\n3. Перезагрузите роутер (выключите на 30 сек)\n4. Проверьте баланс\n\nЕсли не помогло, опишите проблему подробнее.',
      tj: 'Инро санҷед:\n1. Роутер фаъол аст ва нишондиҳандаҳо мешавананд\n2. Кабел дуруст пайваст аст\n3. Роутерро аз нав оғоз кунед (30 сония хомӯш кунед)\n4. Баллансро санҷед\n\nАгар кӯмак накард, мушкилиро ба тафсилот тавсиф кунед.',
      en: 'Check the following:\n1. Router is on and indicators are lit\n2. Cable is connected correctly\n3. Restart router (turn off for 30 sec)\n4. Check balance\n\nIf it didn\'t help, describe the problem in detail.',
      buttons: {
        ru: ['Не помогло', 'Соединить с оператором'],
        tj: ['Кӯмак накард', 'Ба оператор пайваст кардан'],
        en: ['Didn\'t help', 'Connect to operator'],
      },
    },
    slow_internet: {
      ru: 'Возможные причины медленного интернета:\n• Перегрузка сети в часы пик\n• Проблемы с роутером\n• Много устройств подключено\n• Вирусы на устройстве\n\nПопробуйте перезагрузить роутер. Если не поможет, нужны детали.',
      tj: 'Сабабҳои эҳтимолии интернети суст:\n• Боркашӣ дар соатҳои пик\n• Мушкилоти роутер\n• Бисёр асбобҳо пайваст шудаанд\n• Вирусҳо дар асбоб\n\nРоутерро аз нав оғоз кунед. Агар кӯмак накард, тафсилот лозим аст.',
      en: 'Possible reasons for slow internet:\n• Network overload during peak hours\n• Router problems\n• Many devices connected\n• Viruses on device\n\nTry restarting router. If it doesn\'t help, need details.',
      buttons: {
        ru: ['Соединить с оператором'],
        tj: ['Ба оператор пайваст кардан'],
        en: ['Connect to operator'],
      },
    },
    connection: {
      ru: 'Для подключения интернета:\n1. Оставьте заявку на сайте\n2. Или позвоните по телефону\n3. Наш специалист приедет в удобное время\n\nХотите оставить заявку?',
      tj: 'Барои пайваст кардани интернет:\n1. Дархостро дар сомона гузоред\n2. Ё ба телефон занг занед\n3. Мутахассиси мо дар вақти мусоид меояд\n\nМехоҳед дархост гузоред?',
      en: 'To connect internet:\n1. Submit request on website\n2. Or call by phone\n3. Our specialist will come at convenient time\n\nWant to submit request?',
      buttons: {
        ru: ['Оставить заявку', 'Соединить с оператором'],
        tj: ['Дархост гузоштан', 'Ба оператор пайваст кардан'],
        en: ['Submit request', 'Connect to operator'],
      },
    },
    contacts: {
      ru: 'Наши контакты:\n📞 Телефон: +992 93 123 45 67\n📧 Email: support@example.com\n📍 Адрес: г. Душанбе, ул. Примерная, 123\n\nРаботаем: Пн-Пт 9:00-18:00',
      tj: 'Тамосҳои мо:\n📞 Телефон: +992 93 123 45 67\n📧 Email: support@example.com\n📍 Суроға: Душанбе, кӯчаи Намуна, 123\n\nКор: Душ-Ҷум 9:00-18:00',
      en: 'Our contacts:\n📞 Phone: +992 93 123 45 67\n📧 Email: support@example.com\n📍 Address: Dushanbe, Example St, 123\n\nWorking: Mon-Fri 9:00-18:00',
      buttons: {
        ru: ['Соединить с оператором'],
        tj: ['Ба оператор пайваст кардан'],
        en: ['Connect to operator'],
      },
    },
  };

  constructor(
    private messagesService: MessagesService,
    @Inject(forwardRef(() => ConversationsService))
    private conversationsService: ConversationsService,
  ) {}

  async processMessage(
    conversationId: number,
    text: string,
    language: 'ru' | 'tj' | 'en' = 'ru',
  ): Promise<BotResponse> {
    const lowerText = text.toLowerCase().trim();

    // Проверка на запрос оператора
    if (this.shouldTransferToOperator(lowerText)) {
      await this.transferToOperator(conversationId, language);
      return {
        text: language === 'ru'
          ? 'Передаю оператору. Обычно ответ занимает несколько минут. Пожалуйста, оставайтесь в чате.'
          : language === 'tj'
          ? 'Ба оператор мегузаронам. Одатан ҷавоб чанд дақиқа мегирад. Лутфан дар чат бимонед.'
          : 'Transferring to operator. Usually response takes a few minutes. Please stay in chat.',
        shouldTransferToOperator: true,
      };
    }

    // Обработка кнопок
    // Кнопка "Не помогло" / "Кӯмак накард" / "Didn't help" - передаем оператору
    if (lowerText.includes('не помогло') || lowerText.includes('кӯмак накард') || lowerText.includes("didn't help") || lowerText.includes('did not help')) {
      await this.transferToOperator(conversationId, language);
      return {
        text: language === 'ru'
          ? 'Передаю оператору. Обычно ответ занимает несколько минут. Пожалуйста, оставайтесь в чате.'
          : language === 'tj'
          ? 'Ба оператор мегузаронам. Одатан ҷавоб чанд дақиқа мегирад. Лутфан дар чат бимонед.'
          : 'Transferring to operator. Usually response takes a few minutes. Please stay in chat.',
        shouldTransferToOperator: true,
      };
    }

    if (lowerText.includes('интернет не работает') || lowerText.includes('интернет кор намекунад') || lowerText.includes('internet not working') || lowerText.includes('internet is not working')) {
      return this.getFAQResponse('internet_not_working', language);
    }

    if (lowerText.includes('медленный интернет') || lowerText.includes('интернети суст') || lowerText.includes('slow internet')) {
      return this.getFAQResponse('slow_internet', language);
    }

    if (lowerText.includes('оплата') || lowerText.includes('пардохт') || lowerText.includes('payment') || lowerText.includes('pay')) {
      return this.getFAQResponse('payment', language);
    }

    if (lowerText.includes('тариф') || lowerText.includes('тарифҳо') || lowerText.includes('tariff') || lowerText.includes('tariffs')) {
      return this.getFAQResponse('tariffs', language);
    }

    if (lowerText.includes('подключ') || lowerText.includes('пайваст') || lowerText.includes('connect') || lowerText.includes('connection')) {
      return this.getFAQResponse('connection', language);
    }

    if (lowerText.includes('контакт') || lowerText.includes('тамос') || lowerText.includes('contact') || lowerText.includes('contacts')) {
      return this.getFAQResponse('contacts', language);
    }

    // Если вопрос слишком короткий или непонятный
    if (text.length < 10) {
      return {
        text: language === 'ru'
          ? 'Пожалуйста, опишите ваш вопрос подробнее. Или выберите один из вариантов:'
          : language === 'tj'
          ? 'Лутфан, саволи худро ба тафсилот тавсиф кунед. Ё яке аз вариантҳоро интихоб кунед:'
          : 'Please describe your question in detail. Or choose one of the options:',
        buttons: [
          language === 'ru' ? 'Интернет не работает' : language === 'tj' ? 'Интернет кор намекунад' : 'Internet not working',
          language === 'ru' ? 'Медленный интернет' : language === 'tj' ? 'Интернети суст' : 'Slow internet',
          language === 'ru' ? 'Оплата' : language === 'tj' ? 'Пардохт' : 'Payment',
          language === 'ru' ? 'Тарифы' : language === 'tj' ? 'Тарифҳо' : 'Tariffs',
          language === 'ru' ? 'Соединить с оператором' : language === 'tj' ? 'Ба оператор пайваст кардан' : 'Connect to operator',
        ],
      };
    }

    // Стандартный ответ
    return {
      text: language === 'ru'
        ? 'Понял ваш вопрос. Давайте уточним детали. Могу помочь с тарифами, оплатой, подключением или техническими проблемами. Что именно вас интересует?'
        : language === 'tj'
        ? 'Саволро фаҳмидам. Биёед тафсилотро равшан кунем. Метавонам бо тарифҳо, пардохт, пайвасткунӣ ё мушкилоти техникӣ кӯмак кунам. Чӣ шумо мавриди қайд аст?'
        : 'Understood your question. Let\'s clarify details. I can help with tariffs, payment, connection or technical issues. What exactly interests you?',
      buttons: [
        language === 'ru' ? 'Интернет не работает' : language === 'tj' ? 'Интернет кор намекунад' : 'Internet not working',
        language === 'ru' ? 'Оплата' : language === 'tj' ? 'Пардохт' : 'Payment',
        language === 'ru' ? 'Тарифы' : language === 'tj' ? 'Тарифҳо' : 'Tariffs',
        language === 'ru' ? 'Соединить с оператором' : language === 'tj' ? 'Ба оператор пайваст кардан' : 'Connect to operator',
      ],
    };
  }

  private shouldTransferToOperator(text: string): boolean {
    return this.transferKeywords.some((keyword) => text.includes(keyword));
  }

  private getFAQResponse(key: string, language: 'ru' | 'tj' | 'en'): BotResponse {
    const faq = this.faq[key];
    if (!faq) {
      return {
        text: language === 'ru' ? 'Извините, не понял вопрос.' : language === 'tj' ? 'Бубахшед, саволро нафаҳмидам.' : 'Sorry, didn\'t understand the question.',
      };
    }

    // Получаем текст в зависимости от языка
    const text = language === 'ru' ? faq.ru : language === 'tj' ? faq.tj : faq.en;
    
    // Получаем кнопки в зависимости от языка
    let buttons: string[] | undefined;
    if (faq.buttons) {
      if (Array.isArray(faq.buttons)) {
        // Если кнопки - массив (старый формат для обратной совместимости)
        buttons = faq.buttons;
      } else {
        // Если кнопки - объект с переводами
        buttons = faq.buttons[language];
      }
    }

    return {
      text,
      buttons,
    };
  }

  async transferToOperator(conversationId: number, language: 'ru' | 'tj' | 'en'): Promise<void> {
    await this.conversationsService.updateStatus(conversationId, 'queued');
    
    const systemMessage = language === 'ru'
      ? 'Диалог передан оператору. Пожалуйста, подождите.'
      : language === 'tj'
      ? 'Муколама ба оператор супорида шуд. Лутфан интизор шавед.'
      : 'Dialog transferred to operator. Please wait.';

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

