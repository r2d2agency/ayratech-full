import { Controller, Get, Patch, Body, UseGuards, UseInterceptors, UploadedFiles, HttpException, HttpStatus } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import { UPLOAD_ROOT } from '../config/upload.config';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'logo', maxCount: 1 },
    { name: 'loginLogo', maxCount: 1 },
    { name: 'systemLogo', maxCount: 1 },
    { name: 'splashScreen', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
    { name: 'pwaIcon', maxCount: 1 },
    { name: 'siteIcon', maxCount: 1 },
  ]))
  async updateSettings(
    @Body() updateSettingDto: UpdateSettingDto,
    @UploadedFiles() files: { 
        logo?: Express.Multer.File[], 
        loginLogo?: Express.Multer.File[], 
        systemLogo?: Express.Multer.File[], 
        splashScreen?: Express.Multer.File[], 
        favicon?: Express.Multer.File[],
        pwaIcon?: Express.Multer.File[],
        siteIcon?: Express.Multer.File[]
    }
  ) {
    try {
        const processFile = async (file: Express.Multer.File, folder: string) => {
            const filename = `${folder}-${Date.now()}.webp`; 
            const uploadDir = path.join(UPLOAD_ROOT, 'settings');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            await sharp(file.buffer)
                .toFile(path.join(uploadDir, filename));
            
            return `/uploads/settings/${filename}`;
        };

        if (files?.logo?.[0]) {
            updateSettingDto.logoUrl = await processFile(files.logo[0], 'logo');
        }
        if (files?.loginLogo?.[0]) {
            updateSettingDto.loginLogoUrl = await processFile(files.loginLogo[0], 'login-logo');
        }
        if (files?.systemLogo?.[0]) {
            updateSettingDto.systemLogoUrl = await processFile(files.systemLogo[0], 'system-logo');
        }
        if (files?.splashScreen?.[0]) {
            updateSettingDto.splashScreenUrl = await processFile(files.splashScreen[0], 'splash-screen');
        }
        if (files?.favicon?.[0]) {
            updateSettingDto.faviconUrl = await processFile(files.favicon[0], 'favicon');
        }
        if (files?.pwaIcon?.[0]) {
            updateSettingDto.pwaIconUrl = await processFile(files.pwaIcon[0], 'pwa-icon');
        }
        if (files?.siteIcon?.[0]) {
            updateSettingDto.siteIconUrl = await processFile(files.siteIcon[0], 'site-icon');
        }

        return this.settingsService.updateSettings(updateSettingDto);
    } catch (error) {
        throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}