import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
  ) {}

  async create(createMessageDto: CreateMessageDto) {
    const { senderId, receiverId, ...messageData } = createMessageDto;
    
    const message = this.messagesRepository.create({
      ...messageData,
      sender: { id: senderId },
      receiver: receiverId ? { id: receiverId } : null,
    });
    
    return this.messagesRepository.save(message);
  }

  findAll() {
    return this.messagesRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  findByUser(userId: string) {
    return this.messagesRepository.find({
      where: [
        { receiver: { id: userId } },
        { sender: { id: userId } } // Optional: include sent messages
      ],
      order: { createdAt: 'DESC' }
    });
  }

  async markAsRead(id: string) {
    return this.messagesRepository.update(id, { read: true });
  }

  async remove(id: string) {
    return this.messagesRepository.delete(id);
  }
}
