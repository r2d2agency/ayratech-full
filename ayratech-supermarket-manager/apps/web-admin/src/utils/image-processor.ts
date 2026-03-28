
export interface WatermarkData {
  supermarketName: string;
  promoterName: string;
  timestamp: Date;
}

// Helper to load image to an HTMLImageElement
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    img.src = src;
  });
};

export const processImage = async (
  file: File, 
  data: WatermarkData
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (event) => {
      try {
        const src = event.target?.result as string;
        const img = await loadImage(src);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Resize Logic (Max 1280px)
        const maxSize = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original image (resized)
        ctx.drawImage(img, 0, 0, width, height);

        // Watermark Configuration - Top-Left Corner (50% W x 25% H)
        const wmWidth = canvas.width * 0.5;
        const wmHeight = canvas.height * 0.25; // Half of previous height (was 0.5)
        const wmX = 0;
        const wmY = 0; // Positioned at top

        // Draw Watermark Background (More opaque black)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; // Increased opacity
        ctx.fillRect(wmX, wmY, wmWidth, wmHeight);

        // Text Configuration
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Dynamic font size based on image width
        const fontSize = Math.floor(canvas.width * 0.035); // ~3.5% of width
        const lineHeight = fontSize * 1.4;
        const padding = Math.floor(canvas.width * 0.03); // 3% padding

        let currentY = wmY + padding;

        // Helper to draw label and value
        const drawField = (label: string, value: string) => {
          // Label
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.fillText(label, wmX + padding, currentY);
          currentY += lineHeight;

          // Value
          ctx.font = `${fontSize}px Arial`;
          ctx.fillText(value, wmX + padding, currentY, wmWidth - (padding * 2));
          currentY += lineHeight * 1.5; // Extra spacing between fields
        };

        // 1. Date/Time
        const dateStr = data.timestamp.toLocaleDateString('pt-BR');
        const timeStr = data.timestamp.toLocaleTimeString('pt-BR');
        drawField("DATA / HORA:", `${dateStr} ${timeStr}`);

        // 2. PDV (Supermarket)
        drawField("PDV:", data.supermarketName);

        // 3. Promoter
        drawField("PROMOTOR:", data.promoterName);

        // Convert to WebP
        canvas.toBlob((blob) => {
          if (blob) {
            // Create a new File object with .webp extension
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const processedFile = new File([blob], newFileName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(processedFile);
          } else {
            reject(new Error('Canvas conversion failed'));
          }
        }, 'image/webp', 0.8);

      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
  });
};
