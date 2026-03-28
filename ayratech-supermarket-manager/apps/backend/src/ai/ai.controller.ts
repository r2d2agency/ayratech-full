import { Controller, Get, Post, Body, Param, Put, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { CreateAiConfigDto } from './dto/create-ai-config.dto';
import { CreateAiPromptDto } from './dto/create-ai-prompt.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('config')
  createConfig(@Body() createAiConfigDto: CreateAiConfigDto) {
    return this.aiService.createConfig(createAiConfigDto);
  }

  @Get('config')
  getActiveConfig() {
    return this.aiService.getActiveConfig();
  }

  @Post('prompts')
  createPrompt(@Body() createAiPromptDto: CreateAiPromptDto) {
    return this.aiService.createPrompt(createAiPromptDto);
  }

  @Put('prompts/:id')
  updatePrompt(@Param('id') id: string, @Body() updateAiPromptDto: CreateAiPromptDto) {
    return this.aiService.updatePrompt(id, updateAiPromptDto);
  }

  @Get('prompts')
  getAllPrompts() {
    return this.aiService.getAllPrompts();
  }

  @Get('prompts/:name')
  getPrompt(@Param('name') name: string) {
    return this.aiService.getPromptByName(name);
  }

  @Delete('prompts/:id')
  deletePrompt(@Param('id') id: string) {
    return this.aiService.deletePrompt(id);
  }

  @Get('pending')
  getPendingItems() {
    return this.aiService.getPendingItems();
  }

  @Post('analyze-batch')
  analyzeBatch(@Body() body: { ids: string[] }) {
    return this.aiService.analyzeBatch(body.ids);
  }

  @Post('generate-product-prompt')
  @UseInterceptors(FileInterceptor('image'))
  generateProductPrompt(
      @Body() body: { productId: string; promptId?: string },
      @UploadedFile() file: Express.Multer.File
  ) {
    return this.aiService.generateProductPrompt(body.productId, body.promptId, file);
  }
}
