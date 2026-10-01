export interface ImageOptimizationResult {
  dataUrl: string;
  blob: Blob;
  sizeBytes: number;
  width: number;
  height: number;
  format: string;
}

/**
 * Redimensiona e otimiza uma imagem no navegador antes de qualquer envio.
 * Garante que imagens de câmeras de alta resolução (10-20MB) sejam otimizadas para ~80-180KB com máxima nitidez.
 */
export async function optimizeImageClientSide(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.80
): Promise<ImageOptimizationResult> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('O arquivo selecionado não é uma imagem válida.'));
    }

    // Cria um object URL leve apontando diretamente para o arquivo em memória
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Falha ao processar os dados da imagem.'));
    };

    img.onload = () => {
      let { width, height } = img;

      // Calcula novas dimensões mantendo proporção original
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error('Falha ao instanciar o contexto de renderização 2D.'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fundo branco caso haja transparência convertida para JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);

      // Tenta exportar em WebP, com fallback para JPEG
      let dataUrl = '';
      let format = 'image/webp';
      try {
        dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          format = 'image/jpeg';
        }
      } catch {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        format = 'image/jpeg';
      }

      canvas.toBlob(
        (blob) => {
          // Limpa o object URL da memória do navegador assim que finalizado
          URL.revokeObjectURL(objectUrl);

          if (!blob) {
            return resolve({
              dataUrl,
              blob: new Blob([dataUrl], { type: format }),
              sizeBytes: Math.round(dataUrl.length * 0.75),
              width,
              height,
              format,
            });
          }
          resolve({
            dataUrl,
            blob,
            sizeBytes: blob.size,
            width,
            height,
            format,
          });
        },
        format,
        quality
      );
    };

    img.src = objectUrl;
  });
}

/**
 * Compacta agressivamente uma Data URL caso ela precise ser usada como fallback
 * para nunca estourar o limite de 1MB por documento no Firestore.
 */
export async function compressDataUrlForFirestore(
  dataUrl: string,
  maxDimension = 900,
  quality = 0.65
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;
  // Se já for leve (< 60 KB), não precisa reprocessar
  if (dataUrl.length < 75000) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const compressed = canvas.toDataURL('image/webp', quality);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Verifica se a URL ou Data URL da imagem é segura para o documento Firestore (evita 1MB limit).
 */
export function isSafeForFirestoreDocument(url: string): { isSafe: boolean; sizeBytes: number; warning?: string } {
  if (!url) return { isSafe: true, sizeBytes: 0 };
  if (!url.startsWith('data:')) {
    return { isSafe: true, sizeBytes: url.length };
  }

  const approxBytes = Math.round((url.length * 3) / 4);
  const MAX_SAFE_BYTES = 120 * 1024; // 120 KB de margem segura

  if (approxBytes > MAX_SAFE_BYTES) {
    return {
      isSafe: false,
      sizeBytes: approxBytes,
      warning: `Imagem em Base64 tem ~${Math.round(approxBytes / 1024)} KB. O Firestore limita documentos a 1 MB. Recomenda-se upload permanente via Storage ou API.`,
    };
  }

  return { isSafe: true, sizeBytes: approxBytes };
}
