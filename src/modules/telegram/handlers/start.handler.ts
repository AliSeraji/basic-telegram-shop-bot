import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { TelegramService } from '../telegram.service';
import { getMainKeyboard } from '../utils/keyboards';

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

      let user = await this.userService.registerUser({ telegramId, fullName });

      if (!user.language) {
        await this.sendLanguageSelection(chatId, fullName, true);
        return;
      }

      const hasPhone = !!user.phone && user.phone.trim() !== '';
      if (!hasPhone) {
        const message =
          user.language === 'en'
            ? '📞 Please send your phone number:'
            : '📞 لطفاً شماره تلفن خود را ارسال کنید:';
        await this.telegramService.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: getMainKeyboard(true, user.language),
        });
        return;
      }

      const message =
        user.language === 'en'
          ? `👋 Welcome back, ${fullName}! 🛍️ Feel free to use our store.`
          : `👋 خوش آمدید، ${fullName}! 🛒 از فروشگاه ما استفاده کنید!`;
      await this.telegramService.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: getMainKeyboard(false, user.language),
      });
    });

    bot.onText(/\/language|تغییر زبان|change language/i, async (msg) => {
      const chatId = msg.chat.id;
      const fullName =
        `${msg.from?.first_name} ${msg.from?.last_name || ''}`.trim();
      await this.sendLanguageSelection(chatId, fullName, false);
    });

    bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const telegramId = query.from.id.toString();
      const data = query.data;

      if (data !== 'lang_fa' && data !== 'lang_en') {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const newLang = data === 'lang_fa' ? 'fa' : 'en';
      let user = await this.userService.findByTelegramId(telegramId);

      if (user.language === newLang) {
        const message =
          newLang === 'en'
            ? '✅ Language is already set to English!'
            : '✅ زبان از قبل فارسی است!';
        const hasPhone = !!user.phone && user.phone.trim() !== '';
        await this.telegramService.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: getMainKeyboard(!hasPhone, newLang),
        });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      await this.userService.updateLanguage(telegramId, newLang);
      user = await this.userService.findByTelegramId(telegramId); // دریافت اطلاعات جدید

      const confirmMessage =
        newLang === 'en'
          ? '✅ Language changed to English!'
          : '✅ زبان به فارسی تغییر یافت!';
      const hasPhone = !!user.phone && user.phone.trim() !== '';
      await this.telegramService.sendMessage(chatId, confirmMessage, {
        parse_mode: 'HTML',
        reply_markup: getMainKeyboard(!hasPhone, newLang),
      });

      if (!hasPhone) {
        const phoneMessage =
          newLang === 'en'
            ? '📞 Please send your phone number:'
            : '📞 لطفاً شماره تلفن خود را ارسال کنید:';
        await this.telegramService.sendMessage(chatId, phoneMessage, {
          parse_mode: 'HTML',
          reply_markup: getMainKeyboard(true, newLang),
        });
      }

      await bot.answerCallbackQuery(query.id);
    });
  }

  private async sendLanguageSelection(
    chatId: number,
    fullName: string,
    isWelcome: boolean = false,
  ) {
    const message = isWelcome
      ? `👋 خوش آمدید، ${fullName}!\n\n🌐 لطفاً زبان را انتخاب کنید:\n🌐 Please select a language:`
      : `🌐 لطفاً زبان را انتخاب کنید:\n🌐 Please select a language:`;

    await this.telegramService.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇮🇷 فارسی', callback_data: 'lang_fa' },
            { text: '🇬🇧 English', callback_data: 'lang_en' },
          ],
        ],
        one_time_keyboard: true,
      },
    });
  }
}
