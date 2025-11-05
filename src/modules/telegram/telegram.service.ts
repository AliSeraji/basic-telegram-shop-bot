import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { OrderService } from '../order/order.service';
import { DeliveryService } from '../delivery/delivery.service';
import { formatOrderList } from './utils/helpers';
import { getMainKeyboard } from './utils/keyboards';

import TelegramBot = require('node-telegram-bot-api');
import { profileMessage } from './constants';
import {
  handleReceiptUpload,
  hasPendingReceipt,
} from '../order/helper/order-placement.helper';

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private logger = new Logger(TelegramService.name);
  private readonly adminTelegramUser?: string;
  private readonly instagramAccount?: string;
  private userEditStates = new Map<string, { field: string }>();
  private token?: string;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {
    this.token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.adminTelegramUser = this.configService.get<string>(
      'ADMIN_TELEGRAM_USERNAME',
    );

    this.instagramAccount = this.configService.get<string>(
      'ADMIN_INSTAGRAM_ACCOUNT',
    );

    if (!this.token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined in .env file');
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    this.bot = new TelegramBot(this.token, {
      polling: true,
      request: {
        url: 'https://api.telegram.org',
        agentOptions: {
          family: 4,
        },
      },
    });

    this.setupCommands();
  }

  getBotToken(): string | undefined {
    return this.token;
  }

  private setupCommands() {
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;
      const telegramId = msg.from?.id.toString();

      if (msg.photo && msg.photo.length > 0 && telegramId) {
        if (hasPendingReceipt(telegramId)) {
          await handleReceiptUpload(this.bot, msg, this.orderService, this);
          return;
        }
      }

      if (text) {
        this.logger.log(`[DIAGNOSTIC] Received text: ${text} from ${chatId}`);
      }

      if (telegramId && this.userEditStates.has(telegramId)) {
        const state = this.userEditStates.get(telegramId);

        if (!state || !text) return;

        const validProfileFields = [
          'fullName',
          'phone',
          'email',
          'userAddress',
        ];
        if (!validProfileFields.includes(state.field)) {
          return;
        }

        try {
          const user = await this.userService.findByTelegramId(telegramId);
          const language = user.language || 'fa';

          const updateData: any = {};
          updateData[state.field] = text;

          await this.userService.update(user.id, updateData);

          const fieldNames: any = {
            fullName: language === 'fa' ? 'نام' : 'Name',
            phone: language === 'fa' ? 'شماره تلفن' : 'Phone',
            email: language === 'fa' ? 'ایمیل' : 'Email',
            userAddress: language === 'fa' ? 'آدرس' : 'Address',
          };

          const successMessage =
            language === 'fa'
              ? `✅ ${fieldNames[state.field]} با موفقیت به‌روزرسانی شد!`
              : `✅ ${fieldNames[state.field]} updated successfully!`;

          await this.bot.sendMessage(chatId, successMessage, {
            reply_markup: getMainKeyboard(false, language),
          });

          this.userEditStates.delete(telegramId);
        } catch (error) {
          this.logger.error(`Error updating profile: ${error.message}`);
          const language =
            (await this.userService.findByTelegramId(telegramId))?.language ||
            'fa';
          const errorMessage =
            language === 'fa'
              ? '❌ خطا در به‌روزرسانی اطلاعات'
              : '❌ Error updating information';
          await this.bot.sendMessage(chatId, errorMessage);
          this.userEditStates.delete(telegramId);
        }
        return;
      }
    });

    this.bot.onText(/👤 پروفایل من|👤 My Profile/i, async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';

        const message =
          language === 'fa'
            ? `👤 پروفایل من\n\n` +
              `📝 نام و نام خانوادگی: ${user.fullName || 'وارد نشده'}\n` +
              `📞 شماره تلفن: ${user.phone || 'وارد نشده'}\n` +
              `📧 ایمیل: ${user.email || 'وارد نشده'}\n` +
              `📍 آدرس: ${user.userAddress || 'وارد نشده'}\n` +
              profileMessage
            : `👤 My Profile\n\n` +
              `📝 Name: ${user.fullName || 'Not specified'}\n` +
              `📞 Phone: ${user.phone || 'Not specified'}\n` +
              `📧 Email: ${user.email || 'Not specified'}\n` +
              `📍 Address: ${user.userAddress || 'Not specified'}\n`;

        const keyboard: TelegramBot.InlineKeyboardButton[][] = [
          [
            {
              text: language === 'fa' ? '✏️ ویرایش نام' : '✏️ Edit Name',
              callback_data: 'edit_fullName',
            },
            {
              text: language === 'fa' ? '✏️ ویرایش تلفن' : '✏️ Edit Phone',
              callback_data: 'edit_phone',
            },
          ],
          [
            {
              text: language === 'fa' ? '✏️ ویرایش ایمیل' : '✏️ Edit Email',
              callback_data: 'edit_email',
            },
            {
              text: language === 'fa' ? '✏️ ویرایش آدرس' : '✏️ Edit Address',
              callback_data: 'edit_userAddress',
            },
          ],
        ];

        await this.bot.sendMessage(chatId, message, {
          reply_markup: { inline_keyboard: keyboard },
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

    this.bot.on('callback_query', async (query) => {
      if (!query.data?.startsWith('edit_')) return;
      if (!query.message?.chat?.id || !query.from) return;

      const chatId = query.message.chat.id;
      const telegramId = query.from.id.toString();
      const field = query.data.replace('edit_', '');

      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';

        const prompts: any = {
          fullName:
            language === 'fa'
              ? '📝 نام خود را وارد کنید:'
              : '📝 Enter your name:',
          phone:
            language === 'fa'
              ? '📞 شماره تلفن خود را وارد کنید:'
              : '📞 Enter your phone number:',
          email:
            language === 'fa'
              ? '📧 ایمیل خود را وارد کنید:'
              : '📧 Enter your email:',
          userAddress:
            language === 'fa'
              ? '📍 آدرس خود را وارد کنید:'
              : '📍 Enter your address:',
        };

        this.userEditStates.set(telegramId, { field });

        await this.bot.sendMessage(chatId, prompts[field], {
          reply_markup: { force_reply: true },
        });

        await this.bot.answerCallbackQuery(query.id);
      } catch (error) {
        this.logger.error(`Error in edit callback: ${error.message}`);
        await this.bot.answerCallbackQuery(query.id);
      }
    });

    this.bot.on('callback_query', async (query) => {
      if (query.data !== 'return_to_main_menu') return;
      if (!query.message?.chat?.id || !query.from) return;

      const chatId = query.message.chat.id;
      const telegramId = query.from.id.toString();

      try {
        this.userEditStates.delete(telegramId);

        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';

        const message =
          language === 'fa'
            ? '🏠 به منوی اصلی بازگشتید'
            : '🏠 Returned to main menu';

        await this.bot.sendMessage(chatId, message, {
          reply_markup: getMainKeyboard(false, language),
        });
        await this.bot.answerCallbackQuery(query.id);
      } catch (error) {
        this.logger.error(`Error in return_to_main_menu: ${error.message}`);
        await this.bot.answerCallbackQuery(query.id);
      }
    });

    this.bot.onText(/🕘 تاریخچه سفارشات|🕘 Order History/i, async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const page = 1;
        const limit = 10;

        const orders = await this.orderService.getUserOrders(
          telegramId,
          page,
          limit,
        );
        const total = await this.orderService.getUserOrdersCount(telegramId);

        const totalPages = Math.ceil(total / limit);
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

        // Add pagination buttons if there's more than one page
        if (totalPages > 1) {
          const navButtons: TelegramBot.InlineKeyboardButton[] = [];

          if (page > 1) {
            navButtons.push({
              text: language === 'fa' ? '◀️ قبلی' : '◀️ Previous',
              callback_data: `user_view_orders_${page - 1}`,
            });
          }

          navButtons.push({
            text: `${page}/${totalPages}`,
            callback_data: 'noop',
          });

          if (page < totalPages) {
            navButtons.push({
              text: language === 'fa' ? 'بعدی ▶️' : 'Next ▶️',
              callback_data: `user_view_orders_${page + 1}`,
            });
          }

          keyboard.push(navButtons);
        }

        const message = orders.length
          ? formatOrderList(orders, language)
          : language === 'fa'
            ? 'هیچ سفارشی موجود نیست'
            : 'No orders';

        await this.bot.sendMessage(
          chatId,
          `${language === 'fa' ? '🕘 تاریخچه سفارشات' : '🕘 Order history'}\n\n${message}`,
          {
            reply_markup: {
              inline_keyboard: keyboard,
            },
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

    this.bot.onText(/ℹ️ درباره ما|ℹ️ About Us/i, async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      try {
        const user = await this.userService.findByTelegramId(
          msg.from.id.toString(),
        );
        const language = user.language || 'fa';

        const message =
          language === 'fa'
            ? `ℹ️ درباره ما\n\n` +
              `ما یک فروشگاه آنلاین تخصصی هستیم که با هدف ارائه محصولات اصل و باکیفیت آرایشی و بهداشتی برند ژاپنی، خدمات خود را به شما عزیزان ارائه می‌دهیم.\n\n` +
              `🎯 هدف ما رضایت شما و تامین نیازهای زیبایی شما با بهترین کیفیت است.\n\n` +
              `📞 راه‌های ارتباطی:\n` +
              `• تلگرام: @${this.adminTelegramUser}\n\n` +
              `🙏 از اعتماد شما سپاسگزاریم!`
            : `ℹ️ About Us\n\n` +
              `We are a specialized online store dedicated to providing authentic, high-quality Japanese beauty and personal care products.\n\n` +
              `🎯 Our goal is your satisfaction and meeting your beauty needs with the best quality.\n\n` +
              `📞 Contact Us:\n` +
              `• Telegram: @${this.adminTelegramUser}\n\n` +
              `🙏 Thank you for trusting us!`;

        await this.bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text:
                    language === 'fa'
                      ? '📸 صفحه اینستاگرام ما'
                      : '📸 Our Instagram Page',
                  url: process.env.ADMIN_INSTAGRAM_ACCOUNT,
                },
              ],
            ],
          },
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

  async editMessageAndAnswer(
    callbackQueryId: string,
    chatId: number,
    messageId: number,
    text: string,
    options?: {
      reply_markup?: TelegramBot.InlineKeyboardMarkup;
      parse_mode?: 'HTML' | 'Markdown';
      callback_text?: string;
      show_alert?: boolean;
    },
  ): Promise<void> {
    await this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: options?.reply_markup,
      parse_mode: options?.parse_mode,
    });

    await this.bot.answerCallbackQuery(callbackQueryId, {
      text: options?.callback_text,
      show_alert: options?.show_alert,
    });
  }
}
