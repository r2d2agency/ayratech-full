import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const { userId, ...data } = createNotificationDto;
    const notification = this.notificationsRepository.create({
      ...data,
      user: { id: userId } as any
    });
    const saved = await this.notificationsRepository.save(notification);
    
    // Emit via WebSocket
    this.notificationsGateway.sendNotificationToUser(userId, saved);
    
    return saved;
  }

  findAllForUser(userId: string) {
    return this.notificationsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: string) {
    await this.notificationsRepository.update(id, { read: true });
    return { success: true };
  }
  
  async markAllAsRead(userId: string) {
      // update doesn't support relation filtering easily, so we might need to fetch or use query builder
      // simpler: update where userId column (if it exists)
      // Since we kept userId column but potentially as duplicate, let's use QueryBuilder to be safe
      await this.notificationsRepository.createQueryBuilder()
        .update(Notification)
        .set({ read: true })
        .where("userId = :userId", { userId })
        .andWhere("read = :read", { read: false })
        .execute();
      return { success: true };
  }
}
