import { Logger } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');

const logger = new Logger('ImageHandler');

export async function downloadTelegramPhoto(
  bot: TelegramBot,
  fileId: string,
  maxSizeMB: number = 10,
): Promise<{ imageData: Buffer; imageMimeType: string } | { error: string }> {
  try {
    const file = await bot.getFile(fileId);
    const fileSizeInMB = (file.file_size || 0) / (1024 * 1024);

    logger.log(`File size: ${fileSizeInMB.toFixed(2)} MB`);

    if (fileSizeInMB > maxSizeMB) {
      return {
        error: `File size too large: ${fileSizeInMB.toFixed(2)} MB (max: ${maxSizeMB} MB)`,
      };
    }

    // Get file stream from Telegram
    const stream = bot.getFileStream(fileId);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    const imageData = Buffer.concat(chunks);
    const imageMimeType = 'image/jpeg';

    logger.log(`Successfully processed photo, size: ${imageData.length} bytes`);
    return { imageData, imageMimeType };
  } catch (error) {
    logger.error(`Error processing photo: ${error.message}`);
    return { error: error.message || 'Failed to download image' };
  }
}
