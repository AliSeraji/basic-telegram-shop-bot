import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { OrderService } from '../order/order.service';
import { DeliveryService } from '../delivery/delivery.service';
import { formatOrderList } from './utils/helpers';
import { getMainKeyboard } from './utils/keyboards';
import * as https from 'https';

@Injectable()
export class TelegramService {
  private bot: Telegraf;
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
    this.adminTelegramUser =
      this.configService.get<string>('ADMIN_TELEGRAM_USERNAME') || 'Afinename';

    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined in .env file');
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    this.logger.log('Initializing Telegram bot...');

    // Create custom HTTPS agent with longer timeout and keepAlive
    const agent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 10000,
      timeout: 60000,
      family: 4, // Force IPv4
    });

    // Initialize bot with custom agent
    this.bot = new Telegraf(token, {
      telegram: {
        agent: agent,
        apiRoot: 'https://api.telegram.org',
      },
    });

    // Setup all command handlers
    this.setupCommands();

    // Check mode: polling vs webhook
    const usePolling = this.configService.get<string>('USE_POLLING') === 'true';

    if (usePolling) {
      this.logger.log(
        '🤖 Starting bot in POLLING mode (no webhook/ngrok needed)...',
      );

      // Graceful shutdown handlers
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));

      // Add delay before starting polling
      setTimeout(() => {
        this.bot
          .launch({
            dropPendingUpdates: true,
            allowedUpdates: ['message', 'callback_query', 'inline_query'],
          })
          .then(() => {
            this.logger.log('✅ Bot is now running in POLLING mode!');
            this.logger.log('💬 Send /start to your bot to test it');
          })
          .catch((err) => {
            this.logger.error(`❌ Failed to start polling: ${err.message}`);
            this.logger.error('Full error:', err);
            this.logger.warn('🔧 Troubleshooting steps:');
            this.logger.warn(
              '1. Check if you can access: https://api.telegram.org in browser',
            );
            this.logger.warn('2. Try disabling antivirus/firewall temporarily');
            this.logger.warn('3. Check if VPN is blocking Telegram');
            this.logger.warn(
              '4. Run: curl https://api.telegram.org/bot' + token + '/getMe',
            );
          });
      }, 2000);
    } else {
      const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
      if (webhookUrl) {
        this.logger.log('🌐 Starting bot in WEBHOOK mode...');
        this.setupWebhook(webhookUrl);
      } else {
        this.logger.error(
          '⚠️ No mode configured! Set USE_POLLING=true or WEBHOOK_URL in .env',
        );
      }
    }
  }

  private async setupWebhook(webhookUrl: string) {
    try {
      this.logger.log(`Setting webhook to ${webhookUrl}`);
      const startTime = Date.now();
      await this.bot.telegram.setWebhook(webhookUrl);
      const duration = Date.now() - startTime;
      this.logger.log(`Webhook set successfully in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Failed to set webhook: ${error.message}`);
      this.logger.warn(
        'App will continue without webhook. Bot may not receive updates.',
      );
      // Don't throw - just log and continue
    }
  }

  private setupCommands() {
    this.bot.hears(/👤 My profile| پروفایل من👤 /, async (ctx) => {
      const chatId = ctx.chat.id;
      const telegramId = ctx.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const message = `${language === 'fa' ? '👤 My profile' : 'پروفایل من👤'}\n${language === 'fa' ? 'نام' : 'Name'}: ${user.fullName}\n${language === 'fa' ? 'شماره تلفن' : 'PhoneNumber'}: ${user.phone || (language === 'fa' ? 'وارد نشده' : 'Not Specified')}\nTelegram ID: ${user.telegramId}`;
        await ctx.reply(message, {
          reply_markup: getMainKeyboard(!user.phone, language),
        });
      } catch (error) {
        this.logger.error(`Error in profile: ${error.message}`);
        const language =
          (await this.userService.findByTelegramId(telegramId))?.language ||
          'fa';
        await ctx.reply(
          language === 'fa'
            ? 'هنگام دریافت اطلاعات پروفایل خطایی رخ داد'
            : 'Error while retrieving profile data',
        );
      }
    });

    this.bot.hears(/تاریخچه سفارش🕘|🕘 Order history/, async (ctx) => {
      const chatId = ctx.chat.id;
      const telegramId = ctx.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const orders = await this.orderService.getUserOrders(telegramId);
        const message = orders.length
          ? formatOrderList(orders, language)
          : language === 'fa'
            ? 'هیچ سفارشی موجود نیست'
            : 'No orders';
        await ctx.reply(
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
        await ctx.reply(
          language === 'fa'
            ? 'هنگام دریافت تاریخچه سفارش خطایی رخ داد'
            : 'Error while retrieving order history',
        );
      }
    });

    this.bot.hears(/درباره ماℹ️|ℹ️ About us/, async (ctx) => {
      const chatId = ctx.chat.id;
      try {
        const user = await this.userService.findByTelegramId(
          ctx.from.id.toString(),
        );
        const language = user.language || 'fa';
        const message = `${language === 'fa' ? 'درباره ماℹ️' : 'ℹ️ About us'}\n${language === 'fa' ? 'ما یک فروشگاه آنلاین هستیم که محصولات باکیفیت آرایشی بهداشتی ژاپن را ارائه میدهیم' : 'We are an online store offering beauty products from Japan.'}\n${language === 'fa' ? 'تماس' : 'Contact'}: @${this.adminTelegramUser}\n${language === 'fa' ? 'پیج اینستاگرام' : 'Instagram page'}: https://yourshop.uz`;
        await ctx.reply(message, {
          reply_markup: getMainKeyboard(false, language),
        });
      } catch (error) {
        this.logger.error(`Error in about: ${error.message}`);
        const language =
          (await this.userService.findByTelegramId(ctx.from.id.toString()))
            ?.language || 'fa';
        await ctx.reply(
          language === 'fa'
            ? 'هنگام دریافت اطلاعات درباره ما خطایی رخ داد'
            : 'An error occurred while retrieving information about us',
        );
      }
    });
  }

  getBotInstance(): Telegraf {
    return this.bot;
  }

  async onModuleDestroy() {
    this.logger.log('Stopping Telegram bot...');
    await this.bot.stop();
  }

  async handleWebhookUpdate(update: Update) {
    try {
      const startTime = Date.now();
      await this.bot.handleUpdate(update);
      const duration = Date.now() - startTime;
      this.logger.log(`Webhook update processed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Webhook update failed: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(chatId: number | string, text: string, options: any = {}) {
    try {
      const finalOptions = {
        ...options,
        parse_mode: options.parse_mode ?? 'HTML',
      };

      await this.bot.telegram.sendMessage(chatId, text, finalOptions);
    } catch (error) {
      this.logger.error(
        `Error sending message to chatId ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendPhoto(chatId: number, photo: string, options?: any) {
    try {
      await this.bot.telegram.sendPhoto(chatId, photo, {
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

  async sendChatAction(chatId: string | number, action: string) {
    try {
      await this.bot.telegram.sendChatAction(chatId, action as any);
    } catch (error) {
      this.logger.error(
        `Error sending chat action to chatId ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }
}
