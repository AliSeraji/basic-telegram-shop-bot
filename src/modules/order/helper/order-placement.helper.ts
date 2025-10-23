import { Logger } from '@nestjs/common';
import { OrderService } from '../order.service';
import { UserService } from '../../user/user.service';
import { TelegramService } from '../../telegram/telegram.service';
import { CartService } from '../../cart/cart.service';
import TelegramBot = require('node-telegram-bot-api');

const logger = new Logger('OrderPlacementHelper');

// Bank account information - configure this in your .env later
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
    // Create order
    const order = await orderService.createOrder(telegramId);

    // Clear cart
    await cartService.clearCart(telegramId);

    // Generate tracking number (you can customize this)
    const trackingNumber = `TRK${Date.now()}${order.id}`;
    await orderService.update(order.id, { trackingNumber });

    // Show payment instructions
    const paymentMessage =
      language === 'fa'
        ? `✅ سفارش شما ثبت شد!\n\n` +
          `📦 کد پیگیری: ${trackingNumber}\n` +
          `💰 مبلغ قابل پرداخت: ${order.totalAmount.toLocaleString('fa-IR')} تومان\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `💳 اطلاعات حساب:\n` +
          `🏦 بانک: ${BANK_ACCOUNT.bankName}\n` +
          `👤 صاحب حساب: ${BANK_ACCOUNT.accountHolder}\n` +
          `💳 شماره حساب: ${BANK_ACCOUNT.accountNumber}\n` +
          `💳 شبا: ${BANK_ACCOUNT.iban}\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          `📸 لطفاً پس از واریز، عکس رسید را ارسال کنید.`
        : `✅ Your order has been registered!\n\n` +
          `📦 Tracking number: ${trackingNumber}\n` +
          `💰 Amount: ${order.totalAmount.toLocaleString()} Toman\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `💳 Account information:\n` +
          `🏦 Bank: ${BANK_ACCOUNT.bankName}\n` +
          `👤 Account holder: ${BANK_ACCOUNT.accountHolder}\n` +
          `💳 Account number: ${BANK_ACCOUNT.accountNumber}\n` +
          `💳 IBAN: ${BANK_ACCOUNT.iban}\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          `📸 Please send the receipt photo after payment.`;

    await telegramService.sendMessage(chatId, paymentMessage);

    // Wait for receipt photo
    bot.once('photo', async (msg) => {
      await handleReceiptUpload(
        bot,
        msg,
        order.id,
        language,
        telegramService,
        orderService,
      );
    });
  } catch (error) {
    logger.error(`Error in confirmOrderAndRequestPayment: ${error.message}`);
    const message =
      language === 'fa'
        ? '❌ خطایی در ثبت سفارش رخ داد.'
        : '❌ Error creating order.';
    await telegramService.sendMessage(chatId, message);
  }
}

export async function handleReceiptUpload(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  orderId: number,
  language: string,
  telegramService: TelegramService,
  orderService: OrderService,
): Promise<void> {
  try {
    const chatId = msg.chat.id;

    if (!msg.photo || msg.photo.length === 0) {
      const message =
        language === 'fa'
          ? '❌ لطفاً عکس رسید را ارسال کنید.'
          : '❌ Please send the receipt photo.';
      await telegramService.sendMessage(chatId, message);
      return;
    }

    // Get the highest resolution photo
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

    // Save receipt to order
    await orderService.update(orderId, {
      receiptImage,
      receiptImageMimeType: 'image/jpeg',
    });

    const successMessage =
      language === 'fa'
        ? `✅ رسید شما دریافت شد!\n\n` +
          `سفارش شما در حال بررسی است و پس از تایید پرداخت، به شما اطلاع داده خواهد شد.\n\n` +
          `از خرید شما متشکریم! 🙏`
        : `✅ Receipt received!\n\n` +
          `Your order is being reviewed and you will be notified after payment confirmation.\n\n` +
          `Thank you for your purchase! 🙏`;

    await telegramService.sendMessage(chatId, successMessage);

    // Notify admins
    const order = await orderService.findOne(orderId);
    const adminMessage =
      `🔔 سفارش جدید دریافت شد!\n\n` +
      `📦 شناسه سفارش: ${order.id}\n` +
      `👤 کاربر: ${order.user?.fullName || 'نامشخص'}\n` +
      `💰 مبلغ: ${order.totalAmount.toLocaleString('fa-IR')} تومان\n` +
      `📋 کد پیگیری: ${order.trackingNumber}\n\n` +
      `لطفاً رسید را بررسی و تایید کنید.`;

    // Send receipt to admins
    const userService = orderService['userService']; // Access injected service
    const admins = await userService.findAllAdmins();
    for (const admin of admins) {
      await bot.sendPhoto(admin.telegramId, receiptImage, {
        caption: adminMessage,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ تایید پرداخت',
                callback_data: `approve_payment_${orderId}`,
              },
              {
                text: '❌ رد پرداخت',
                callback_data: `reject_payment_${orderId}`,
              },
            ],
          ],
        },
      });
    }
  } catch (error) {
    logger.error(`Error in handleReceiptUpload: ${error.message}`);
    const message =
      language === 'fa'
        ? '❌ خطایی در آپلود رسید رخ داد.'
        : '❌ Error uploading receipt.';
    await telegramService.sendMessage(msg.chat.id, message);
  }
}
