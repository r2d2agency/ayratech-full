import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY');
    this.instanceName = this.configService.get<string>('EVOLUTION_INSTANCE_NAME');
  }

  async sendText(phone: string, message: string) {
    if (!this.apiUrl || !this.apiKey || !this.instanceName) {
      this.logger.warn('Evolution API not configured (URL, Key or Instance Name missing)');
      return;
    }

    // Sanitize phone number (remove non-digits)
    const cleanPhone = phone.replace(/\D/g, '');
    // Ensure 55 prefix if missing (assuming BR for now, or handle appropriately)
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const url = `${this.apiUrl}/message/sendText/${this.instanceName}`;
    
    try {
      this.logger.log(`Sending WhatsApp to ${formattedPhone}`);
      const response = await axios.post(
        url,
        {
          number: formattedPhone,
          options: {
            delay: 1200,
            presence: "composing",
            linkPreview: true
          },
          textMessage: {
            text: message
          }
        },
        {
          headers: {
            apikey: this.apiKey,
          },
        }
      );
      this.logger.log(`WhatsApp sent successfully: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error sending WhatsApp: ${error.message}`, error.response?.data);
      // Don't throw to prevent blocking the main flow, just log
    }
  }

  async getConnectionStatus() {
    if (!this.apiUrl || !this.apiKey || !this.instanceName) {
      return { status: 'ERROR', message: 'Configuração ausente (URL, Key ou Instance Name)' };
    }

    const url = `${this.apiUrl}/instance/connectionState/${this.instanceName}`;

    try {
      const response = await axios.get(url, {
        headers: {
          apikey: this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error checking WhatsApp connection: ${error.message}`, error.response?.data);
      return { 
        status: 'ERROR', 
        message: 'Erro ao conectar com Evolution API', 
        details: error.response?.data || error.message 
      };
    }
  }
}
