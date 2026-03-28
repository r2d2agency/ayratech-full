import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig } from './entities/ai-config.entity';
import { AiPrompt } from './entities/ai-prompt.entity';
import { RouteItemProduct } from '../routes/entities/route-item-product.entity';
import { Product } from '../entities/product.entity';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { In } from 'typeorm';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AiConfig)
    private aiConfigRepository: Repository<AiConfig>,
    @InjectRepository(AiPrompt)
    private aiPromptRepository: Repository<AiPrompt>,
    @InjectRepository(RouteItemProduct)
    private routeItemProductRepository: Repository<RouteItemProduct>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async getPendingItems() {
    return this.routeItemProductRepository.find({
      where: { aiStatus: 'UNCHECKED' },
      relations: ['product', 'routeItem', 'routeItem.route', 'routeItem.route.promoter'],
      take: 50,
      order: { checkInTime: 'DESC' }
    });
  }

  async analyzeBatch(ids: string[]) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const items = await this.routeItemProductRepository.find({
      where: { id: In(ids) },
      relations: ['product']
    });

    const results = [];

    for (const item of items) {
      if (!item.product) {
        results.push({ id: item.id, status: 'SKIPPED', reason: 'Produto não encontrado' });
        continue;
      }

      if (!item.product.analysisPrompt) {
        results.push({ id: item.id, status: 'SKIPPED', reason: 'Produto sem prompt' });
        continue;
      }
      
      if (!item.photos || item.photos.length === 0) {
        results.push({ id: item.id, status: 'SKIPPED', reason: 'Sem fotos' });
        continue;
      }

      const photoPath = item.photos[0];
      try {
        const analysis = await this.verifyImage(photoPath, item.product.analysisPrompt);
        
        item.aiStatus = analysis.status;
        item.aiObservation = analysis.observation;
        await this.routeItemProductRepository.save(item);
        
        results.push({ id: item.id, status: analysis.status, reason: analysis.observation });
      } catch (error) {
        this.logger.error(`Erro ao analisar item ${item.id}`, error);
        results.push({ id: item.id, status: 'ERROR', reason: error.message });
      }
    }

    return results;
  }

  async generateProductPrompt(productId: string, promptId?: string, file?: Express.Multer.File) {
    this.logger.log(`Gerando prompt para produto ${productId} (PromptID: ${promptId}, File: ${file ? 'Sim' : 'Não'})`);
    let description = '';
    
    try {
        const config = await this.getActiveConfig();
        if (!config) throw new BadRequestException('IA não configurada no sistema. Acesse Configurações > IA.');

        let instruction = 'Descreva detalhadamente este produto, incluindo marca, tipo de embalagem, cores principais, textos visíveis e características chave para identificação visual. Responda em português.';

        if (promptId) {
            const aiPrompt = await this.aiPromptRepository.findOne({ where: { id: promptId } });
            if (aiPrompt) {
                instruction = aiPrompt.content;
            }
        }

        if (file) {
          description = await this.processImageBuffer(config, file.buffer, file.mimetype, instruction);
        } else {
          const product = await this.productRepository.findOne({ where: { id: productId } });
          if (!product) throw new NotFoundException('Produto não encontrado');
          if (!product.referenceImageUrl) throw new BadRequestException('Produto sem imagem de referência para analisar');
          
          description = await this.processImage(config, product.referenceImageUrl, instruction);
          
          // Update product with generated prompt
          product.analysisPrompt = description;
          await this.productRepository.save(product);
        }
        
        return { description };
    } catch (error) {
        this.logger.error(`Erro ao gerar prompt do produto: ${error.message}`, error);
        if (error instanceof HttpException) {
            throw error;
        }
        throw new InternalServerErrorException(`Erro ao processar solicitação de IA: ${error.message}`);
    }
  }

  async createConfig(data: any) {
    this.logger.log(`Creating AI config for provider: ${data.provider}`);
    try {
      const configData = {
        ...data,
        model: data.model === '' ? null : data.model
      };
      
      const config = this.aiConfigRepository.create(configData);
      
      if (data.isActive) {
        this.logger.log('Deactivating other configs...');
        await this.aiConfigRepository.update({ isActive: true }, { isActive: false });
      }
      
      this.logger.log('Saving new config...');
      const saved = (await this.aiConfigRepository.save(config)) as unknown as AiConfig;
      this.logger.log(`Config saved with ID: ${saved.id}`);
      return saved;
    } catch (error) {
      this.logger.error('Erro ao salvar configuração de IA', error);
      throw error;
    }
  }

  async getActiveConfig() {
    try {
      return await this.aiConfigRepository.findOne({ where: { isActive: true } });
    } catch (error) {
      this.logger.error('Erro ao buscar configuração ativa de IA', error);
      throw error;
    }
  }

  async createPrompt(data: any) {
    return this.aiPromptRepository.save(this.aiPromptRepository.create(data));
  }

  async updatePrompt(id: string, data: any) {
    const prompt = await this.aiPromptRepository.findOne({ where: { id } });
    if (!prompt) throw new NotFoundException('Prompt não encontrado');
    Object.assign(prompt, data);
    return this.aiPromptRepository.save(prompt);
  }

  async getAllPrompts() {
    return this.aiPromptRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getPromptByName(name: string) {
    return this.aiPromptRepository.findOne({ where: { name } });
  }

  async deletePrompt(id: string) {
    return this.aiPromptRepository.delete(id);
  }

  async generateDescription(imagePath: string): Promise<string> {
    const config = await this.getActiveConfig();
    if (!config) throw new BadRequestException('IA não configurada.');

    const prompt = 'Descreva detalhadamente este produto, incluindo marca, tipo de embalagem, cores principais, textos visíveis e características chave para identificação visual. Responda em português.';
    
    return this.processImage(config, imagePath, prompt);
  }

  async verifyImage(imagePath: string, referenceDescription: string): Promise<{ status: string; observation: string }> {
    const config = await this.getActiveConfig();
    if (!config) throw new BadRequestException('IA não configurada.');

    const prompt = `
      Você é um assistente de auditoria de varejo. 
      Compare a imagem fornecida com a seguinte descrição de referência do produto esperado:
      "${referenceDescription}"
      
      A imagem mostra o produto descrito? 
      Responda EXATAMENTE no seguinte formato JSON:
      {
        "match": true/false,
        "reason": "Explicação breve"
      }
    `;

    try {
      const resultText = await this.processImage(config, imagePath, prompt);
      const cleanedText = resultText.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanedText);
      
      return {
        status: result.match ? 'OK' : 'FLAGGED',
        observation: result.reason
      };
    } catch (error) {
      this.logger.error('Erro ao processar resposta da IA', error);
      return { status: 'FLAGGED', observation: 'Erro ao processar resposta da IA.' };
    }
  }

  private async processImage(config: AiConfig, imagePath: string, promptText: string): Promise<string> {
    // Handle URLs
    if (imagePath.startsWith('http')) {
        try {
            const urlObj = new URL(imagePath);
            imagePath = urlObj.pathname;
        } catch (e) {
            // ignore invalid urls, treat as path
        }
    }

    // Resolve full path
    // We expect images to be in uploads/ folder
    let relativePath = imagePath;
    
    // Remove /uploads/ prefix or uploads/ prefix to normalize
    if (relativePath.includes('/uploads/')) {
        relativePath = relativePath.substring(relativePath.indexOf('/uploads/') + 9);
    } else if (relativePath.startsWith('uploads/')) {
        relativePath = relativePath.substring(8);
    }
    
    // Remove any leading slashes
    while (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
    }

    // Construct full path assuming standard structure
    const uploadRoot = path.join(process.cwd(), 'uploads');
    let fullPath = path.join(uploadRoot, relativePath);
    
    if (!fs.existsSync(fullPath)) {
         // Fallback: try relative to cwd directly (legacy or different structure)
         const altPath = path.join(process.cwd(), imagePath.startsWith('/') ? imagePath.substring(1) : imagePath);
         if (fs.existsSync(altPath)) {
             fullPath = altPath;
         } else {
             // Try one more: maybe it's in uploads but path was absolute /var/www/...
             // If we can't find it, log and throw
             this.logger.warn(`Image not found at ${fullPath} or ${altPath}. Original: ${imagePath}`);
             throw new NotFoundException(`Imagem não encontrada: ${relativePath}`);
         }
    }

    try {
        const imageBuffer = fs.readFileSync(fullPath);
        const mimeType = this.getMimeType(fullPath);
        
        return await this.processImageBuffer(config, imageBuffer, mimeType, promptText);
    } catch (e) {
        if (e instanceof HttpException) throw e;
        this.logger.error(`Erro ao ler/processar imagem ${fullPath}`, e);
        throw new BadRequestException(`Erro ao ler arquivo de imagem: ${e.message}`);
    }
  }

  private async processImageBuffer(config: AiConfig, imageBuffer: Buffer, mimeType: string, promptText: string): Promise<string> {
    const base64Image = imageBuffer.toString('base64');

    if (config.provider === 'gemini') {
      try {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model || 'gemini-1.5-flash' });
        
        const result = await model.generateContent([
          promptText,
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType
            }
          }
        ]);
        const response = await result.response;
        return response.text();
      } catch (error) {
        this.logger.error('Gemini API Error', error);
        throw new BadRequestException(`Erro ao processar imagem com Gemini: ${error.message}`);
      }
    } else if (config.provider === 'openai') {
      try {
        const openai = new OpenAI({ apiKey: config.apiKey });
        const response = await openai.chat.completions.create({
          model: config.model || 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
        });
        return response.choices[0].message.content || '';
      } catch (error) {
        this.logger.error('OpenAI API Error', error);
        throw new BadRequestException(`Erro ao processar imagem com OpenAI: ${error.message}`);
      }
    }
    
    throw new BadRequestException(`Provedor de IA desconhecido: ${config.provider}`);
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
  }
}
