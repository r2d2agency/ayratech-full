import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiConfig } from './entities/ai-config.entity';
import { AiPrompt } from './entities/ai-prompt.entity';
import { RouteItemProduct } from '../routes/entities/route-item-product.entity';
import { Product } from '../entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiConfig, AiPrompt, RouteItemProduct, Product])],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
