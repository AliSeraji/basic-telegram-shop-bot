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
import { PAYMENT_TYPE, ORDER_STATUS } from '../../../common/constants';

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
                text: `${language === 'fa' ? prod.name : prod.nameJP || prod.name} - ${prod.price} تومان`,
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
          await this.telegramService.sendPhoto(chatId, product.imageUrl, {
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
          await this.cartService.addToCart({
            telegramId,
            productId,
            quantity: 1,
          });
          const message =
            language === 'fa'
              ? '✅ محصول به سبد خرید اضافه شد.'
              : '✅ Product added to cart.';
          await this.telegramService.sendMessage(chatId, message, {});
        } else if (data === 'place_order') {
          const order = await this.orderService.createOrder(telegramId);
          const message =
            language === 'fa'
              ? '📍 لطفاً آدرس تحویل خود را ارسال کنید:'
              : '📍 Please send your delivery address:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: {
              keyboard: [
                [
                  {
                    text:
                      language === 'fa' ? '📍 ارسال آدرس' : '📍 Send address',
                    request_location: true,
                  },
                ],
              ],
              one_time_keyboard: true,
              resize_keyboard: true,
            },
          });
          bot.once('location', async (msg) => {
            try {
              const detailsMessage =
                language === 'fa'
                  ? '🏠 لطفاً شماره واحد، طبقه یا اطلاعات تکمیلی را وارد کنید (مثلاً: واحد 12، طبقه 3):'
                  : '🏠 Please provide apartment number, floor or additional details (e.g.: apartment 12, floor 3):';
              await this.telegramService.sendMessage(chatId, detailsMessage, {
                reply_markup: { force_reply: true },
              });
              bot.once('message', async (msgDetails) => {
                try {
                  const delivery = await this.deliveryService.create({
                    orderId: order.id,
                    latitude: msg.location?.latitude || 0,
                    longitude: msg.location?.longitude || 0,
                    addressDetails: msgDetails.text,
                  });
                  const items = order.orderItems
                    ?.map(
                      (item) =>
                        `${language === 'fa' ? item.product.name : item.product.nameJP || item.product.name} - ${item.quantity} ${language === 'fa' ? 'عدد' : 'pcs.'}`,
                    )
                    .join(', ');
                  const message =
                    language === 'fa'
                      ? `💳 سفارش ایجاد شد! لطفاً از طریق لینک زیر پرداخت را انجام دهید.\n` +
                        `  📋 شناسه: ${order.id}\n` +
                        `  👤 کاربر: ${order.user?.fullName || 'وارد نشده'}\n` +
                        `  📦 محصولات: ${items || 'N/A'}\n` +
                        `  💸 جمع کل: ${order.totalAmount} تومان\n` +
                        `  📍 آدرس: (${delivery.latitude}, ${delivery.longitude})\n` +
                        `  🏠 جزئیات: ${delivery.addressDetails || 'N/A'}\n` +
                        `━━━━━━━━━━━━━━━`
                      : `💳 Order created! Please pay via the following link.\n` +
                        `  📋 ID: ${order.id}\n` +
                        `  👤 User: ${order.user?.fullName || 'Not specified'}\n` +
                        `  📦 Products: ${items || 'N/A'}\n` +
                        `  💸 Total: ${order.totalAmount} sum\n` +
                        `  📍 Address: (${delivery.latitude}, ${delivery.longitude})\n` +
                        `  🏠 Details: ${delivery.addressDetails || 'N/A'}\n` +
                        `━━━━━━━━━━━━━━━`;
                  await this.telegramService.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text:
                              language === 'fa'
                                ? '💵 پرداخت از طریق Click'
                                : '💵 Pay via Click',
                            callback_data: `confirm_payment_${order.id}_click`,
                          },
                        ],
                        [
                          {
                            text:
                              language === 'fa'
                                ? '💵 پرداخت از طریق Payme'
                                : '💵 Pay via Payme',
                            callback_data: `confirm_payment_${order.id}_payme`,
                          },
                        ],
                      ],
                    },
                  });
                } catch (error) {
                  this.logger.error(`Error in delivery: ${error.message}`);
                  const errorMessage =
                    language === 'fa'
                      ? '❌ خطا در ذخیره اطلاعات تحویل رخ داد.'
                      : '❌ Error occurred while saving delivery data.';
                  await this.telegramService.sendMessage(
                    chatId,
                    errorMessage,
                    {},
                  );
                }
              });
            } catch (error) {
              this.logger.error(`Error in delivery: ${error.message}`);
              const errorMessage =
                language === 'fa'
                  ? '❌ خطا در ذخیره آدرس تحویل رخ داد.'
                  : '❌ Error occurred while saving delivery address.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data?.startsWith('confirm_payment_')) {
          const parts = data.split('_');
          const orderId = parseInt(parts[2], 10);
          const paymentType = parts[3];

          this.logger.log(
            `Confirming payment for orderId: ${orderId}, paymentType: ${paymentType}`,
          );

          if (
            paymentType !== PAYMENT_TYPE.CLICK &&
            paymentType !== PAYMENT_TYPE.CARD
          ) {
            this.logger.error(`Invalid payment type: ${paymentType}`);
            const errorMessage =
              language === 'fa'
                ? '❌ نوع پرداخت نامعتبر است.'
                : '❌ Invalid payment type.';
            await this.telegramService.sendMessage(chatId, errorMessage, {});
            return;
          }

          const order = await this.orderService.findOne(orderId);
          if (!order) {
            this.logger.error(`Order not found for ID: ${orderId}`);
            const errorMessage =
              language === 'fa' ? '❌ سفارش یافت نشد.' : '❌ Order not found.';
            await this.telegramService.sendMessage(chatId, errorMessage, {});
            return;
          }

          const delivery = await this.deliveryService.findOneByOrderId(
            order.id,
          );
          if (!delivery) {
            this.logger.error(`Delivery not found for order ID: ${orderId}`);
            const errorMessage =
              language === 'fa'
                ? '❌ اطلاعات تحویل یافت نشد.'
                : '❌ Delivery data not found.';
            await this.telegramService.sendMessage(chatId, errorMessage, {});
            return;
          }

          await this.orderService.updateStatus(orderId, ORDER_STATUS.PAID);
          await this.orderService.update(orderId, { paymentType });

          const items = order.orderItems
            ?.map(
              (item) =>
                `${language === 'fa' ? item.product.name : item.product.nameJP || item.product.name} - ${item.quantity} ${language === 'fa' ? 'عدد' : 'pcs.'}`,
            )
            .join(', ');
          const message =
            language === 'fa'
              ? `✅ سفارش تایید شد!\n` +
                `  📋 شناسه: ${order.id}\n` +
                `  👤 کاربر: ${order.user?.fullName || 'وارد نشده'}\n` +
                `  📦 محصولات: ${items || 'N/A'}\n` +
                `  💸 جمع کل: ${order.totalAmount} تومان\n` +
                `  📊 وضعیت: ${order.status}\n` +
                `  💵 نوع پرداخت: ${paymentType}\n` +
                `  📍 آدرس: (${delivery.latitude}, ${delivery.longitude})\n` +
                `  🏠 جزئیات: ${delivery.addressDetails || 'N/A'}\n` +
                `  🚚 پیک: ${delivery.courierName || 'N/A'}\n` +
                `  📞 تلفن: ${delivery.courierPhone || 'N/A'}\n` +
                `  📅 تاریخ تحویل تقریبی: ${delivery.deliveryDate?.toLocaleString('fa-IR') || 'N/A'}\n` +
                `━━━━━━━━━━━━━━━`
              : `✅ Order confirmed!\n` +
                `  📋 ID: ${order.id}\n` +
                `  👤 User: ${order.user?.fullName || 'Not specified'}\n` +
                `  📦 Products: ${items || 'N/A'}\n` +
                `  💸 Total: ${order.totalAmount} sum\n` +
                `  📊 Status: ${order.status}\n` +
                `  💵 Payment type: ${paymentType}\n` +
                `  📍 Address: (${delivery.latitude}, ${delivery.longitude})\n` +
                `  🏠 Details: ${delivery.addressDetails || 'N/A'}\n` +
                `  🚚 Courier: ${delivery.courierName || 'N/A'}\n` +
                `  📞 Phone: ${delivery.courierPhone || 'N/A'}\n` +
                `  📅 Estimated delivery date: ${delivery.deliveryDate?.toLocaleString('en-US') || 'N/A'}\n` +
                `━━━━━━━━━━━━━━━`;

          await this.telegramService.sendMessage(chatId, message, {
            parse_mode: 'HTML',
          });
          const admins = await this.userService.findAllAdmins();
          for (const admin of admins) {
            await this.telegramService.sendMessage(admin.telegramId, message, {
              parse_mode: 'HTML',
            });
          }
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
        } else if (data?.startsWith('view_orders_')) {
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
                callback_data: `view_orders_${page + 1}`,
              },
            ]);
          }
          if (page > 1) {
            keyboard.push([
              {
                text: language === 'fa' ? '⬅️ صفحه قبلی' : '⬅️ Previous page',
                callback_data: `view_orders_${page - 1}`,
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
