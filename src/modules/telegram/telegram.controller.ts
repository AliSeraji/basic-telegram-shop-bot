import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { Update } from 'telegraf/typings/core/types/typegram';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() update: Update) {
    await this.telegramService.handleWebhookUpdate(update);
    return {};
  }
}
