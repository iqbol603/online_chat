import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedClient } from '../entities/blocked-client.entity';
import { ClientsService } from '../clients/clients.service';

@Injectable()
export class BlockedClientsService {
  constructor(
    @InjectRepository(BlockedClient)
    private blockedClientsRepository: Repository<BlockedClient>,
    private clientsService: ClientsService,
  ) {}

  async isBlocked(phone: string): Promise<boolean> {
    const normalizedPhone = this.clientsService.normalizePhone(phone);
    const blocked = await this.blockedClientsRepository.findOne({
      where: {
        phone: normalizedPhone,
        is_active: true,
      },
    });
    return !!blocked;
  }

  async block(phone: string, reason: string, blockedByOperatorId: number, clientName?: string): Promise<BlockedClient> {
    const normalizedPhone = this.clientsService.normalizePhone(phone);
    
    // Проверяем, не заблокирован ли уже
    const existing = await this.blockedClientsRepository.findOne({
      where: { phone: normalizedPhone, is_active: true },
    });

    if (existing) {
      // Обновляем существующую блокировку
      existing.reason = reason;
      existing.blocked_by_operator_id = blockedByOperatorId;
      existing.unblocked_at = null;
      return await this.blockedClientsRepository.save(existing);
    }

    // Создаём новую блокировку
    const blocked = this.blockedClientsRepository.create({
      phone: normalizedPhone,
      name: clientName,
      reason,
      blocked_by_operator_id: blockedByOperatorId,
      is_active: true,
    });

    return await this.blockedClientsRepository.save(blocked);
  }

  async unblock(phone: string): Promise<void> {
    const normalizedPhone = this.clientsService.normalizePhone(phone);
    await this.blockedClientsRepository.update(
      { phone: normalizedPhone, is_active: true },
      { is_active: false, unblocked_at: new Date() },
    );
  }

  async findAll(includeInactive = false): Promise<BlockedClient[]> {
    const where: any = {};
    if (!includeInactive) {
      where.is_active = true;
    }
    return await this.blockedClientsRepository.find({
      where,
      relations: ['blocked_by_operator'],
      order: { blocked_at: 'DESC' },
    });
  }

  async findByPhone(phone: string): Promise<BlockedClient | null> {
    const normalizedPhone = this.clientsService.normalizePhone(phone);
    return await this.blockedClientsRepository.findOne({
      where: { phone: normalizedPhone },
      relations: ['blocked_by_operator'],
      order: { blocked_at: 'DESC' },
    });
  }
}
