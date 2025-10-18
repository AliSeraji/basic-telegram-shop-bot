import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { TelegramService } from '../telegram.service';
import { getMainKeyboard } from '../utils/keyboards';
import { startMessage } from '../constants';

@Injectable()
export class StartHandler {
  private logger = new Logger(StartHandler.name);

  constructor(
    private userService: UserService,
    private telegramService: TelegramService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();

    bot.onText(/\/start/, async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      const fullName =
        `${msg.from?.first_name} ${msg.from.last_name || ''}`.trim();

      // Register user with Persian as default language
      let user = await this.userService.registerUser({
        telegramId,
        fullName,
        language: 'fa', // Always set to Persian
      });

      // If user doesn't have language set, set it to Persian
      if (!user.language) {
        await this.userService.updateLanguage(telegramId, 'fa');
        user = await this.userService.findByTelegramId(telegramId);
      }

      await this.telegramService.sendMessage(chatId, startMessage(fullName), {
        parse_mode: 'HTML',
        reply_markup: getMainKeyboard(false, 'fa'), // Always Persian, never force phone
      });
    });
  }
}
