import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';
import { getMainKeyboard } from '../utils/keyboards';

@Injectable()
export class HelpHandler {
  private logger = new Logger(HelpHandler.name);
  private activeHelpSessions = new Set<string>(); // Track active help sessions

  constructor(
    private telegramService: TelegramService,
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();
    const adminTelegramId = this.configService.get<string>('ADMIN_TELEGRAM_ID');
    const adminTelegramUser = this.configService.get<string>(
      'ADMIN_TELEGRAM_USERNAME',
    );

    if (!adminTelegramId || !adminTelegramUser) {
      this.logger.error(
        'ADMIN_TELEGRAM_ID or ADMIN_TELEGRAM_USER is not defined in .env file',
      );
      throw new Error(
        'ADMIN_TELEGRAM_ID or ADMIN_TELEGRAM_USER is not defined',
      );
    }

    bot.onText(/🆘 راهنما|🆘 Help/i, async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();

      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        this.logger.log(`Processing help for telegramId: ${telegramId}`);

        this.activeHelpSessions.add(telegramId);

        const message =
          language === 'fa'
            ? `🆘 راهنما\n\nاگر سوالی دارید، با مدیر تماس بگیرید: @${adminTelegramUser}\n\nیا پیام خود را بنویسید:`
            : `🆘 Help\n\nIf you have any questions, contact the administrator: @${adminTelegramUser}\n\nOr write a message:`;

        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text:
                    language === 'fa'
                      ? '🏠 بازگشت به منوی اصلی'
                      : '🏠 Return to Main Menu',
                  callback_data: 'return_to_main_menu',
                },
              ],
            ],
          },
        });

        const messageHandler = async (replyMsg: any) => {
          if (!this.activeHelpSessions.has(telegramId)) {
            return;
          }

          if (
            replyMsg.text?.startsWith('/') ||
            replyMsg.text?.includes('📁') ||
            replyMsg.text?.includes('🛒') ||
            replyMsg.text?.includes('👤') ||
            replyMsg.text?.includes('🕘') ||
            replyMsg.text?.includes('ℹ️') ||
            replyMsg.text?.includes('🆘')
          ) {
            this.activeHelpSessions.delete(telegramId); // End session
            return;
          }

          const replyText = replyMsg.text;
          if (!replyText) {
            this.logger.log(
              `Ignoring empty help message from telegramId: ${telegramId}`,
            );
            const emptyMessage =
              language === 'fa'
                ? 'لطفاً پیام خود را بنویسید.'
                : 'Please write a message.';
            await this.telegramService.sendMessage(chatId, emptyMessage, {
              reply_markup: getMainKeyboard(false, language),
            });
            this.activeHelpSessions.delete(telegramId); // End session
            return;
          }

          try {
            await this.telegramService.sendChatAction(
              adminTelegramId,
              'typing',
            );
            const adminMessage =
              language === 'fa'
                ? `درخواست کمک:\nکاربر: ${replyMsg.from?.id} (@${replyMsg.from?.username || 'N/A'})\nپیام: ${replyText}`
                : `Help request:\nUser: ${replyMsg.from?.id} (@${replyMsg.from?.username || 'N/A'})\nMessage: ${replyText}`;
            await this.telegramService.sendMessage(
              adminTelegramId,
              adminMessage,
            );
            const successMessage =
              language === 'fa'
                ? `✅ پیام شما به مدیر (@${adminTelegramUser}) ارسال شد. به زودی پاسخ دریافت خواهید کرد!`
                : `✅ Your message has been sent to the administrator (@${adminTelegramUser}). You will receive a response soon!`;
            await this.telegramService.sendMessage(chatId, successMessage, {
              reply_markup: getMainKeyboard(false, language),
            });
          } catch (error) {
            this.logger.error(`Error sending help to admin: ${error.message}`);
            const errorMessage =
              language === 'fa'
                ? error.response?.body?.error_code === 403
                  ? `خطا در ارسال پیام: مدیر (@${adminTelegramUser}) چت را با ربات شروع نکرده است. لطفاً به @${adminTelegramUser} پیام دهید.`
                  : `خطا در ارسال پیام: ${error.message}. لطفاً به @${adminTelegramUser} پیام دهید.`
                : error.response?.body?.error_code === 403
                  ? `Sending error: Admin (@${adminTelegramUser}) has not started a chat with the bot. Please write to @${adminTelegramUser}.`
                  : `Sending error: ${error.message}. Please write to @${adminTelegramUser}.`;
            await this.telegramService.sendMessage(chatId, errorMessage, {
              reply_markup: getMainKeyboard(false, language),
            });
          } finally {
            this.activeHelpSessions.delete(telegramId);
          }
        };

        bot.once('message', messageHandler);
      } catch (error) {
        this.logger.error(`Error in help: ${error.message}`);
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const message =
          language === 'fa'
            ? `خطا در درخواست کمک رخ داد. لطفاً به @${adminTelegramUser} پیام دهید.`
            : `Error occurred in help request. Please write to @${adminTelegramUser}.`;
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: getMainKeyboard(false, language),
        });
        this.activeHelpSessions.delete(telegramId);
      }
    });

    bot.on('callback_query', async (query) => {
      if (!query.data || query.data !== 'return_to_main_menu') return;
      if (!query.message?.chat?.id || !query.from) return;

      const chatId = query.message.chat.id;
      const telegramId = query.from.id.toString();

      try {
        this.activeHelpSessions.delete(telegramId);

        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';

        const message =
          language === 'fa'
            ? '🏠 به منوی اصلی بازگشتید'
            : '🏠 Returned to main menu';

        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: getMainKeyboard(false, language),
        });
        await bot.answerCallbackQuery(query.id);
      } catch (error) {
        this.logger.error(`Error in return_to_main_menu: ${error.message}`);
        this.activeHelpSessions.delete(telegramId);
        await bot.answerCallbackQuery(query.id);
      }
    });
  }
}
