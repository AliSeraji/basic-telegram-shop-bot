import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { UserService } from '../../user/user.service';
import { TelegramService } from '../telegram.service';
import { getAdminKeyboard } from '../utils/keyboards';

@Injectable()
export class AdminHandler {
  private logger = new Logger(AdminHandler.name);

  constructor(
    private userService: UserService,
    private telegramService: TelegramService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();
    bot.onText(/\/admin/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        if (!user.isAdmin) {
          const message =
            language === 'fa'
              ? 'این عملیات فقط برای ادمین در دسترس است❌'
              : '❌ This action is available only for administrators.';
          await this.telegramService.sendMessage(chatId, message, {});
          return;
        }
        const message =
          language === 'fa'
            ? 'به پنل مدیریت خوش آمدید 🛠'
            : '🛠 Welcome to the admin panel!';
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: getAdminKeyboard(language),
        });
      } catch (error) {
        this.logger.error(`Error in admin: ${error.message}`);
        const message =
          'خطا در ورود به پنل مدیریت❌\n❌ Error accessing the admin panel.';
        await this.telegramService.sendMessage(chatId, message, {});
      }
    });
  }
}
