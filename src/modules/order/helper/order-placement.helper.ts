import { Logger } from '@nestjs/common';
import { OrderService } from '../order.service';
import { UserService } from '../../user/user.service';
import { TelegramService } from '../../telegram/telegram.service';
import { CartService } from '../../cart/cart.service';
import TelegramBot = require('node-telegram-bot-api');

const logger = new Logger('OrderPlacementHelper');

// Store pending receipt uploads (orderId -> { chatId, telegramId, language })
const pendingReceipts = new Map<
  number,
  { chatId: number; telegramId: string; language: string }
>();

// Bank account information
const BANK_ACCOUNT = {
  accountNumber: '1234567890123456',
  accountHolder: 'نام فروشگاه',
  bankName: 'بانک ملی',
  iban: 'IR1234567890123456789012',
};

export async function startOrderPlacement(
  bot: TelegramBot,
  chatId: number,
  telegramId: string,
  language: string,
  telegramService: TelegramService,
  orderService: OrderService,
  userService: UserService,
  cartService: CartService,
): Promise<void> {
  try {
    const user = await userService.findByTelegramId(telegramId);
    if (!user) {
      const message =
        language === 'fa' ? '❌ کاربر یافت نشد.' : '❌ User not found.';
      await telegramService.sendMessage(chatId, message);
      return;
    }

    const cartItems = await cartService.getCartItems(telegramId);
    if (!cartItems || cartItems.length === 0) {
      const message =
        language === 'fa'
          ? '❌ سبد خرید شما خالی است.'
          : '❌ Your cart is empty.';
      await telegramService.sendMessage(chatId, message);
      return;
    }

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    const itemsList = cartItems
      .map(
        (item) =>
          `${item.product.name} - ${item.quantity} عدد - ${(item.product.price * item.quantity).toLocaleString('fa-IR')} تومان`,
      )
      .join('\n');

    const confirmMessage =
      language === 'fa'
        ? `📋 لطفاً اطلاعات سفارش خود را بررسی کنید:\n\n` +
          `👤 نام: ${user.fullName || 'وارد نشده'}\n` +
          `📞 تلفن: ${user.phone || 'وارد نشده'}\n` +
          `📍 آدرس: ${user.userAddress || 'وارد نشده'}\n\n` +
          `🛒 محصولات:\n${itemsList}\n\n` +
          `💰 مجموع: ${totalAmount.toLocaleString('fa-IR')} تومان\n\n` +
          `آیا اطلاعات صحیح است؟`
        : `📋 Please review your order:\n\n` +
          `👤 Name: ${user.fullName || 'Not provided'}\n` +
          `📞 Phone: ${user.phone || 'Not provided'}\n` +
          `📍 Address: ${user.userAddress || 'Not provided'}\n\n` +
          `🛒 Products:\n${itemsList}\n\n` +
          `💰 Total: ${totalAmount.toLocaleString()} Toman\n\n` +
          `Is the information correct?`;

    await telegramService.sendMessage(chatId, confirmMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: language === 'fa' ? '✅ تایید و ادامه' : '✅ Confirm',
              callback_data: 'confirm_order_info',
            },
          ],
          [
            {
              text: language === 'fa' ? '✏️ ویرایش اطلاعات' : '✏️ Edit Info',
              callback_data: 'edit_user_info',
            },
          ],
          [
            {
              text: language === 'fa' ? '❌ انصراف' : '❌ Cancel',
              callback_data: 'cancel_order',
            },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error(`Error in startOrderPlacement: ${error.message}`);
    const message =
      language === 'fa'
        ? '❌ خطایی رخ داد، لطفاً دوباره تلاش کنید.'
        : '❌ An error occurred, please try again.';
    await telegramService.sendMessage(chatId, message);
  }
}

export async function confirmOrderAndRequestPayment(
  bot: TelegramBot,
  chatId: number,
  telegramId: string,
  language: string,
  telegramService: TelegramService,
  orderService: OrderService,
  cartService: CartService,
): Promise<void> {
  try {
    const order = await orderService.createOrder(telegramId);
    await cartService.clearCart(telegramId);

    const trackingNumber = `TRK${Date.now()}${order.id}`;
    await orderService.update(order.id, { trackingNumber });

    pendingReceipts.set(order.id, { chatId, telegramId, language });

    await showPaymentInstructions(
      order.id,
      order.totalAmount,
      trackingNumber,
      chatId,
      language,
      telegramService,
    );
  } catch (error) {
    logger.error(`Error in confirmOrderAndRequestPayment: ${error.message}`);
    const message =
      language === 'fa'
        ? '❌ خطایی در ثبت سفارش رخ داد.'
        : '❌ Error creating order.';
    await telegramService.sendMessage(chatId, message);
  }
}

export async function showPaymentInstructions(
  orderId: number,
  totalAmount: number,
  trackingNumber: string,
  chatId: number,
  language: string,
  telegramService: TelegramService,
): Promise<void> {
  const paymentMessage =
    language === 'fa'
      ? `✅ سفارش شما ثبت شد!\n\n` +
        `📦 کد پیگیری: ${trackingNumber}\n` +
        `💰 مبلغ قابل پرداخت: ${totalAmount.toLocaleString('fa-IR')} تومان\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💳 اطلاعات حساب:\n` +
        `🏦 بانک: ${BANK_ACCOUNT.bankName}\n` +
        `👤 صاحب حساب: ${BANK_ACCOUNT.accountHolder}\n` +
        `💳 شماره حساب: ${BANK_ACCOUNT.accountNumber}\n` +
        `💳 شبا: ${BANK_ACCOUNT.iban}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `📸 لطفاً پس از واریز، عکس رسید را ارسال کنید.\n\n` +
        `⚠️ فقط عکس رسید واریز را ارسال کنید.`
      : `✅ Your order has been registered!\n\n` +
        `📦 Tracking number: ${trackingNumber}\n` +
        `💰 Amount: ${totalAmount.toLocaleString()} Toman\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💳 Account information:\n` +
        `🏦 Bank: ${BANK_ACCOUNT.bankName}\n` +
        `👤 Account holder: ${BANK_ACCOUNT.accountHolder}\n` +
        `💳 Account number: ${BANK_ACCOUNT.accountNumber}\n` +
        `💳 IBAN: ${BANK_ACCOUNT.iban}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `📸 Please send the receipt photo after payment.\n\n` +
        `⚠️ Only send the payment receipt photo.`;

  await telegramService.sendMessage(chatId, paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: language === 'fa' ? '📸 آپلود رسید' : '📸 Upload Receipt',
            callback_data: `upload_receipt_${orderId}`,
          },
        ],
        [
          {
            text:
              language === 'fa'
                ? '💳 نمایش اطلاعات حساب'
                : '💳 Show Account Info',
            callback_data: `show_bank_info_${orderId}`,
          },
        ],
        [
          {
            text: language === 'fa' ? '📦 وضعیت سفارش' : '📦 Order Status',
            callback_data: `check_order_status_${orderId}`,
          },
        ],
      ],
    },
  });
}

export async function handleReceiptUpload(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  orderService: OrderService,
  telegramService: TelegramService,
  userService: UserService,
): Promise<void> {
  try {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString() || '';

    let orderId: number | null = null;
    let language = 'fa';

    for (const [oid, info] of pendingReceipts.entries()) {
      if (info.telegramId === telegramId) {
        orderId = oid;
        language = info.language;
        break;
      }
    }

    if (!orderId) {
      const message =
        language === 'fa'
          ? '❌ سفارشی برای آپلود رسید یافت نشد. لطفاً ابتدا سفارش خود را ثبت کنید.'
          : '❌ No order found for receipt upload. Please place an order first.';
      await telegramService.sendMessage(chatId, message);
      return;
    }

    if (!msg.photo || msg.photo.length === 0) {
      const message =
        language === 'fa'
          ? '❌ لطفاً فقط عکس رسید را ارسال کنید.\n\nاگر می‌خواهید رسید را مجدداً ارسال کنید، از دکمه زیر استفاده کنید.'
          : '❌ Please send only the receipt photo.\n\nIf you want to resend the receipt, use the button below.';

      await telegramService.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: language === 'fa' ? '📸 آپلود رسید' : '📸 Upload Receipt',
                callback_data: `upload_receipt_${orderId}`,
              },
            ],
          ],
        },
      });
      return;
    }

    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;

    const stream = bot.getFileStream(fileId);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    const receiptImage = Buffer.concat(chunks);

    await orderService.update(orderId, {
      receiptImage,
      receiptImageMimeType: 'image/jpeg',
    });

    pendingReceipts.delete(orderId);

    const order = await orderService.findOne(orderId);

    const successMessage =
      language === 'fa'
        ? `✅ رسید شما دریافت شد!\n\n` +
          `📦 کد پیگیری: ${order.trackingNumber}\n\n` +
          `سفارش شما در حال بررسی است و پس از تایید پرداخت، به شما اطلاع داده خواهد شد.\n\n` +
          `از خرید شما متشکریم! 🙏`
        : `✅ Receipt received!\n\n` +
          `📦 Tracking number: ${order.trackingNumber}\n\n` +
          `Your order is being reviewed and you will be notified after payment confirmation.\n\n` +
          `Thank you for your purchase! 🙏`;

    await telegramService.sendMessage(chatId, successMessage);

    await orderService.notifyAdminsOfNewOrder(bot, orderId, receiptImage);
  } catch (error) {
    logger.error(`Error in handleReceiptUpload: ${error.message}`);
    const message = '❌ خطایی در آپلود رسید رخ داد.';
    await telegramService.sendMessage(msg.chat.id, message);
  }
}

export function getPendingReceiptInfo(orderId: number) {
  return pendingReceipts.get(orderId);
}

export function hasPendingReceipt(telegramId: string): boolean {
  for (const info of pendingReceipts.values()) {
    if (info.telegramId === telegramId) {
      return true;
    }
  }
  return false;
}
