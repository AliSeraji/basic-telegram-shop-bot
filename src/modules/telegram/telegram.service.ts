import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { OrderService } from '../order/order.service';
import { DeliveryService } from '../delivery/delivery.service';
import { formatOrderList } from './utils/helpers';
import { getMainKeyboard } from './utils/keyboards';

import TelegramBot = require('node-telegram-bot-api');
import { profileMessage } from './constants';

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private logger = new Logger(TelegramService.name);
  private readonly adminTelegramUser: string;
  private userEditStates = new Map<string, { field: string }>();
  private token?: string;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private deliveryService: DeliveryService,
  ) {
    this.token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.adminTelegramUser =
      this.configService.get<string>('ADMIN_TELEGRAM_USERNAME') || 'AfineName';

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

      if (text) {
        this.logger.log(`[DIAGNOSTIC] Received text: ${text} from ${chatId}`);
      }

      // Handle profile editing states
      if (telegramId && this.userEditStates.has(telegramId)) {
        const state = this.userEditStates.get(telegramId);

        // Check state immediately after getting it
        if (!state || !text) return;

        const validProfileFields = ['fullName', 'phone', 'email', 'address'];
        if (!validProfileFields.includes(state.field)) {
          return;
        }

        try {
          const user = await this.userService.findByTelegramId(telegramId);
          const language = user.language || 'fa';

          // Update the specific field
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

          // Clear the state
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
        return; // Don't process other handlers
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
              `📝 نام: ${user.fullName || 'وارد نشده'}\n` +
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
          [
            {
              text:
                language === 'fa'
                  ? '🏠 بازگشت به منوی اصلی'
                  : '🏠 Return to Main Menu',
              callback_data: 'return_to_main_menu',
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

    // Handle profile edit callbacks
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

        // Set the edit state
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

    // Handle return to main menu
    this.bot.on('callback_query', async (query) => {
      if (query.data !== 'return_to_main_menu') return;
      if (!query.message?.chat?.id || !query.from) return;

      const chatId = query.message.chat.id;
      const telegramId = query.from.id.toString();

      try {
        // Clear any edit state
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
        const orders = await this.orderService.getUserOrders(telegramId);
        const message = orders.length
          ? formatOrderList(orders, language)
          : language === 'fa'
            ? 'هیچ سفارشی موجود نیست'
            : 'No orders';
        await this.bot.sendMessage(
          chatId,
          `${language === 'fa' ? '🕘 تاریخچه سفارشات' : '🕘 Order history'}\n${message}`,
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

    this.bot.onText(/ℹ️ درباره ما|ℹ️ About Us/i, async (msg) => {
      if (!msg.from) return;
      const chatId = msg.chat.id;
      try {
        const user = await this.userService.findByTelegramId(
          msg.from.id.toString(),
        );
        const language = user.language || 'fa';
        const message = `${language === 'fa' ? 'ℹ️ درباره ما' : 'ℹ️ About us'}\n\n${language === 'fa' ? 'ما یک فروشگاه آنلاین هستیم که محصولات باکیفیت آرایشی بهداشتی ژاپن را ارائه میدهیم' : 'We are an online store offering beauty products from Japan.'}\n\n${language === 'fa' ? 'تماس' : 'Contact'}: @${this.adminTelegramUser}\n${language === 'fa' ? 'پیج اینستاگرام' : 'Instagram page'}: https://yourshop.uz`;
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
