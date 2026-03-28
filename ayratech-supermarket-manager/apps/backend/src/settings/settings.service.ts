import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
  ) {}

  async getSettings() {
    const settings = await this.settingsRepository.find();
    if (settings.length === 0) {
      // Create default
      const defaultSettings = this.settingsRepository.create();
      return this.settingsRepository.save(defaultSettings);
    }
    return settings[0];
  }

  async updateSettings(updateSettingDto: UpdateSettingDto) {
    let settings = await this.getSettings();
    Object.assign(settings, updateSettingDto);
    return this.settingsRepository.save(settings);
  }
}