import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLog } from './entities/system-log.entity';

@Injectable()
export class SystemLogsService {
  constructor(
    @InjectRepository(SystemLog)
    private logsRepository: Repository<SystemLog>,
  ) {}

  async create(log: Partial<SystemLog>) {
    const newLog = this.logsRepository.create(log);
    return this.logsRepository.save(newLog);
  }

  async findAll(limit = 100) {
    return this.logsRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async clearLogs() {
    return this.logsRepository.clear();
  }
}
