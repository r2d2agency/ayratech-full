import { Injectable, Logger } from '@nestjs/common';

export interface ImageAnalysisResult {
  tags: string[];
  description: string;
  isCompliant: boolean;
  confidence: number;
  raw: any;
}

@Injectable()
export class ImageAnalysisService {
  private readonly logger = new Logger(ImageAnalysisService.name);

  /**
   * Stub for Microsoft Azure Computer Vision analysis
   * @param imageUrl URL or Path to the image
   * @param type Analysis type (gondola, document, facial)
   */
  async analyzeImage(imageUrl: string, type: 'gondola' | 'document' | 'facial' = 'gondola'): Promise<ImageAnalysisResult> {
    this.logger.log(`Analyzing image: ${imageUrl} [Type: ${type}]`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock response based on type
    if (type === 'facial') {
        return {
            tags: ['person', 'face', 'selfie'],
            description: 'A person looking at the camera',
            isCompliant: true,
            confidence: 0.98,
            raw: { mock: true }
        };
    }

    if (type === 'gondola') {
        // Randomly simulate a "stockout" or "compliant" gondola
        const isCompliant = Math.random() > 0.3;
        return {
            tags: ['shelf', 'products', 'supermarket'],
            description: isCompliant ? 'Fully stocked shelf' : 'Shelf with empty spaces',
            isCompliant,
            confidence: 0.85 + (Math.random() * 0.1),
            raw: { mock: true }
        };
    }

    return {
        tags: ['document', 'text'],
        description: 'Scanned document',
        isCompliant: true,
        confidence: 0.95,
        raw: { mock: true }
    };
  }

  /**
   * Validates if a face matches the registered employee photo (Face Verification)
   * This would call Azure Face API "Verify"
   */
  async verifyFace(capturedPhotoUrl: string, registeredPhotoUrl: string): Promise<{ isMatch: boolean; confidence: number }> {
      this.logger.log(`Verifying face match between ${capturedPhotoUrl} and ${registeredPhotoUrl}`);
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock Result
      return {
          isMatch: true,
          confidence: 0.92
      };
  }
}
