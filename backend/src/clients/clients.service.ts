import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
  ) {}

  async create(data: {
    phone: string;
    name: string;
    email?: string;
    channel: 'web' | 'mobile';
    language?: 'ru' | 'tj' | 'en';
    account_id?: string;
    contract?: string;
    personal_account?: string;
  }): Promise<Client> {
    // Нормализация телефона
    const normalizedPhone = this.normalizePhone(data.phone);
    
    // Проверка существования
    let client = await this.clientsRepository.findOne({
      where: { phone: normalizedPhone },
    });

    if (client) {
      // Обновляем данные если клиент уже существует
      // Язык всегда обновляем, если он передан в запросе
      const updateData: any = {
        name: data.name,
        email: data.email,
        channel: data.channel,
        language: data.language !== undefined ? data.language : client.language, // Обновляем язык, если передан
        account_id: data.account_id,
        contract: data.contract,
        personal_account: data.personal_account,
      };
      
      Object.assign(client, updateData);
      return await this.clientsRepository.save(client);
    }

    client = this.clientsRepository.create({
      phone: normalizedPhone,
      name: data.name,
      email: data.email,
      channel: data.channel,
      language: data.language || 'ru',
      account_id: data.account_id,
      contract: data.contract,
      personal_account: data.personal_account,
    });

    return await this.clientsRepository.save(client);
  }

  async findByPhone(phone: string): Promise<Client | null> {
    const normalizedPhone = this.normalizePhone(phone);
    return await this.clientsRepository.findOne({
      where: { phone: normalizedPhone },
    });
  }

  async findById(clientId: number): Promise<Client> {
    const client = await this.clientsRepository.findOne({
      where: { client_id: clientId },
      relations: ['conversations'],
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  normalizePhone(phone: string): string {
    // Удаляем все кроме цифр и +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Если начинается с 992, добавляем +
    if (cleaned.startsWith('992') && !cleaned.startsWith('+992')) {
      cleaned = '+' + cleaned;
    }
    
    // Если начинается с 9, добавляем +992
    if (cleaned.match(/^9\d{8}$/)) {
      cleaned = '+992' + cleaned;
    }
    
    // Проверка формата +992xxxxxxxxx (13 символов)
    if (!cleaned.match(/^\+992\d{9}$/)) {
      throw new Error('Invalid phone format. Expected: +992xxxxxxxxx');
    }
    
    return cleaned;
  }

  validatePhone(phone: string): boolean {
    try {
      this.normalizePhone(phone);
      return true;
    } catch {
      return false;
    }
  }
}

