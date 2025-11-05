import { Logger } from '@nestjs/common';
import { CartService } from '../cart.service';
import { ProductService } from '../../product/product.service';
import { TelegramService } from '../../telegram/telegram.service';
import TelegramBot = require('node-telegram-bot-api');

const logger = new Logger('CartHandler');

export async function handleAddToCart(
  bot: TelegramBot,
  chatId: number,
  telegramId: string,
  productId: number,
  language: string,
  telegramService: TelegramService,
  productService: ProductService,
): Promise<void> {
  try {
    const product = await productService.findOne(productId);

    if (!product) {
      const message =
        language === 'fa' ? '❌ محصول یافت نشد.' : '❌ Product not found.';
      await telegramService.sendMessage(chatId, message);
      return;
    }

    if (!product.isActive || product.stock === 0) {
      const message =
        language === 'fa'
          ? '❌ این محصول در حال حاضر موجود نیست.'
          : '❌ This product is currently unavailable.';
      await telegramService.sendMessage(chatId, message);
      return;
    }

    const maxQuantity = Math.min(product.stock, 10);
    const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    for (let i = 1; i <= maxQuantity; i += 5) {
      const row: Array<{ text: string; callback_data: string }> = [];
      for (let j = i; j < i + 5 && j <= maxQuantity; j++) {
        row.push({
          text: `${j}`,
          callback_data: `addqty_${productId}_${j}`,
        });
      }
      keyboard.push(row);
    }

    keyboard.push([
      {
        text: language === 'fa' ? '❌ انصراف' : '❌ Cancel',
        callback_data: 'cancel_add_to_cart',
      },
    ]);

    const message =
      language === 'fa'
        ? `📦 ${product.name}\n\nچند عدد از این کالا می‌خواهید؟\n\n`
        : `📦 ${product.name}\n\nHow many do you want?`;

    await telegramService.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error(`Error in handleAddToCart: ${error.message}`);
    const message =
      language === 'fa'
        ? '❌ خطایی رخ داد، لطفاً دوباره تلاش کنید.'
        : '❌ An error occurred, please try again.';
    await telegramService.sendMessage(chatId, message);
  }
}

export async function handleAddQuantityToCart(
  bot: TelegramBot,
  chatId: number,
  telegramId: string,
  productId: number,
  quantity: number,
  language: string,
  telegramService: TelegramService,
  cartService: CartService,
  productService: ProductService,
): Promise<void> {
  try {
    const product = await productService.findOne(productId);

    if (!product) {
      const message =
        language === 'fa' ? '❌ محصول یافت نشد.' : '❌ Product not found.';
      await telegramService.sendMessage(chatId, message);
      return;
    }

    if (quantity > product.stock) {
      const message =
        language === 'fa'
          ? `❌ تعداد درخواستی بیش از موجودی است. موجودی فعلی: ${product.stock} عدد`
          : `❌ Requested quantity exceeds stock. Current stock: ${product.stock} units`;
      await telegramService.sendMessage(chatId, message);
      return;
    }

    await cartService.addToCart({
      telegramId,
      productId,
      quantity,
    });

    const totalPrice = product.price * quantity;
    const message =
      language === 'fa'
        ? `✅ ${quantity} عدد ${product.name} به سبد خرید اضافه شد.\n\n💰 جمع: ${totalPrice.toLocaleString('fa-IR')} دلار`
        : `✅ ${quantity}x ${product.name} added to cart.\n\n💰 Total: ${totalPrice.toLocaleString()} Toman`;

    await telegramService.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: language === 'fa' ? '🛒 مشاهده سبد خرید' : '🛒 View Cart',
              callback_data: 'view_cart',
            },
            {
              text:
                language === 'fa' ? '🛍 ادامه خرید' : '🛍 Continue Shopping',
              callback_data: 'back_to_categories',
            },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error(`Error in handleAddQuantityToCart: ${error.message}`);
    const message =
      language === 'fa'
        ? '❌ خطایی در افزودن به سبد خرید رخ داد.'
        : '❌ Error adding to cart.';
    await telegramService.sendMessage(chatId, message);
  }
}
