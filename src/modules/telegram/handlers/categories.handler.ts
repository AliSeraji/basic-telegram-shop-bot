import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { CategoryService } from '../../category/category.service';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class CategoriesHandler {
  private logger = new Logger(CategoriesHandler.name);

  constructor(
    private categoryService: CategoryService,
    private telegramService: TelegramService,
    private userService: UserService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();
    bot.onText(/📁 (دسته‌بندی‌ها|Categories)/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        this.logger.log(`Processing categories for telegramId: ${telegramId}`);
        const startTime = Date.now();
        const categories = await this.categoryService.findAll();
        const duration = Date.now() - startTime;
        this.logger.log(
          `Fetched ${categories.length} categories in ${duration}ms`,
        );
        const keyboard = categories.map((cat) => [
          {
            text: language === 'fa' ? cat.name : cat.nameFa || cat.name,
            callback_data: `category_${cat.id}`,
          },
        ]);
        const message =
          language === 'fa' ? 'دسته‌بندی را انتخاب کنید:' : 'Select category:';
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch (error) {
        this.logger.error(`Error in categories: ${error.message}`);
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const message =
          language === 'fa'
            ? 'خطا در دریافت دسته‌بندی‌ها رخ داد.'
            : 'Error occurred while getting categories.';
        await this.telegramService.sendMessage(chatId, message);
      }
    });
  }
}
