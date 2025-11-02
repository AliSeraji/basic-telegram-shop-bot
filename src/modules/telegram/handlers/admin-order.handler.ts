import * as TelegramBot from 'node-telegram-bot-api';
import { OrderService } from '../../order/order.service';
import { TelegramService } from '../telegram.service';
import { formatAdminOrderDetails } from '../utils/helpers';
import { ORDER_STATUS, ORDERSTATTEXT } from 'src/common/constants';

export async function handleManageOrders(
  chatId: number,
  language: string,
  telegramService: TelegramService,
): Promise<void> {
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [
      {
        text: language === 'fa' ? '📋 همه سفارشات' : '📋 All Orders',
        callback_data: 'admin_orders_all_1_0',
      },
    ],
    [
      {
        text: language === 'fa' ? '⏳ در انتظار' : '⏳ Pending',
        callback_data: 'admin_orders_pending_1_0',
      },
      {
        text: language === 'fa' ? '💰 پرداخت شده' : '💰 Paid',
        callback_data: 'admin_orders_paid_1_0',
      },
    ],
    [
      {
        text: language === 'fa' ? '✅ تایید شده' : '✅ Validated',
        callback_data: 'admin_orders_payment_validated_1_0',
      },
      {
        text: language === 'fa' ? '❌ رد شده' : '❌ Invalidated',
        callback_data: 'admin_orders_payment_invalidated_1_0',
      },
    ],
    [
      {
        text: language === 'fa' ? '📦 ارسال شده' : '📦 Shipped',
        callback_data: 'admin_orders_shipped_1_0',
      },
      {
        text: language === 'fa' ? '✨ تحویل داده شده' : '✨ Delivered',
        callback_data: 'admin_orders_delivered_1_0',
      },
    ],
    [
      {
        text: language === 'fa' ? '🚫 لغو شده' : '🚫 Cancelled',
        callback_data: 'admin_orders_cancelled_1_0',
      },
    ],
    [
      {
        text: language === 'fa' ? '📸 با رسید' : '📸 With Receipt',
        callback_data: 'admin_orders_with_receipt_1_0',
      },
      {
        text: language === 'fa' ? '❌ بدون رسید' : '❌ Without Receipt',
        callback_data: 'admin_orders_without_receipt_1_0',
      },
    ],
  ];

  await telegramService.sendMessage(
    chatId,
    language === 'fa'
      ? '📦 مدیریت سفارشات\n\nلطفاً یک فیلتر انتخاب کنید:'
      : '📦 Manage Orders\n\nPlease select a filter:',
    {
      reply_markup: { inline_keyboard: keyboard },
    },
  );
}

export async function handleAdminOrdersList(
  data: string,
  chatId: number,
  messageId: number,
  queryId: string,
  language: string,
  orderService: OrderService,
  telegramService: TelegramService,
  bot: TelegramBot,
): Promise<void> {
  // Remove prefix and parse
  const withoutPrefix = data.replace('admin_orders_', '');
  const parts = withoutPrefix.split('_');

  let filterType: string;
  let page: number;
  let orderIndex: number;
  let status: string | undefined;
  let hasReceipt: boolean | undefined;

  // Handle compound filters
  if (
    parts[0] === 'payment' &&
    (parts[1] === 'validated' || parts[1] === 'invalidated')
  ) {
    // payment_validated or payment_invalidated
    filterType = `payment_${parts[1]}`;
    status = filterType;
    page = parseInt(parts[2]) || 1;
    orderIndex = parseInt(parts[3]) || 0;
  } else if (parts[0] === 'with' && parts[1] === 'receipt') {
    // with_receipt
    filterType = 'with_receipt';
    hasReceipt = true;
    page = parseInt(parts[2]) || 1;
    orderIndex = parseInt(parts[3]) || 0;
  } else if (parts[0] === 'without' && parts[1] === 'receipt') {
    // without_receipt
    filterType = 'without_receipt';
    hasReceipt = false;
    page = parseInt(parts[2]) || 1;
    orderIndex = parseInt(parts[3]) || 0;
  } else {
    // Simple filter: all, pending, paid, shipped, delivered, cancelled
    filterType = parts[0];
    page = parseInt(parts[1]) || 1;
    orderIndex = parseInt(parts[2]) || 0;

    if (filterType !== 'all') {
      status = filterType;
    }
  }

  const limit = 5;

  const { orders, total } = await orderService.getOrdersForAdmin(
    page,
    limit,
    status,
    hasReceipt,
  );

  if (!orders.length) {
    await bot.answerCallbackQuery(queryId, {
      text: language === 'fa' ? 'سفارشی یافت نشد' : 'No orders found',
      show_alert: false,
    });

    const noResultMessage =
      language === 'fa'
        ? '❌ سفارشی برای این فیلتر یافت نشد.\n\nلطفاً فیلتر دیگری را امتحان کنید.'
        : '❌ No orders found for this filter.\n\nPlease try another filter.';

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        {
          text:
            language === 'fa' ? '🔙 بازگشت به فیلترها' : '🔙 Back to Filters',
          callback_data: 'manage_orders',
        },
      ],
    ];

    try {
      await bot.editMessageText(noResultMessage, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      await telegramService.sendMessage(chatId, noResultMessage, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    return;
  }

  // Make sure orderIndex is within bounds
  if (orderIndex >= orders.length) {
    orderIndex = 0;
  }

  const totalPages = Math.ceil(total / limit);
  const order = orders[orderIndex];
  const totalOrders = total;
  const currentOrderNumber = (page - 1) * limit + orderIndex + 1;

  const message = formatAdminOrderDetails(order, language);

  // Build keyboard
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

  // View receipt button
  if (order.receiptImage) {
    keyboard.push([
      {
        text: language === 'fa' ? '📸 مشاهده رسید' : '📸 View Receipt',
        callback_data: `adm_rcpt_${order.id}_${filterType}_${page}_${orderIndex}`,
      },
    ]);

    // Payment actions
    keyboard.push([
      {
        text: language === 'fa' ? '✅ تایید پرداخت' : '✅ Approve Payment',
        callback_data: `app_pay_${order.id}_${filterType}_${page}_${orderIndex}`,
      },
      {
        text: language === 'fa' ? '❌ رد پرداخت' : '❌ Reject Payment',
        callback_data: `rej_pay_${order.id}_${filterType}_${page}_${orderIndex}`,
      },
    ]);
  }

  // Change status button
  keyboard.push([
    {
      text: language === 'fa' ? '🔄 تغییر وضعیت' : '🔄 Change Status',
      callback_data: `adm_chg_${order.id}_${filterType}_${page}_${orderIndex}`,
    },
  ]);

  // Navigation between orders
  const navButtons: TelegramBot.InlineKeyboardButton[] = [];

  // Previous order
  if (orderIndex > 0) {
    navButtons.push({
      text: '◀️',
      callback_data: `admin_orders_${filterType}_${page}_${orderIndex - 1}`,
    });
  } else if (page > 1) {
    navButtons.push({
      text: '◀️',
      callback_data: `admin_orders_${filterType}_${page - 1}_4`,
    });
  }

  // Current position indicator
  navButtons.push({
    text: `${currentOrderNumber}/${totalOrders}`,
    callback_data: 'noop',
  });

  // Next order
  if (orderIndex < orders.length - 1) {
    navButtons.push({
      text: '▶️',
      callback_data: `admin_orders_${filterType}_${page}_${orderIndex + 1}`,
    });
  } else if (page < totalPages) {
    navButtons.push({
      text: '▶️',
      callback_data: `admin_orders_${filterType}_${page + 1}_0`,
    });
  }

  if (navButtons.length > 0) {
    keyboard.push(navButtons);
  }

  // Back button
  keyboard.push([
    {
      text: language === 'fa' ? '🔙 بازگشت' : '🔙 Back',
      callback_data: 'manage_orders',
    },
  ]);

  await telegramService.editMessageAndAnswer(
    queryId,
    chatId,
    messageId,
    message,
    {
      reply_markup: { inline_keyboard: keyboard },
    },
  );
}

export async function handleAdminChangeStatus(
  data: string,
  chatId: number,
  messageId: number,
  queryId: string,
  language: string,
  bot: TelegramBot,
): Promise<void> {
  // Format: adm_chg_{orderId}_{filterType}_{page}_{orderIndex}
  const parts = data.split('_');
  const orderId = parseInt(parts[2]);
  const filterType = parts[3];
  const page = parts[4];
  const orderIndex = parts[5];

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [
      {
        text: language === 'fa' ? '⏳ در انتظار' : '⏳ Pending',
        callback_data: `adm_sts_${orderId}_pnd_${filterType}_${page}_${orderIndex}`,
      },
      {
        text: language === 'fa' ? '💰 پرداخت شده' : '💰 Paid',
        callback_data: `adm_sts_${orderId}_pd_${filterType}_${page}_${orderIndex}`,
      },
    ],
    [
      {
        text: language === 'fa' ? '✅ تایید شده' : '✅ Validated',
        callback_data: `adm_sts_${orderId}_pv_${filterType}_${page}_${orderIndex}`,
      },
      {
        text: language === 'fa' ? '❌ رد شده' : '❌ Invalidated',
        callback_data: `adm_sts_${orderId}_pi_${filterType}_${page}_${orderIndex}`,
      },
    ],
    [
      {
        text: language === 'fa' ? '📦 ارسال شده' : '📦 Shipped',
        callback_data: `adm_sts_${orderId}_shp_${filterType}_${page}_${orderIndex}`,
      },
      {
        text: language === 'fa' ? '✨ تحویل داده شده' : '✨ Delivered',
        callback_data: `adm_sts_${orderId}_dlv_${filterType}_${page}_${orderIndex}`,
      },
    ],
    [
      {
        text: language === 'fa' ? '🚫 لغو شده' : '🚫 Cancelled',
        callback_data: `adm_sts_${orderId}_cnl_${filterType}_${page}_${orderIndex}`,
      },
    ],
    [
      {
        text: language === 'fa' ? '🔙 بازگشت' : '🔙 Back',
        callback_data: `admin_orders_${filterType}_${page}_${orderIndex}`,
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

export async function handleAdminSetStatus(
  data: string,
  chatId: number,
  messageId: number,
  queryId: string,
  language: string,
  orderService: OrderService,
  telegramService: TelegramService,
  bot: TelegramBot,
): Promise<void> {
  // Format: adm_sts_{orderId}_{statusCode}_{filterType}_{page}_{orderIndex}
  const parts = data.split('_');
  const orderId = parseInt(parts[2]);
  const statusCode = parts[3];
  const filterType = parts[4];
  const page = parts[5];
  const orderIndex = parts[6];

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

  // Go back to the order list at the same position
  const callbackData = `admin_orders_${filterType}_${page}_${orderIndex}`;

  // Re-fetch and display
  await handleAdminOrdersList(
    callbackData,
    chatId,
    messageId,
    queryId,
    language,
    orderService,
    telegramService,
    bot,
  );
}

export async function handleAdminViewReceipt(
  data: string,
  chatId: number,
  queryId: string,
  language: string,
  orderService: OrderService,
  bot: TelegramBot,
): Promise<void> {
  try {
    // Format: adm_rcpt_{orderId}_{filterType}_{page}_{orderIndex}
    const parts = data.split('_');
    console.log('handleAdminViewReceipt - data:', data);
    console.log('handleAdminViewReceipt - parts:', parts);

    const orderId = parseInt(parts[2]);
    const filterType = parts[3];
    const page = parts[4];
    const orderIndex = parts[5];

    if (isNaN(orderId)) {
      console.error('Invalid orderId in handleAdminViewReceipt:', parts[2]);
      await bot.answerCallbackQuery(queryId, {
        text:
          language === 'fa' ? 'خطا در پردازش سفارش' : 'Error processing order',
        show_alert: true,
      });
      return;
    }

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
              callback_data: `app_pay_${orderId}_${filterType}_${page}_${orderIndex}`,
            },
            {
              text: language === 'fa' ? '❌ رد' : '❌ Reject',
              callback_data: `rej_pay_${orderId}_${filterType}_${page}_${orderIndex}`,
            },
          ],
          [
            {
              text: language === 'fa' ? '🔙 بازگشت' : '🔙 Back',
              callback_data: `admin_orders_${filterType}_${page}_${orderIndex}`,
            },
          ],
        ],
      },
    });

    await bot.answerCallbackQuery(queryId);
  } catch (error) {
    console.error('Error in handleAdminViewReceipt:', error);
    throw error;
  }
}
