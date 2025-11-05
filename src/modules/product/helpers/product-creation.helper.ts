import { Logger } from '@nestjs/common';
import { CategoryService } from '../../category/category.service';
import { ProductService } from '../product.service';
import { TelegramService } from '../../telegram/telegram.service';
import { getAdminKeyboard } from '../../telegram/utils/keyboards';
import { downloadTelegramPhoto } from './image-handler.helper';
import TelegramBot = require('node-telegram-bot-api');

const logger = new Logger('ProductCreationHelper');
const productCreationStates = new Map<string, any>();

export async function startProductCreation(
  bot: TelegramBot,
  botToken: string,
  chatId: number,
  telegramId: string,
  language: string,
  telegramService: TelegramService,
  categoryService: CategoryService,
) {
  // Step 1: Ask for product name
  const message =
    language === 'fa' ? '📦 نام محصول را وارد کنید:' : '📦 Enter product name:';
  await telegramService.sendMessage(chatId, message, {
    reply_markup: { force_reply: true },
  });

  bot.once('message', async (msgName) => {
    const name = msgName.text;

    // Step 2: Ask for price
    const priceMessage =
      language === 'fa'
        ? '💰 قیمت محصول را وارد کنید (به دلار):'
        : '💰 Enter product price (in Toman):';
    await telegramService.sendMessage(chatId, priceMessage, {
      reply_markup: { force_reply: true },
    });

    bot.once('message', async (msgPrice) => {
      const price = parseFloat(msgPrice.text || '0');

      if (isNaN(price) || price <= 0) {
        const errorMessage =
          language === 'fa'
            ? '❌ قیمت نامعتبر است. لطفاً دوباره تلاش کنید.'
            : '❌ Invalid price. Please try again.';
        await telegramService.sendMessage(chatId, errorMessage, {
          reply_markup: getAdminKeyboard(language),
        });
        return;
      }

      // Step 3: Ask for description
      const descMessage =
        language === 'fa'
          ? '📝 توضیحات محصول را وارد کنید (اختیاری):'
          : '📝 Enter product description (optional):';
      await telegramService.sendMessage(chatId, descMessage, {
        reply_markup: { force_reply: true },
      });

      bot.once('message', async (msgDesc) => {
        const description = msgDesc.text;

        // Step 4: Ask for image (photo or URL)
        const imageMessage =
          language === 'fa'
            ? '🖼 تصویر محصول را ارسال کنید یا لینک تصویر را وارد کنید:'
            : '🖼 Send product image or enter image URL:';
        await telegramService.sendMessage(chatId, imageMessage, {
          reply_markup: { force_reply: true },
        });

        bot.once('message', async (msgImage) => {
          let imageData: Buffer | null = null;
          let imageMimeType: string | null = null;

          try {
            // Check if user sent a photo
            if (msgImage.photo && msgImage.photo.length > 0) {
              const photo = msgImage.photo[msgImage.photo.length - 1];
              const fileId = photo.file_id;

              const result = await downloadTelegramPhoto(bot, fileId, 10);

              if ('error' in result) {
                const errorMessage =
                  language === 'fa'
                    ? `❌ خطا در دریافت تصویر: حجم تصویر بیش از 10 مگابایت است.`
                    : `❌ Error: Image size exceeds 10 MB.`;
                await telegramService.sendMessage(chatId, errorMessage, {
                  reply_markup: getAdminKeyboard(language),
                });
                return;
              }

              imageData = result.imageData;
              imageMimeType = result.imageMimeType;
            }
            // Check if user sent a URL
            else if (msgImage.text) {
              const errorMessage =
                language === 'fa'
                  ? '❌ لطفاً تصویر را مستقیماً ارسال کنید (پشتیبانی از لینک در حال حاضر موجود نیست).'
                  : '❌ Please send the image directly (URL not supported currently).';
              await telegramService.sendMessage(chatId, errorMessage, {
                reply_markup: getAdminKeyboard(language),
              });
              return;
            }

            if (!imageData || !imageMimeType) {
              const errorMessage =
                language === 'fa'
                  ? '❌ خطا در دریافت تصویر. لطفاً دوباره تلاش کنید.'
                  : '❌ Error getting image. Please try again.';
              await telegramService.sendMessage(chatId, errorMessage, {
                reply_markup: getAdminKeyboard(language),
              });
              return;
            }

            // Step 5: Show categories for selection
            const categories = await categoryService.findAll();
            const keyboard = categories.map((cat) => [
              {
                text: language === 'fa' ? cat.name : cat.nameFa || cat.name,
                callback_data: `select_cat_for_product_${cat.id}`,
              },
            ]);

            const categoryMessage =
              language === 'fa'
                ? '📁 دسته‌بندی محصول را انتخاب کنید:'
                : '📁 Select product category:';
            await telegramService.sendMessage(chatId, categoryMessage, {
              reply_markup: { inline_keyboard: keyboard },
            });

            // Store product data temporarily
            productCreationStates.set(telegramId, {
              name: name?.trim() || '',
              price,
              description: description?.trim() || '',
              imageData,
              imageMimeType,
            });
          } catch (error) {
            logger.error(`Error processing image: ${error.message}`);
            const errorMessage =
              language === 'fa'
                ? '❌ خطا در پردازش تصویر.'
                : '❌ Error processing image.';
            await telegramService.sendMessage(chatId, errorMessage, {
              reply_markup: getAdminKeyboard(language),
            });
          }
        });
      });
    });
  });
}

export async function handleCategorySelection(
  bot: TelegramBot,
  chatId: number,
  telegramId: string,
  categoryId: number,
  language: string,
  telegramService: TelegramService,
  productService: ProductService,
) {
  // Step 6: Ask for stock quantity
  const stockMessage =
    language === 'fa'
      ? '📊 موجودی انبار را وارد کنید:'
      : '📊 Enter stock quantity:';
  await telegramService.sendMessage(chatId, stockMessage, {
    reply_markup: { force_reply: true },
  });

  bot.once('message', async (msgStock) => {
    const stock = parseInt(msgStock.text || '0');

    if (isNaN(stock) || stock < 0) {
      const errorMessage =
        language === 'fa'
          ? '❌ موجودی نامعتبر است. لطفاً دوباره تلاش کنید.'
          : '❌ Invalid stock. Please try again.';
      await telegramService.sendMessage(chatId, errorMessage, {
        reply_markup: getAdminKeyboard(language),
      });
      return;
    }

    try {
      // Get stored product data
      const productData = productCreationStates.get(telegramId);
      if (!productData) {
        const errorMessage =
          language === 'fa'
            ? '❌ اطلاعات محصول یافت نشد. لطفاً دوباره تلاش کنید.'
            : '❌ Product data not found. Please try again.';
        await telegramService.sendMessage(chatId, errorMessage, {
          reply_markup: getAdminKeyboard(language),
        });
        return;
      }

      // Create the product
      await productService.create({
        name: productData.name,
        price: productData.price,
        description: productData.description,
        imageData: productData.imageData,
        imageMimeType: productData.imageMimeType,
        categoryId: categoryId,
        imageUrl: '',
        stock: stock,
        isActive: true,
      });

      // Clear stored data
      productCreationStates.delete(telegramId);

      const successMessage =
        language === 'fa'
          ? '✅ محصول با موفقیت اضافه شد!'
          : '✅ Product added successfully!';
      await telegramService.sendMessage(chatId, successMessage, {
        reply_markup: getAdminKeyboard(language),
      });
    } catch (error) {
      logger.error(`Error in add_product: ${error.message}`);
      productCreationStates.delete(telegramId);
      const errorMessage =
        language === 'fa'
          ? '❌ خطا در افزودن محصول رخ داد.'
          : '❌ Error occurred while adding product.';
      await telegramService.sendMessage(chatId, errorMessage, {
        reply_markup: getAdminKeyboard(language),
      });
    }
  });
}
