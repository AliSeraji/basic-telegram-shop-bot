import * as TelegramBot from 'node-telegram-bot-api';
import { OrderService } from '../../order/order.service';
import { TelegramService } from '../telegram.service';
import { formatAdminOrderDetails } from '../utils/helpers';
import { getAdminKeyboard } from '../utils/keyboards';
import { ORDER_STATUS, ORDERSTATTEXT } from 'src/common/constants';

export async function handleSearchOrder(
  bot: TelegramBot,
  chatId: number,
  language: string,
  orderService: OrderService,
  telegramService: TelegramService,
  logger: any,
): Promise<void> {
  const message =
    language === 'fa'
      ? '🔍 کد پیگیری سفارش را وارد کنید:'
      : '🔍 Enter order tracking number:';

  await telegramService.sendMessage(chatId, message, {
    reply_markup: { force_reply: true },
  });

  bot.once('message', async (msg) => {
    if (!msg.text) return;

    if (msg.text.startsWith('/') || !msg.text.startsWith('TRK')) {
      const message = 'چنین کد پیگیری معتبر نیست ❌';
      await telegramService.sendMessage(chatId, message, {
        reply_markup: getAdminKeyboard(language),
      });
      return;
    }

    try {
      const trackingNumber = msg.text.trim();
      const order = await orderService.findByTrackingNumber(trackingNumber);

      if (!order) {
        const notFoundMessage =
          language === 'fa'
            ? `❌ سفارشی با کد پیگیری "${trackingNumber}" یافت نشد.`
            : `❌ No order found with tracking number "${trackingNumber}".`;

        await telegramService.sendMessage(chatId, notFoundMessage, {
          reply_markup: getAdminKeyboard(language),
        });
        return;
      }

      // Show order details
      const orderDetails = formatAdminOrderDetails(order, language);

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      // View receipt button
      if (order.receiptImage) {
        keyboard.push([
          {
            text: language === 'fa' ? '📸 مشاهده رسید' : '📸 View Receipt',
            callback_data: `adm_rcpt_s_${order.id}`,
          },
        ]);

        // Payment actions
        keyboard.push([
          {
            text: language === 'fa' ? '✅ تایید پرداخت' : '✅ Approve Payment',
            callback_data: `app_pay_s_${order.id}`,
          },
          {
            text: language === 'fa' ? '❌ رد پرداخت' : '❌ Reject Payment',
            callback_data: `rej_pay_s_${order.id}`,
          },
        ]);
      }

      // Change status button
      keyboard.push([
        {
          text: language === 'fa' ? '🔄 تغییر وضعیت' : '🔄 Change Status',
          callback_data: `adm_chg_s_${order.id}`,
        },
      ]);

      await telegramService.sendMessage(chatId, orderDetails, {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in search_order: ${error.message}`);
      const errorMessage =
        language === 'fa'
          ? '❌ خطا در جستجوی سفارش رخ داد.'
          : '❌ Error occurred while searching order.';
      await telegramService.sendMessage(chatId, errorMessage, {
        reply_markup: getAdminKeyboard(language),
      });
    }
  });
}

export async function handleAdminViewReceiptSingle(
  data: string,
  chatId: number,
  queryId: string,
  language: string,
  orderService: OrderService,
  bot: TelegramBot,
): Promise<void> {
  // Format: adm_rcpt_s_{orderId}
  const orderId = parseInt(data.split('_')[3]);
  const order = await orderService.findOne(orderId);

  if (!order.receiptImage) {
    await bot.answerCallbackQuery(queryId, {
      text: language === 'fa' ? 'رسیدی وجود ندارد' : 'No receipt available',
      show_alert: true,
    });
    return;
  }

  await bot.sendPhoto(chatId, order.receiptImage, {
    caption: formatAdminOrderDetails(order, language),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: language === 'fa' ? '✅ تایید' : '✅ Approve',
            callback_data: `app_pay_s_${orderId}`,
          },
          {
            text: language === 'fa' ? '❌ رد' : '❌ Reject',
            callback_data: `rej_pay_s_${orderId}`,
          },
        ],
      ],
    },
  });

  await bot.answerCallbackQuery(queryId);
}

export async function handleAdminChangeStatusSingle(
  data: string,
  chatId: number,
  messageId: number,
  queryId: string,
  language: string,
  bot: TelegramBot,
): Promise<void> {
  // Format: adm_chg_s_{orderId}
  const orderId = parseInt(data.split('_')[3]);

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [
      {
        text: language === 'fa' ? '⏳ در انتظار' : '⏳ Pending',
        callback_data: `adm_sts_s_${orderId}_pnd`,
      },
      {
        text: language === 'fa' ? '💰 پرداخت شده' : '💰 Paid',
        callback_data: `adm_sts_s_${orderId}_pd`,
      },
    ],
    [
      {
        text: language === 'fa' ? '✅ تایید شده' : '✅ Validated',
        callback_data: `adm_sts_s_${orderId}_pv`,
      },
      {
        text: language === 'fa' ? '❌ رد شده' : '❌ Invalidated',
        callback_data: `adm_sts_s_${orderId}_pi`,
      },
    ],
    [
      {
        text: language === 'fa' ? '📦 ارسال شده' : '📦 Shipped',
        callback_data: `adm_sts_s_${orderId}_shp`,
      },
      {
        text: language === 'fa' ? '✨ تحویل داده شده' : '✨ Delivered',
        callback_data: `adm_sts_s_${orderId}_dlv`,
      },
    ],
    [
      {
        text: language === 'fa' ? '🚫 لغو شده' : '🚫 Cancelled',
        callback_data: `adm_sts_s_${orderId}_cnl`,
      },
    ],
  ];

  await bot.editMessageReplyMarkup(
    { inline_keyboard: keyboard },
    {
      chat_id: chatId,
      message_id: messageId,
    },
  );

  await bot.answerCallbackQuery(queryId);
}

export async function handleAdminSetStatusSingle(
  data: string,
  chatId: number,
  messageId: number,
  queryId: string,
  language: string,
  orderService: OrderService,
  telegramService: TelegramService,
  bot: TelegramBot,
): Promise<void> {
  // Format: adm_sts_s_{orderId}_{statusCode}
  const parts = data.split('_');
  const orderId = parseInt(parts[3]);
  const statusCode = parts[4];

  // Map short codes to full status values
  const statusMap: Record<string, string> = {
    pnd: ORDER_STATUS.PENDING,
    pd: ORDER_STATUS.PAID,
    pv: ORDER_STATUS.PAYMENT_VALIDATED,
    pi: ORDER_STATUS.PAYMENT_INVALIDATED,
    shp: ORDER_STATUS.SHIPPED,
    dlv: ORDER_STATUS.DELIVERED,
    cnl: ORDER_STATUS.CANCELLED,
  };

  const newStatus = statusMap[statusCode];

  await orderService.updateOrderStatus(orderId, newStatus as any);

  const order = await orderService.findOne(orderId);

  await bot.answerCallbackQuery(queryId, {
    text: language === 'fa' ? '✅ وضعیت تغییر کرد' : '✅ Status updated',
  });

  // Notify user
  const userLanguage = order.user.language || 'fa';
  let statusText = newStatus;
  if (userLanguage === 'fa') {
    switch (newStatus) {
      case ORDER_STATUS.PENDING:
        statusText = ORDERSTATTEXT.PENDING;
        break;
      case ORDER_STATUS.PAID:
        statusText = ORDERSTATTEXT.PAID;
        break;
      case ORDER_STATUS.PAYMENT_VALIDATED:
        statusText = ORDERSTATTEXT.PAYMENT_VALIDATED;
        break;
      case ORDER_STATUS.PAYMENT_INVALIDATED:
        statusText = ORDERSTATTEXT.PAYMENT_INVALIDATED;
        break;
      case ORDER_STATUS.SHIPPED:
        statusText = ORDERSTATTEXT.SHIPPED;
        break;
      case ORDER_STATUS.DELIVERED:
        statusText = ORDERSTATTEXT.DELIVERED;
        break;
      case ORDER_STATUS.CANCELLED:
        statusText = ORDERSTATTEXT.CANCELLED;
        break;
    }
  }

  await telegramService.sendMessage(
    order.user.telegramId,
    userLanguage === 'fa'
      ? `📦 وضعیت سفارش شما تغییر کرد\n\nکد پیگیری: ${order.trackingNumber}\nوضعیت جدید: ${statusText}`
      : `📦 Your order status changed\n\nTracking: ${order.trackingNumber}\nNew status: ${statusText}`,
  );

  // Update the message to show new status
  const updatedMessage = formatAdminOrderDetails(order, language);
  await bot.editMessageText(updatedMessage, {
    chat_id: chatId,
    message_id: messageId,
  });
}
