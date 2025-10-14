import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { OrderService } from '../order/order.service';
import { DeliveryService } from '../delivery/delivery.service';
import {
  formatOrderList,
  formatUserList,
  formatProductList,
  formatCategoryList,
  formatFeedbackList,
} from './utils/helpers';
import { getMainKeyboard } from './utils/keyboards';
@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private logger = new Logger(TelegramService.name);
  private readonly adminTelegramUser: string;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private deliveryService: DeliveryService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    this.adminTelegramUser =
      this.configService.get<string>('ADMIN_TELEGRAM_USERNAME') || 'Afinename';

    console.log('token, webhookUrl', token, webhookUrl);
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined in .env file');
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    if (!webhookUrl) {
      this.logger.error('WEBHOOK_URL is not defined in .env file');
      throw new Error('WEBHOOK_URL is not defined');
    }

    this.bot = new TelegramBot(token, { polling: false });
    this.setupWebhook(webhookUrl);
    this.setupCommands();
  }

  private async setupWebhook(webhookUrl: string) {
    try {
      this.logger.log(`Setting webhook to ${webhookUrl}`);
      const startTime = Date.now();
      await this.bot.setWebHook(webhookUrl);
      const duration = Date.now() - startTime;
      this.logger.log(`Webhook set in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Failed to set webhook: ${error.message}`);
      throw error;
    }
  }

  private setupCommands() {
    this.bot.onText(/👤 My profile| پروفایل من👤 /, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const message = `${language === 'fa' ? '👤 My profile' : 'پروفایل من👤'}\n${language === 'fa' ? 'نام' : 'Name'}: ${user.fullName}\n${language === 'fa' ? 'شماره تلفن' : 'PhoneNumber'}: ${user.phone || (language === 'fa' ? 'وارد نشده' : 'Not Specified')}\nTelegram ID: ${user.telegramId}`;
        await this.bot.sendMessage(chatId, message, {
          reply_markup: getMainKeyboard(!user.phone, language),
        });
      } catch (error) {
        this.logger.error(`Error in profile: ${error.message}`);
        const language =
          (await this.userService.findByTelegramId(telegramId))?.language ||
          'fa';
        await this.bot.sendMessage(
          chatId,
          language === 'fa'
            ? 'هنگام دریافت اطلاعات پروفایل خطایی رخ داد'
            : 'Error while retrieving profile data',
        );
      }
    });

    this.bot.onText(/تاریخچه سفارش🕘|🕘 Order history/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const orders = await this.orderService.getUserOrders(telegramId);
        const message = orders.length
          ? formatOrderList(orders, language)
          : language === 'fa'
            ? 'هیچ سفارشی موجود نیست'
            : 'No orders';
        await this.bot.sendMessage(
          chatId,
          `${language === 'fa' ? 'تاریخچه سفارش🕘' : '🕘 Order history'}\n${message}`,
          {
            reply_markup: getMainKeyboard(false, language),
          },
        );
      } catch (error) {
        this.logger.error(`Error in order history: ${error.message}`);
        const language =
          (await this.userService.findByTelegramId(telegramId))?.language ||
          'fa';
        await this.bot.sendMessage(
          chatId,
          language === 'fa'
            ? 'هنگام دریافت تاریخچه سفارش خطایی رخ داد'
            : 'Error while retrieving order history',
        );
      }
    });

    this.bot.onText(/درباره ماℹ️|ℹ️ About us/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const user = await this.userService.findByTelegramId(
          msg.from.id.toString(),
        );
        const language = user.language || 'fa';
        const message = `${language === 'fa' ? 'درباره ماℹ️' : 'ℹ️ About us'}\n${language === 'fa' ? 'ما یک فروشگاه آنلاین هستیم که محصولات باکیفیت آرایشی بهداشتی ژاپن را ارائه میدهیم' : 'We are an online store offering beauty products from Japan.'}\n${language === 'fa' ? 'تماس' : 'Contact'}: @${this.adminTelegramUser}\n${language === 'fa' ? 'پیج اینستاگرام' : 'Instagram page'}: https://yourshop.uz`;
        await this.bot.sendMessage(chatId, message, {
          reply_markup: getMainKeyboard(false, language),
        });
      } catch (error) {
        this.logger.error(`Error in about: ${error.message}`);
        const language =
          (await this.userService.findByTelegramId(msg.from.id.toString()))
            ?.language || 'fa';
        await this.bot.sendMessage(
          chatId,
          language === 'fa'
            ? 'هنگام دریافت اطلاعات درباره ما خطایی رخ داد'
            : 'An error occurred while retrieving information about us',
        );
      }
    });
  }
  getBotInstance(): TelegramBot {
    return this.bot;
  }

  async handleWebhookUpdate(update: TelegramBot.Update) {
    try {
      const startTime = Date.now();
      await this.bot.processUpdate(update);
      const duration = Date.now() - startTime;
      this.logger.log(`Webhook update processed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Webhook update failed: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(
    chatId: any,
    text: string,
    options: TelegramBot.SendMessageOptions = {},
  ) {
    try {
      const finalOptions: TelegramBot.SendMessageOptions = {
        ...options,
        parse_mode: options.parse_mode ?? 'HTML',
      };

      await this.bot.sendMessage(chatId, text, finalOptions);
    } catch (error) {
      this.logger.error(
        `Error sending message to chatId ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendPhoto(
    chatId: number,
    photo: string,
    options?: TelegramBot.SendPhotoOptions,
  ) {
    try {
      await this.bot.sendPhoto(chatId, photo, {
        ...options,
        parse_mode: options?.parse_mode || 'HTML',
      });
    } catch (error) {
      this.logger.error(
        `Error sending photo to chatId ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendChatAction(
    chatId: string | number,
    action: TelegramBot.ChatAction,
  ) {
    try {
      await this.bot.sendChatAction(chatId, action);
    } catch (error) {
      this.logger.error(
        `Error sending chat action to chatId ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }
}
