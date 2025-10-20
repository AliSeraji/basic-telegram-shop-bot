import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { CategoryService } from '../../category/category.service';
import { ProductService } from '../../product/product.service';
import { UserService } from '../../user/user.service';
import { OrderService } from '../../order/order.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { PromocodeService } from '../../promocode/promocode.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { TelegramService } from '../telegram.service';
import {
  formatCategoryList,
  formatProductList,
  formatUserList,
  formatOrderList,
  formatFeedbackList,
  formatDeliveryList,
  formatStats,
} from '../utils/helpers';
import { getAdminKeyboard } from '../utils/keyboards';
import {
  handleCategorySelection,
  startProductCreation,
} from 'src/modules/product/product-creation.helper';
import {
  handleCategorySelectionForUpdate,
  showProductsForEdit,
  startProductUpdate,
} from 'src/modules/product/product-update.helper';

@Injectable()
export class CallbackHandler {
  private logger = new Logger(CallbackHandler.name);

  constructor(
    private categoryService: CategoryService,
    private productService: ProductService,
    private userService: UserService,
    private orderService: OrderService,
    private feedbackService: FeedbackService,
    private promocodeService: PromocodeService,
    private deliveryService: DeliveryService,
    private telegramService: TelegramService,
  ) {}

  private isAdminCallback(data?: string): boolean {
    const adminCallbacks = [
      'add_category',
      'view_categories',
      'edit_category',
      'delete_category',
      'add_product',
      'view_products',
      'edit_product',
      'delete_product',
      'view_users',
      'edit_user',
      'delete_user',
      'view_orders',
      'view_deliveries',
      'edit_delivery',
      'view_feedback',
      'delete_feedback',
      'create_promocode',
      'view_stats',
      'edit_cat',
      'delete_cat',
      'edit_prod',
      'delete_prod',
      'delete_user',
      'delete_fb',
      'select_cat_for_product',
      'update_cat_for_product',
    ];

    // Exclude user profile edits from admin callbacks
    const userProfileCallbacks = [
      'edit_fullName',
      'edit_phone',
      'edit_email',
      'edit_address',
      'return_to_main_menu',
    ];

    const isAdmin =
      adminCallbacks.some((cb) => data === cb || data?.startsWith(cb + '_')) &&
      !userProfileCallbacks.includes(data || '');

    return isAdmin;
  }

  handle() {
    const bot = this.telegramService.getBotInstance();
    bot.on('callback_query', async (query) => {
      if (!query.message?.chat?.id) return;
      const chatId = query.message?.chat.id;
      const telegramId = query.from.id.toString();
      const data = query.data;
      let language = 'fa';

      try {
        this.logger.log(
          `Received callback: ${data}, telegramId: ${telegramId}`,
        );

        if (!this.isAdminCallback(data)) {
          console.log('⏭️ Not an admin callback, skipping');
          return;
        }

        const user = await this.userService.findByTelegramId(telegramId);
        language = user?.language || 'fa';
        this.logger.log(`User language set to: ${language}`);

        if (
          data?.startsWith('add_') ||
          data?.startsWith('edit_') ||
          data?.startsWith('delete_') ||
          data?.startsWith('view_') ||
          data?.startsWith('stats_')
        ) {
          if (!user?.isAdmin) {
            const message =
              language === 'fa'
                ? '❌ این عملیات فقط برای مدیران قابل دسترسی است.'
                : '❌ This action is only available to administrators.';
            await this.telegramService.sendMessage(chatId, message, {});
            return;
          }
        }

        if (data === 'add_category') {
          const message =
            language === 'fa'
              ? '📋 نام دسته‌بندی را وارد کنید:'
              : '📋 Enter category name:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { force_reply: true },
          });

          bot.once('message', async (msgName) => {
            const name = msgName.text;

            const descMessage =
              language === 'fa'
                ? '📝 توضیحات دسته‌بندی را وارد کنید (اختیاری):'
                : '📝 Enter category description (optional):';
            await this.telegramService.sendMessage(chatId, descMessage, {
              reply_markup: { force_reply: true },
            });

            bot.once('message', async (msgDesc) => {
              try {
                await this.categoryService.create({
                  name: name?.trim() || '',
                  description: msgDesc.text?.trim() || '',
                });

                const successMessage =
                  language === 'fa'
                    ? '✅ دسته‌بندی با موفقیت اضافه شد!'
                    : '✅ Category added successfully!';
                await this.telegramService.sendMessage(chatId, successMessage, {
                  reply_markup: getAdminKeyboard(language),
                });
              } catch (error) {
                this.logger.error(`Error in add_category: ${error.message}`);
                const errorMessage =
                  language === 'fa'
                    ? '❌ خطا در افزودن دسته‌بندی رخ داد.'
                    : '❌ Error occurred while adding category.';
                await this.telegramService.sendMessage(chatId, errorMessage, {
                  reply_markup: getAdminKeyboard(language),
                });
              }
            });
          });
        } else if (data === 'view_categories') {
          const categories = await this.categoryService.findAll();
          await this.telegramService.sendMessage(
            chatId,
            formatCategoryList(categories, language),
            {
              parse_mode: 'HTML',
              reply_markup: getAdminKeyboard(language),
            },
          );
        } else if (data === 'edit_category') {
          const categories = await this.categoryService.findAll();
          const keyboard = categories.map((cat) => [
            {
              text: language === 'fa' ? cat.name : cat.nameFa || cat.name,
              callback_data: `edit_cat_${cat.id}`,
            },
          ]);
          const message =
            language === 'fa'
              ? '✏️ دسته‌بندی مورد نظر برای ویرایش را انتخاب کنید:'
              : '✏️ Select category to edit:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('edit_cat_')) {
          const categoryId = parseInt(data.split('_')[2]);
          const message =
            language === 'fa'
              ? '📋 نام جدید دسته‌بندی را وارد کنید (به فارسی):'
              : '📋 Enter new category name (in Persian):';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { force_reply: true },
          });
          bot.once('message', async (msgName) => {
            const name = msgName.text;
            const descMessage =
              language === 'fa'
                ? '📝 توضیحات جدید دسته‌بندی را وارد کنید (به فارسی):'
                : '📝 Enter new category description (in Persian):';
            await this.telegramService.sendMessage(chatId, descMessage, {
              reply_markup: { force_reply: true },
            });
            bot.once('message', async (msgDesc) => {
              try {
                await this.categoryService.update(categoryId, {
                  name: name?.trim() || '',
                  description: msgDesc.text?.trim() || '',
                });
                const successMessage =
                  language === 'fa'
                    ? '✅ دسته‌بندی به‌روزرسانی شد!'
                    : '✅ Category updated!';
                await this.telegramService.sendMessage(chatId, successMessage, {
                  reply_markup: getAdminKeyboard(language),
                });
              } catch (error) {
                this.logger.error(`Error in edit_category: ${error.message}`);
                const errorMessage =
                  language === 'fa'
                    ? '❌ خطا در ویرایش دسته‌بندی رخ داد.'
                    : '❌ Error occurred while editing category.';
                await this.telegramService.sendMessage(
                  chatId,
                  errorMessage,
                  {},
                );
              }
            });
          });
        } else if (data === 'delete_category') {
          const categories = await this.categoryService.findAll();
          const keyboard = categories.map((cat) => [
            {
              text: language === 'fa' ? cat.name : cat.nameFa || cat.name,
              callback_data: `delete_cat_${cat.id}`,
            },
          ]);
          const message =
            language === 'fa'
              ? '🗑 دسته‌بندی مورد نظر برای حذف را انتخاب کنید:'
              : '🗑 Select category to delete:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('delete_cat_')) {
          const categoryId = parseInt(data.split('_')[2]);
          await this.categoryService.remove(categoryId);
          const message =
            language === 'fa' ? '✅ دسته‌بندی حذف شد.' : '✅ Category deleted.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'add_product') {
          if (!chatId) return;
          await startProductCreation(
            bot,
            chatId,
            telegramId,
            language,
            this.telegramService,
            this.categoryService,
          );
        } else if (data?.startsWith('select_cat_for_product_')) {
          if (!chatId) return;
          const categoryId = parseInt(data.split('_')[4]);
          await bot.answerCallbackQuery(query.id);
          await handleCategorySelection(
            bot,
            chatId,
            telegramId,
            categoryId,
            language,
            this.telegramService,
            this.productService,
          );
        } else if (data === 'view_products') {
          const products = await this.productService.findAll();
          await this.telegramService.sendMessage(
            chatId,
            formatProductList(products, language),
            {
              parse_mode: 'HTML',
              reply_markup: getAdminKeyboard(language),
            },
          );
        } else if (data === 'edit_product') {
          if (!chatId) return;
          await showProductsForEdit(
            chatId,
            language,
            this.telegramService,
            this.productService,
          );
        } else if (data?.startsWith('edit_prod_')) {
          if (!chatId) return;
          const productId = parseInt(data.split('_')[2]);
          await bot.answerCallbackQuery(query.id);
          await startProductUpdate(
            bot,
            chatId,
            telegramId,
            productId,
            language,
            this.telegramService,
            this.productService,
            this.categoryService,
          );
        } else if (data?.startsWith('update_cat_for_product_')) {
          if (!chatId) return;
          const parts = data.split('_');
          const productId = parseInt(parts[4]);
          const categoryId = parseInt(parts[5]);
          await bot.answerCallbackQuery(query.id);
          await handleCategorySelectionForUpdate(
            bot,
            chatId,
            telegramId,
            productId,
            categoryId,
            language,
            this.telegramService,
            this.productService,
          );
        } else if (data === 'delete_product') {
          const products = await this.productService.findAll();
          const keyboard = products.map((prod) => [
            {
              text: language === 'fa' ? prod.name : prod.nameJP || prod.name,
              callback_data: `delete_prod_${prod.id}`,
            },
          ]);
          const message =
            language === 'fa'
              ? '🗑 محصول مورد نظر برای حذف را انتخاب کنید:'
              : '🗑 Select product to delete:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('delete_prod_')) {
          const productId = parseInt(data.split('_')[2]);
          await this.productService.remove(productId);
          const message =
            language === 'fa' ? '✅ محصول حذف شد.' : '✅ Product deleted.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'view_users') {
          const users = await this.userService.findAll();
          await this.telegramService.sendMessage(
            chatId,
            formatUserList(users, language),
            {
              parse_mode: 'HTML',
              reply_markup: getAdminKeyboard(language),
            },
          );
        } else if (data === 'edit_user') {
          const users = await this.userService.findAll();
          const keyboard = users.map((user) => [
            {
              text:
                user.fullName ||
                (language === 'fa' ? 'وارد نشده' : 'Not specified'),
              callback_data: `edit_user_${user.id}`,
            },
          ]);
          const message =
            language === 'fa'
              ? '✏️ کاربر مورد نظر برای ویرایش را انتخاب کنید:'
              : '✏️ Select user to edit:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('edit_user_')) {
          const userId = parseInt(data.split('_')[2]);
          const message =
            language === 'fa'
              ? '👤 نام و شماره تلفن جدید را وارد کنید (نام;تلفن;آدرس):'
              : '👤 Enter new name and phone number (name;phone;Address):';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { force_reply: true },
          });
          bot.once('message', async (msg) => {
            if (!msg.text) return;
            try {
              const [fullName, phone, address] = msg.text.split(';');
              await this.userService.update(userId, {
                fullName: fullName.trim(),
                phone: phone.trim(),
                userAddress: address.trim(),
              });
              const successMessage =
                language === 'fa'
                  ? '✅ اطلاعات کاربر به‌روزرسانی شد.'
                  : '✅ User data updated.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in edit_user: ${error.message}`);
              const errorMessage =
                language === 'fa'
                  ? '❌ خطا در ویرایش کاربر رخ داد.'
                  : '❌ Error occurred while editing user.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'delete_user') {
          const users = await this.userService.findAll();
          const keyboard = users.map((user) => [
            {
              text:
                user.fullName ||
                (language === 'fa' ? 'وارد نشده' : 'Not specified'),
              callback_data: `delete_user_${user.id}`,
            },
          ]);
          const message =
            language === 'fa'
              ? '🗑 کاربر مورد نظر برای حذف را انتخاب کنید:'
              : '🗑 Select user to delete:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('delete_user_')) {
          const userId = parseInt(data.split('_')[2]);
          await this.userService.remove(userId);
          const message =
            language === 'fa' ? '✅ کاربر حذف شد.' : '✅ User deleted.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'view_orders') {
          const orders = await this.orderService.findAll(1, 10);
          const keyboard =
            orders.length === 10
              ? [
                  [
                    {
                      text: language === 'fa' ? '➡️ صفحه بعدی' : '➡️ Next page',
                      callback_data: 'view_orders_2',
                    },
                  ],
                ]
              : [];
          await this.telegramService.sendMessage(
            chatId,
            formatOrderList(orders, language),
            {
              reply_markup: { inline_keyboard: keyboard },
              parse_mode: 'HTML',
            },
          );
        } else if (data?.startsWith('view_orders_')) {
          const page = parseInt(data.split('_')[2]) || 1;
          const orders = await this.orderService.findAll(page, 10);
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
        } else if (data === 'view_deliveries') {
          const deliveries = await this.deliveryService.findAll(1, 10);
          const keyboard =
            deliveries.length === 10
              ? [
                  [
                    {
                      text: language === 'fa' ? '➡️ صفحه بعدی' : '➡️ Next page',
                      callback_data: 'view_deliveries_2',
                    },
                  ],
                ]
              : [];
          await this.telegramService.sendMessage(
            chatId,
            formatDeliveryList(deliveries, language),
            {
              reply_markup: { inline_keyboard: keyboard },
              parse_mode: 'HTML',
            },
          );
        } else if (data?.startsWith('view_deliveries_')) {
          const page = parseInt(data.split('_')[2]) || 1;
          const deliveries = await this.deliveryService.findAll(page, 10);
          const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
          if (deliveries.length === 10) {
            keyboard.push([
              {
                text: language === 'fa' ? '➡️ صفحه بعدی' : '➡️ Next page',
                callback_data: `view_deliveries_${page + 1}`,
              },
            ]);
          }
          if (page > 1) {
            keyboard.push([
              {
                text: language === 'fa' ? '⬅️ صفحه قبلی' : '⬅️ Previous page',
                callback_data: `view_deliveries_${page - 1}`,
              },
            ]);
          }
          await this.telegramService.sendMessage(
            chatId,
            formatDeliveryList(deliveries, language),
            {
              reply_markup: { inline_keyboard: keyboard },
              parse_mode: 'HTML',
            },
          );
        } else if (data === 'edit_delivery') {
          const deliveries = await this.deliveryService.findAll(1, 10);
          const keyboard = deliveries.map((delivery) => [
            {
              text: `📋 ID: ${delivery.id}`,
              callback_data: `edit_delivery_${delivery.id}`,
            },
          ]);
          const message =
            language === 'fa'
              ? '✏️ تحویل مورد نظر برای ویرایش را انتخاب کنید:'
              : '✏️ Select delivery to edit:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('edit_delivery_')) {
          const deliveryId = parseInt(data.split('_')[2]);
          const message =
            language === 'fa'
              ? '📊 وضعیت جدید را وارد کنید (pending, in_transit, delivered, cancelled):'
              : '📊 Enter new status (pending, in_transit, delivered, cancelled):';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { force_reply: true },
          });
          bot.once('message', async (msg) => {
            if (!msg.text) return;
            try {
              const statusText = msg.text?.trim().toLowerCase();

              if (
                !statusText ||
                !['pending', 'in_transit', 'delivered', 'cancelled'].includes(
                  statusText,
                )
              ) {
                const errorMessage =
                  language === 'fa'
                    ? '❌ وضعیت نامعتبر است. لطفاً یکی از موارد زیر را وارد کنید: pending, in_transit, delivered, cancelled'
                    : '❌ Invalid status. Please enter one of: pending, in_transit, delivered, cancelled';
                await this.telegramService.sendMessage(
                  chatId,
                  errorMessage,
                  {},
                );
                return;
              }

              await this.deliveryService.update(deliveryId, {
                status: statusText as
                  | 'pending'
                  | 'in_transit'
                  | 'delivered'
                  | 'cancelled',
              });
              const successMessage =
                language === 'fa'
                  ? '✅ وضعیت تحویل به‌روزرسانی شد.'
                  : '✅ Delivery status updated.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in edit_delivery: ${error.message}`);
              const errorMessage =
                language === 'fa'
                  ? '❌ خطا در به‌روزرسانی وضعیت تحویل رخ داد.'
                  : '❌ Error occurred while updating delivery status.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'view_feedback') {
          const feedbacks = await this.feedbackService.findAll();
          await this.telegramService.sendMessage(
            chatId,
            formatFeedbackList(feedbacks, language),
            {
              parse_mode: 'HTML',
              reply_markup: getAdminKeyboard(language),
            },
          );
        } else if (data === 'delete_feedback') {
          const feedbacks = await this.feedbackService.findAll();
          const keyboard = feedbacks.map((fb) => [
            {
              text: `📋 ID: ${fb.id}, ${language === 'fa' ? 'امتیاز' : 'Rating'}: ${fb.rating}`,
              callback_data: `delete_fb_${fb.id}`,
            },
          ]);
          const message =
            language === 'fa'
              ? '🗑 بازخورد مورد نظر برای حذف را انتخاب کنید:'
              : '🗑 Select feedback to delete:';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (data?.startsWith('delete_fb_')) {
          const feedbackId = parseInt(data.split('_')[2]);
          await this.feedbackService.remove(feedbackId);
          const message =
            language === 'fa' ? '✅ بازخورد حذف شد.' : '✅ Feedback deleted.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'create_promocode') {
          const message =
            language === 'fa'
              ? '🎟 اطلاعات کد تخفیف را وارد کنید (کد;درصد تخفیف;تاریخ انقضا yyyy-mm-dd):'
              : '🎟 Enter promo code data (code;discount percent;expiry date yyyy-mm-dd):';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: { force_reply: true },
          });
          bot.once('message', async (msg) => {
            if (!msg.text) return;
            try {
              const [code, discountPercent, validTill] = msg.text.split(';');
              await this.promocodeService.create({
                code: code.trim(),
                discountPercent: parseFloat(discountPercent.trim()),
                validTill: new Date(validTill.trim()),
              });
              const successMessage =
                language === 'fa'
                  ? '✅ کد تخفیف اضافه شد.'
                  : '✅ Promo code added.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in create_promocode: ${error.message}`);
              const errorMessage =
                language === 'fa'
                  ? '❌ خطا در افزودن کد تخفیف رخ داد.'
                  : '❌ Error occurred while adding promo code.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'view_stats') {
          const stats = await this.orderService.getStats();
          await this.telegramService.sendMessage(
            chatId,
            formatStats(stats, language),
            {
              parse_mode: 'HTML',
              reply_markup: getAdminKeyboard(language),
            },
          );
        } else if (data === 'my_profile') {
          const user = await this.userService.findByTelegramId(telegramId);
          const message =
            language === 'fa'
              ? `👤 نام شما: ${user.fullName || 'وارد نشده'}\n📞 تلفن: ${user.phone || 'وارد نشده'}`
              : `👤 Your name: ${user.fullName || 'Not specified'}\n📞 Phone: ${user.phone || 'Not specified'}`;
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'about_us') {
          const message =
            language === 'fa'
              ? 'ℹ️ درباره ما: این ربات به شما در مدیریت محصولات، سفارشات و کاربران کمک می‌کند.'
              : 'ℹ️ About us: This bot helps you manage products, orders and users.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'order_history') {
          const orders = await this.orderService.findAll(1, 10);
          await this.telegramService.sendMessage(
            chatId,
            formatOrderList(orders, language),
            {
              parse_mode: 'HTML',
              reply_markup: getAdminKeyboard(language),
            },
          );
        }
      } catch (error) {
        this.logger.error(`Error in callback: ${error.message}`);
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
