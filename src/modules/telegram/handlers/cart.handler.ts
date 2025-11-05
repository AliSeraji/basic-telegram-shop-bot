import { Injectable, Logger } from '@nestjs/common';
import { CartService } from '../../cart/cart.service';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class CartHandler {
  private logger = new Logger(CartHandler.name);

  constructor(
    private cartService: CartService,
    private telegramService: TelegramService,
    private userService: UserService,
  ) {}

  async displayCart(
    chatId: number,
    telegramId: string,
    language: string,
  ): Promise<void> {
    try {
      this.logger.log(`Processing cart for telegramId: ${telegramId}`);
      const startTime = Date.now();
      const cartItems = await this.cartService.getCartItems(telegramId);
      const duration = Date.now() - startTime;
      this.logger.log(
        `Fetched ${cartItems.length} cart items in ${duration}ms`,
      );

      if (!cartItems.length) {
        const message =
          language === 'fa' ? 'سبد خرید شما خالی است.' : 'Your cart is empty.';
        await this.telegramService.sendMessage(chatId, message);
        return;
      }

      let message = language === 'fa' ? 'سبد خرید شما:\n\n' : 'Your cart:\n';
      let total = 0;

      cartItems.forEach((item) => {
        const itemText =
          language === 'fa'
            ? `${item.product.name} - ${item.quantity} عدد، قیمت: ${item.product.price * item.quantity} دلار\n\n`
            : `${item.product.name} - ${item.quantity} pcs., Price: ${item.product.price * item.quantity} sum\n\n`;
        message += itemText;
        total += item.product.price * item.quantity;
      });

      message +=
        language === 'fa' ? `جمع کل: ${total} دلار` : `Total: ${total} sum`;

      message +=
        language === 'fa'
          ? '\n\nلطفا توجه کنید که قیمت ها به دلار هستند.لطفا برای پرداخت معادل ریالی قیمت کالاها را در نظر بگیرید.'
          : '\n\nTo place the order or clear the cart, choose an option:';

      await this.telegramService.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: language === 'fa' ? '✅ ثبت سفارش' : '✅ Place order',
                callback_data: 'place_order',
              },
            ],
            [
              {
                text:
                  language === 'fa' ? '🗑️ پاک کردن سبد خرید' : '🗑️ Clear cart',
                callback_data: 'clear_cart',
              },
            ],
          ],
        },
      });
    } catch (error) {
      this.logger.error(`Error in cart: ${error.message}`);
      const message =
        language === 'fa'
          ? 'خطا در دریافت سبد خرید رخ داد.'
          : 'Error occurred while getting cart.';
      await this.telegramService.sendMessage(chatId, message);
    }
  }

  handle() {
    const bot = this.telegramService.getBotInstance();
    bot.onText(/🛒 (سبد خرید|Cart)/, async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();

      const user = await this.userService.findByTelegramId(telegramId);
      const language = user.language || 'fa';

      await this.displayCart(chatId, telegramId, language);
    });
  }
}
