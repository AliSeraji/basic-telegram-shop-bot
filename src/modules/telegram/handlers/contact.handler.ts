import { Injectable, Logger } from '@nestjs/common';
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

    bot.on('contact', async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();

      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';

        if (!msg.contact || msg.contact.user_id !== msg.from.id) {
          this.logger.warn(`مخاطب نامعتبر: ${JSON.stringify(msg.contact)}`);
          const message =
            language === 'fa'
              ? 'شما فقط می‌توانید شماره تلفن خود را به اشتراک بگذارید. لطفاً دکمه "ارسال شماره تلفن" را فشار دهید.'
              : 'You can only share your own phone number. Please press the "Send phone number" button.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getMainKeyboard(true, language),
          });
          return;
        }

        const phone = msg.contact.phone_number;

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
