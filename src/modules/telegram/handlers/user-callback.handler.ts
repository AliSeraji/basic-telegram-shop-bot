import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { CategoryService } from '../../category/category.service';
import { ProductService } from '../../product/product.service';
import { CartService } from '../../cart/cart.service';
import { OrderService } from '../../order/order.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { PaymentService } from '../../payment/payment.service';
import { UserService } from '../../user/user.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { TelegramService } from '../telegram.service';
import { formatProductMessage, formatOrderList } from '../utils/helpers';
import { sendProduct } from 'src/modules/product/helpers/product-display.heper';
import {
  handleAddQuantityToCart,
  handleAddToCart,
} from 'src/modules/cart/helpers/cart-handler.helper';
import {
  confirmOrderAndRequestPayment,
  getPendingReceiptInfo,
  showPaymentInstructions,
  startOrderPlacement,
} from 'src/modules/order/helper/order-placement.helper';
import { ORDER_STATUS } from 'src/common/constants';

@Injectable()
export class UserCallbackHandler {
  private logger = new Logger(UserCallbackHandler.name);

  constructor(
    private categoryService: CategoryService,
    private productService: ProductService,
    private cartService: CartService,
    private orderService: OrderService,
    private feedbackService: FeedbackService,
    private paymentService: PaymentService,
    private userService: UserService,
    private deliveryService: DeliveryService,
    private telegramService: TelegramService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();
    bot.on('callback_query', async (query) => {
      if (!query.message?.chat?.id) return;
      const chatId = query.message?.chat.id;
      const telegramId = query.from.id.toString();
      const data = query.data;
      try {
        this.logger.log(
          `Processing user callback: ${data} for telegramId: ${telegramId}`,
        );
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';

        if (data?.startsWith('category_')) {
          const categoryId = parseInt(data.split('_')[1]);
          const products = await this.productService.findByCategory(categoryId);
          const keyboard: TelegramBot.InlineKeyboardButton[][] = products.map(
            (prod) => [
              {
                text: `${language === 'fa' ? prod.name : prod.name} - ${prod.price} تومان`,
                callback_data: `product_${prod.id}`,
              },
            ],
          );
          keyboard.push([
            {
              text:
                language === 'fa'
                  ? '🔙 بازگشت به دسته‌بندی‌ها'
                  : '🔙 Back to Categories',
              callback_data: 'back_to_categories',
            },
          ]);
          const message =
            language === 'fa' ? '📁 لیست محصولات' : '📦 Products:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('product_')) {
          const productId = parseInt(data.split('_')[1]);
          const product = await this.productService.findOne(productId);
          await sendProduct(bot, chatId, product, language, {
            caption: formatProductMessage(product, language),
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      language === 'fa'
                        ? '➕ افزودن به سبد خرید'
                        : '➕ Add to cart',
                    callback_data: `addtocart_${productId}`,
                  },
                ],
                [
                  {
                    text:
                      language === 'fa'
                        ? '⭐ ثبت بازخورد'
                        : '⭐ Leave feedback',
                    callback_data: `feedback_${productId}`,
                  },
                ],
              ],
            },
          });
        } else if (data?.startsWith('addtocart_')) {
          const productId = parseInt(data.split('_')[1]);
          await handleAddToCart(
            bot,
            chatId,
            telegramId,
            productId,
            language,
            this.telegramService,
            this.productService,
          );
          await bot.answerCallbackQuery(query.id);
        } else if (data?.startsWith('addqty_')) {
          const parts = data.split('_');
          const productId = parseInt(parts[1]);
          const quantity = parseInt(parts[2]);

          await handleAddQuantityToCart(
            bot,
            chatId,
            telegramId,
            productId,
            quantity,
            language,
            this.telegramService,
            this.cartService,
            this.productService,
          );
          await bot.answerCallbackQuery(query.id);
        } else if (data === 'cancel_add_to_cart') {
          const message =
            language === 'fa'
              ? '❌ افزودن به سبد خرید لغو شد.'
              : '❌ Add to cart cancelled.';
          await this.telegramService.sendMessage(chatId, message);
          await bot.answerCallbackQuery(query.id);
        } else if (data === 'place_order') {
          await bot.answerCallbackQuery(query.id);
          await startOrderPlacement(
            bot,
            chatId,
            telegramId,
            language,
            this.telegramService,
            this.orderService,
            this.userService,
            this.cartService,
          );
        } else if (data === 'confirm_order_info') {
          await bot.answerCallbackQuery(query.id);
          await confirmOrderAndRequestPayment(
            bot,
            chatId,
            telegramId,
            language,
            this.telegramService,
            this.orderService,
            this.cartService,
          );
        } else if (data === 'edit_user_info') {
          await bot.answerCallbackQuery(query.id);
          const message =
            language === 'fa'
              ? '✏️ لطفاً از منوی اصلی گزینه "تنظیمات" را انتخاب کرده و اطلاعات خود را ویرایش کنید.'
              : '✏️ Please select "Settings" from the main menu to edit your information.';
          await this.telegramService.sendMessage(chatId, message);
        } else if (data === 'cancel_order') {
          await bot.answerCallbackQuery(query.id);
          const message =
            language === 'fa' ? '❌ سفارش لغو شد.' : '❌ Order cancelled.';
          await this.telegramService.sendMessage(chatId, message);
        } else if (data?.startsWith('approve_payment_')) {
          const orderId = parseInt(data.split('_')[2]);
          await this.orderService.updateStatus(
            orderId,
            ORDER_STATUS.PAYMENT_VALIDATED,
          );

          const order = await this.orderService.findOne(orderId);
          const userMessage =
            `✅ پرداخت شما تایید شد!\n\n` +
            `سفارش شما در حال آماده‌سازی است و به زودی ارسال خواهد شد.\n` +
            `📦 کد پیگیری: ${order.trackingNumber}`;

          await this.telegramService.sendMessage(
            order.user.telegramId,
            userMessage,
          );
          await this.telegramService.sendMessage(chatId, '✅ پرداخت تایید شد.');
          await bot.answerCallbackQuery(query.id);
        } else if (data?.startsWith('reject_payment_')) {
          const orderId = parseInt(data.split('_')[2]);

          const order = await this.orderService.findOne(orderId);
          const userMessage =
            `❌ پرداخت شما تایید نشد.\n\n` +
            `لطفاً دوباره رسید صحیح را ارسال کنید یا با پشتیبانی تماس بگیرید.\n` +
            `📦 کد پیگیری: ${order.trackingNumber}`;

          await this.telegramService.sendMessage(
            order.user.telegramId,
            userMessage,
          );
          await this.telegramService.sendMessage(chatId, '❌ پرداخت رد شد.');
          await bot.answerCallbackQuery(query.id);
        } else if (data?.startsWith('upload_receipt_')) {
          const orderId = parseInt(data.split('_')[2]);
          const pendingInfo = getPendingReceiptInfo(orderId);

          if (!pendingInfo) {
            const message =
              language === 'fa'
                ? '❌ سفارش یافت نشد یا منقضی شده است.'
                : '❌ Order not found or expired.';
            await this.telegramService.sendMessage(chatId, message);
            await bot.answerCallbackQuery(query.id);
            return;
          }

          const order = await this.orderService.findOne(orderId);
          const instructionMessage =
            language === 'fa'
              ? `📸 لطفاً عکس رسید پرداخت را ارسال کنید.\n\n` +
                `💰 مبلغ: ${order.totalAmount.toLocaleString('fa-IR')} تومان\n` +
                `📦 کد پیگیری: ${order.trackingNumber}\n\n` +
                `⚠️ توجه: فقط یک عکس واضح از رسید ارسال کنید.`
              : `📸 Please send the payment receipt photo.\n\n` +
                `💰 Amount: ${order.totalAmount.toLocaleString()} Toman\n` +
                `📦 Tracking: ${order.trackingNumber}\n\n` +
                `⚠️ Note: Send only one clear photo of the receipt.`;

          await this.telegramService.sendMessage(chatId, instructionMessage);
          await bot.answerCallbackQuery(query.id, {
            text:
              language === 'fa'
                ? 'لطفاً عکس رسید را ارسال کنید'
                : 'Please send receipt photo',
          });
        } else if (data?.startsWith('show_bank_info_')) {
          const orderId = parseInt(data.split('_')[3]);
          const order = await this.orderService.findOne(orderId);

          await showPaymentInstructions(
            orderId,
            order.totalAmount,
            order.trackingNumber,
            chatId,
            language,
            this.telegramService,
          );
          await bot.answerCallbackQuery(query.id);
        } else if (data?.startsWith('check_order_status_')) {
          const orderId = parseInt(data.split('_')[3]);
          const order = await this.orderService.findOne(orderId);

          const statusMessage =
            language === 'fa'
              ? `📦 وضعیت سفارش\n\n` +
                `🔢 شناسه: ${order.id}\n` +
                `📋 کد پیگیری: ${order.trackingNumber}\n` +
                `💰 مبلغ: ${order.totalAmount.toLocaleString('fa-IR')} تومان\n` +
                `📊 وضعیت: ${
                  order.status === ORDER_STATUS.PENDING
                    ? '⏳ در انتظار پرداخت'
                    : order.status === ORDER_STATUS.PAID
                      ? '✅ پرداخت شده'
                      : order.status === ORDER_STATUS.SHIPPED
                        ? '🚚 ارسال شده'
                        : order.status === ORDER_STATUS.DELIVERED
                          ? '✅ تحویل داده شده'
                          : order.status
                }\n\n` +
                (order.receiptImage ? '✅ رسید دریافت شد' : '⏳ در انتظار رسید')
              : `📦 Order Status\n\n` +
                `🔢 ID: ${order.id}\n` +
                `📋 Tracking: ${order.trackingNumber}\n` +
                `💰 Amount: ${order.totalAmount.toLocaleString()} Toman\n` +
                `📊 Status: ${order.status}\n\n` +
                (order.receiptImage
                  ? '✅ Receipt received'
                  : '⏳ Waiting for receipt');

          await this.telegramService.sendMessage(chatId, statusMessage, {
            reply_markup: {
              inline_keyboard: order.receiptImage
                ? []
                : [
                    [
                      {
                        text:
                          language === 'fa'
                            ? '📸 آپلود رسید'
                            : '📸 Upload Receipt',
                        callback_data: `upload_receipt_${orderId}`,
                      },
                    ],
                  ],
            },
          });
          await bot.answerCallbackQuery(query.id);
        } else if (data?.startsWith('feedback_')) {
          const productId = parseInt(data.split('_')[1]);
          const message =
            language === 'fa'
              ? '⭐ امتیاز را انتخاب کنید:'
              : '⭐ Select rating:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⭐ 1', callback_data: `rate_${productId}_1` },
                  { text: '⭐ 2', callback_data: `rate_${productId}_2` },
                  { text: '⭐ 3', callback_data: `rate_${productId}_3` },
                  { text: '⭐ 4', callback_data: `rate_${productId}_4` },
                  { text: '⭐ 5', callback_data: `rate_${productId}_5` },
                ],
              ],
            },
          });
        } else if (data?.startsWith('rate_')) {
          const [_, productId, rating] = data.split('_');
          const message =
            language === 'fa'
              ? '💬 نظر خود را بنویسید:'
              : '💬 Write your comment:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { force_reply: true },
          });
          bot.once('message', async (msg) => {
            try {
              await this.feedbackService.create({
                telegramId,
                productId: parseInt(productId),
                rating: parseInt(rating),
                comment: msg.text || '',
              });
              const successMessage =
                language === 'fa'
                  ? '✅ بازخورد دریافت شد!'
                  : '✅ Feedback received!';
              await this.telegramService.sendMessage(
                chatId,
                successMessage,
                {},
              );
            } catch (error) {
              this.logger.error(`Error in feedback: ${error.message}`);
              const errorMessage =
                language === 'fa'
                  ? '❌ خطا در ثبت بازخورد رخ داد.'
                  : '❌ Error occurred while submitting feedback.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'clear_cart') {
          await this.cartService.clearCart(telegramId);
          const message =
            language === 'fa' ? '🗑 سبد خرید پاک شد.' : '🗑 Cart cleared.';
          await this.telegramService.sendMessage(chatId, message, {});
        } else if (data?.startsWith('user_view_orders_')) {
          const page = parseInt(data.split('_')[2]) || 1;
          const orders = await this.orderService.getUserOrders(
            telegramId,
            page,
            10,
          );
          const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
          if (orders.length === 10) {
            keyboard.push([
              {
                text: language === 'fa' ? '➡️ صفحه بعدی' : '➡️ Next page',
                callback_data: `user_view_orders_${page + 1}`,
              },
            ]);
          }
          if (page > 1) {
            keyboard.push([
              {
                text: language === 'fa' ? '⬅️ صفحه قبلی' : '⬅️ Previous page',
                callback_data: `user_view_orders_${page - 1}`,
              },
            ]);
          }
          await this.telegramService.sendMessage(
            chatId,
            formatOrderList(orders, language),
            {
              reply_markup: { inline_keyboard: keyboard },
              parse_mode: 'HTML',
            },
          );
        }
      } catch (error) {
        this.logger.error(`Error in user callback: ${error.message}`);
        const user = await this.userService.findByTelegramId(telegramId);
        const language = user.language || 'fa';
        const message =
          language === 'fa'
            ? '❌ خطایی رخ داد، لطفاً بعداً دوباره امتحان کنید.'
            : '❌ An error occurred, please try again later.';
        await this.telegramService.sendMessage(chatId, message, {});
      } finally {
        try {
          await bot.answerCallbackQuery(query.id);
        } catch (err) {
          this.logger.error(`Error in answerCallbackQuery: ${err.message}`);
        }
      }
    });
  }
}
