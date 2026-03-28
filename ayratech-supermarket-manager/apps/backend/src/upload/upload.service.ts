import { Injectable, BadRequestException } from '@nestjs/common';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_ROOT } from '../config/upload.config';

interface UploadOptions {
  subDir?: string;
  width?: number;
  height?: number;
  quality?: number;
  prefix?: string;
}

@Injectable()
export class UploadService {
  async uploadFile(file: Express.Multer.File, options: UploadOptions = {}) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const { 
      subDir = '', 
      width = 800, 
      height = null, 
      quality = 80,
      prefix = ''
    } = options;

    const uploadDir = subDir ? path.join(UPLOAD_ROOT, subDir) : UPLOAD_ROOT;
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const filename = `${prefix ? prefix + '-' : ''}${uniqueSuffix}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Process image
    try {
      const sharpInstance = sharp(file.buffer);
      
      if (width || height) {
        sharpInstance.resize(width, height, { 
          fit: 'inside', 
          withoutEnlargement: true 
        });
      }

      await sharpInstance
        .webp({ quality })
        .toFile(filepath);
    } catch (sharpError) {
      console.error('Sharp processing error:', sharpError);
      throw new BadRequestException(`Image processing failed: ${sharpError.message}`);
    }

    // Return the URL
    const host = process.env.API_URL || 'http://localhost:3000'; 
    const relativePath = subDir ? `/uploads/${subDir}/${filename}` : `/uploads/${filename}`;
    
    return { 
      url: `${host}${relativePath}`,
      path: relativePath
    };
  }
}
