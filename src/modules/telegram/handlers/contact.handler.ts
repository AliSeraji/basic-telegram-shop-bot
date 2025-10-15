import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';
import { getMainKeyboard } from '../utils/keyboards';

@Injectable()
export class ContactHandler {
  private logger = new Logger(ContactHandler.name);

  constructor(
    private telegramService: TelegramService,
    private userService: UserService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();

    bot.on('contact', async (ctx) => {
      const chatId = ctx.chat.id;
      const telegramId = ctx.from.id.toString();

      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';

        if (
          !ctx.message.contact ||
          ctx.message.contact.user_id !== ctx.from.id
        ) {
          this.logger.warn(
            `مخاطب نامعتبر: ${JSON.stringify(ctx.message.contact)}`,
          );
          const message =
            language === 'fa'
              ? 'شما فقط می‌توانید شماره تلفن خود را به اشتراک بگذارید. لطفاً دکمه "ارسال شماره تلفن" را فشار دهید.'
              : 'You can only share your own phone number. Please press the "Send phone number" button.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getMainKeyboard(true, language),
          });
          return;
        }

        const phone = ctx.message.contact.phone_number;

        this.logger.log(
          `شماره تلفن دریافت شد: ${phone} telegramId: ${telegramId}`,
        );
        await this.userService.updatePhoneNumber(telegramId, phone);

        const message =
          language === 'fa'
            ? `✅ شماره تلفن شما ذخیره شد: ${phone}\nاکنون می‌توانید به راحتی از فروشگاه ما استفاده کنید!`
            : `✅ Your phone number has been saved: ${phone}\nNow you can freely use our store!`;
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: getMainKeyboard(false, language),
        });
      } catch (error) {
        this.logger.error(`خطا در ذخیره شماره تلفن: ${error.message}`);
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const message =
          language === 'fa'
            ? '❌ خطا در ذخیره شماره تلفن شما رخ داد. لطفاً دوباره امتحان کنید.'
            : '❌ Error occurred while saving phone number. Please try again.';
        await this.telegramService.sendMessage(chatId, message);
      }
    });
  }
}
