import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class HelpHandler {
  private logger = new Logger(HelpHandler.name);

  constructor(
    private telegramService: TelegramService,
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();
    const adminTelegramId = '5661241603';
    const adminTelegramUser = 'Vali_003';

    if (!adminTelegramId || !adminTelegramUser) {
      this.logger.error(
        'ADMIN_TELEGRAM_ID or ADMIN_TELEGRAM_USER is not defined in .env file',
      );
      throw new Error(
        'ADMIN_TELEGRAM_ID or ADMIN_TELEGRAM_USER is not defined',
      );
    }

    bot.onText(/🆘 (راهنما|Help)/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        this.logger.log(`Processing help for telegramId: ${telegramId}`);
        const message =
          language === 'fa'
            ? `🆘 راهنما\nاگر سوالی دارید، با مدیر تماس بگیرید: @${adminTelegramUser}\nیا پیام خود را بنویسید:`
            : `🆘 Help\nIf you have any questions, contact the administrator: @${adminTelegramUser}\nOr write a message:`;
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: { force_reply: true },
        });
        bot.once('message', async (replyMsg) => {
          const replyText = replyMsg.text;
          if (!replyText) {
            this.logger.log(
              `Ignoring empty help message from telegramId: ${telegramId}`,
            );
            const emptyMessage =
              language === 'fa'
                ? 'لطفاً پیام خود را بنویسید.'
                : 'Please write a message.';
            await this.telegramService.sendMessage(chatId, emptyMessage);
            return;
          }
          try {
            await this.telegramService.sendChatAction(
              adminTelegramId,
              'typing',
            );
            const adminMessage =
              language === 'fa'
                ? `درخواست کمک:\nکاربر: ${replyMsg.from.id} (@${replyMsg.from.username || 'N/A'})\nپیام: ${replyText}`
                : `Help request:\nUser: ${replyMsg.from.id} (@${replyMsg.from.username || 'N/A'})\nMessage: ${replyText}`;
            await this.telegramService.sendMessage(
              adminTelegramId,
              adminMessage,
            );
            const successMessage =
              language === 'fa'
                ? `پیام شما به مدیر (@${adminTelegramUser}) ارسال شد. به زودی پاسخ دریافت خواهید کرد!`
                : `Your message has been sent to the administrator (@${adminTelegramUser}). You will receive a response soon!`;
            await this.telegramService.sendMessage(chatId, successMessage);
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
            await this.telegramService.sendMessage(chatId, errorMessage);
          }
        });
      } catch (error) {
        this.logger.error(`Error in help: ${error.message}`);
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const message =
          language === 'fa'
            ? `خطا در درخواست کمک رخ داد. لطفاً به @${adminTelegramUser} پیام دهید.`
            : `Error occurred in help request. Please write to @${adminTelegramUser}.`;
        await this.telegramService.sendMessage(chatId, message);
      }
    });
  }
}
