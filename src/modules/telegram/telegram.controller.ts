import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  // @Post('webhook')
  // @HttpCode(200)
  // async handleWebhook(@Body() update: TelegramBot.Update) {
  //   await this.telegramService.handleWebhookUpdate(update);
  //   return {};
  // }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() update: TelegramBot.Update) {
    // Adding a logger here is still a good idea for final confirmation
    Logger.log('Webhook hit success!', 'TelegramController');
    await this.telegramService.handleWebhookUpdate(update);
    return {};
  }
}
