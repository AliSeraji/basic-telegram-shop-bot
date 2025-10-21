import { Logger } from '@nestjs/common';
import { Product } from '../product.entity';
import { ProductService } from '../product.service';
import TelegramBot = require('node-telegram-bot-api');

const logger = new Logger('ProductDisplayHelper');

export async function sendProductWithImage(
  bot: TelegramBot,
  chatId: number,
  productService: ProductService,
  productId: number,
  language: string = 'fa',
  additionalOptions?: any,
): Promise<void> {
  try {
    const product = await productService.findOne(productId);

    const caption =
      language === 'fa'
        ? `${product.name}\n\n${product.description}\n\nقیمت: ${product.price} تومان`
        : `${product.name}\n\n${product.description}\n\nPrice: ${product.price} Toman`;

    if (product.imageData && product.imageMimeType) {
      // Send as buffer stream
      await bot.sendPhoto(chatId, product.imageData, {
        caption,
        ...additionalOptions,
      });
    } else if (product.imageUrl) {
      // Fallback to URL if no binary data
      await bot.sendPhoto(chatId, product.imageUrl, {
        caption,
        ...additionalOptions,
      });
    } else {
      // No image available, send text only
      await bot.sendMessage(chatId, caption, additionalOptions);
    }
  } catch (error) {
    logger.error(`Error sending product with image: ${error.message}`);
    throw error;
  }
}

export async function sendProductsInCategory(
  bot: TelegramBot,
  chatId: number,
  productService: ProductService,
  categoryId: number,
  language: string = 'fa',
): Promise<void> {
  try {
    const products = await productService.findAll();
    const categoryProducts = products.filter(
      (p) => p.category?.id === categoryId,
    );

    if (categoryProducts.length === 0) {
      const message =
        language === 'fa'
          ? 'محصولی در این دسته‌بندی یافت نشد.'
          : 'No products found in this category.';
      await bot.sendMessage(chatId, message);
      return;
    }

    for (const product of categoryProducts) {
      const caption =
        language === 'fa'
          ? `${product.name}\n\n${product.description}\n\nقیمت: ${product.price} تومان`
          : `${product.name}\n\n${product.description}\n\nPrice: ${product.price} Toman`;

      if (product.imageData && product.imageMimeType) {
        await bot.sendPhoto(chatId, product.imageData, { caption });
      } else if (product.imageUrl) {
        await bot.sendPhoto(chatId, product.imageUrl, { caption });
      } else {
        await bot.sendMessage(chatId, caption);
      }
    }
  } catch (error) {
    logger.error(`Error sending products in category: ${error.message}`);
    throw error;
  }
}

// Helper to send a single product (when you already have the product object)
export async function sendProduct(
  bot: TelegramBot,
  chatId: number,
  product: Product,
  language: string = 'fa',
  additionalOptions?: any,
): Promise<void> {
  try {
    const caption =
      language === 'fa'
        ? `${product.name}\n\n${product.description}\n\nقیمت: ${product.price} تومان`
        : `${product.name}\n\n${product.description}\n\nPrice: ${product.price} Toman`;

    if (product.imageData && product.imageMimeType) {
      await bot.sendPhoto(chatId, product.imageData, {
        caption,
        ...additionalOptions,
      });
    } else if (product.imageUrl) {
      await bot.sendPhoto(chatId, product.imageUrl, {
        caption,
        ...additionalOptions,
      });
    } else {
      await bot.sendMessage(chatId, caption, additionalOptions);
    }
  } catch (error) {
    logger.error(`Error sending product: ${error.message}`);
    throw error;
  }
}
