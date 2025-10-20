import { Logger } from '@nestjs/common';
import { CategoryService } from '.././category/category.service';
import { ProductService } from './product.service';
import { TelegramService } from '.././telegram/telegram.service';
import { getAdminKeyboard } from '.././telegram/utils/keyboards';
import TelegramBot = require('node-telegram-bot-api');

const logger = new Logger('ProductUpdateHelper');

export async function showProductsForEdit(
  chatId: number,
  language: string,
  telegramService: TelegramService,
  productService: ProductService,
) {
  const products = await productService.findAll();
  const keyboard = products.map((prod) => [
    {
      text: language === 'fa' ? prod.name : prod.nameJP || prod.name,
      callback_data: `edit_prod_${prod.id}`,
    },
  ]);
  const message =
    language === 'fa'
      ? '✏️ محصول مورد نظر برای ویرایش را انتخاب کنید:'
      : '✏️ Select product to edit:';
  await telegramService.sendMessage(chatId, message, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function startProductUpdate(
  bot: TelegramBot,
  chatId: number,
  telegramId: string,
  productId: number,
  language: string,
  telegramService: TelegramService,
  productService: ProductService,
  categoryService: CategoryService,
) {
  // Get current product data
  const currentProduct = await productService.findOne(productId);
  if (!currentProduct) {
    const errorMessage =
      language === 'fa' ? '❌ محصول یافت نشد.' : '❌ Product not found.';
    await telegramService.sendMessage(chatId, errorMessage, {
      reply_markup: getAdminKeyboard(language),
    });
    return;
  }

  // Step 1: Ask for new name
  const nameMessage =
    language === 'fa'
      ? `📦 نام جدید محصول را وارد کنید:\n\nنام فعلی: ${currentProduct.name}`
      : `📦 Enter new product name:\n\nCurrent: ${currentProduct.name}`;
  await telegramService.sendMessage(chatId, nameMessage, {
    reply_markup: { force_reply: true },
  });

  bot.once('message', async (msgName) => {
    const name = msgName.text?.trim() || currentProduct.name;

    // Step 2: Ask for new price
    const priceMessage =
      language === 'fa'
        ? `💰 قیمت جدید محصول را وارد کنید (به تومان):\n\nقیمت فعلی: ${currentProduct.price}`
        : `💰 Enter new product price (in Toman):\n\nCurrent: ${currentProduct.price}`;
    await telegramService.sendMessage(chatId, priceMessage, {
      reply_markup: { force_reply: true },
    });

    bot.once('message', async (msgPrice) => {
      const price = parseFloat(msgPrice.text || String(currentProduct.price));

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

      // Step 3: Ask for new description
      const descMessage =
        language === 'fa'
          ? `📝 توضیحات جدید محصول را وارد کنید (اختیاری):\n\nتوضیحات فعلی: ${currentProduct.description || 'ندارد'}`
          : `📝 Enter new product description (optional):\n\nCurrent: ${currentProduct.description || 'None'}`;
      await telegramService.sendMessage(chatId, descMessage, {
        reply_markup: { force_reply: true },
      });

      bot.once('message', async (msgDesc) => {
        const description = msgDesc.text?.trim() || currentProduct.description;

        // Step 4: Ask for new image URL
        const imageMessage =
          language === 'fa'
            ? `🖼 لینک تصویر جدید محصول را وارد کنید:\n\nلینک فعلی: ${currentProduct.imageUrl}`
            : `🖼 Enter new product image URL:\n\nCurrent: ${currentProduct.imageUrl}`;
        await telegramService.sendMessage(chatId, imageMessage, {
          reply_markup: { force_reply: true },
        });

        bot.once('message', async (msgImage) => {
          const imageUrl = msgImage.text?.trim() || currentProduct.imageUrl;

          // Step 5: Show categories for selection
          try {
            const categories = await categoryService.findAll();
            const keyboard = categories.map((cat) => [
              {
                text:
                  (language === 'fa' ? cat.name : cat.nameFa || cat.name) +
                  (cat.id === currentProduct.category?.id ? ' ✓' : ''), // Changed this line
                callback_data: `update_cat_for_product_${productId}_${cat.id}`,
              },
            ]);

            const categoryMessage =
              language === 'fa'
                ? `📁 دسته‌بندی جدید محصول را انتخاب کنید:\n\nدسته‌بندی فعلی: ${currentProduct.category?.name || 'نامشخص'}`
                : `📁 Select new product category:\n\nCurrent: ${currentProduct.category?.name || 'Unknown'}`;
            await telegramService.sendMessage(chatId, categoryMessage, {
              reply_markup: { inline_keyboard: keyboard },
            });

            // Store update data temporarily in a Map
            if (!global.productUpdateStates) {
              global.productUpdateStates = new Map();
            }
            global.productUpdateStates.set(`${telegramId}_${productId}`, {
              productId,
              name,
              price,
              description,
              imageUrl,
            });
          } catch (error) {
            logger.error(`Error fetching categories: ${error.message}`);
            const errorMessage =
              language === 'fa'
                ? '❌ خطا در دریافت دسته‌بندی‌ها.'
                : '❌ Error fetching categories.';
            await telegramService.sendMessage(chatId, errorMessage, {
              reply_markup: getAdminKeyboard(language),
            });
          }
        });
      });
    });
  });
}

export async function handleCategorySelectionForUpdate(
  bot: TelegramBot,
  chatId: number,
  telegramId: string,
  productId: number,
  categoryId: number,
  language: string,
  telegramService: TelegramService,
  productService: ProductService,
) {
  const currentProduct = await productService.findOne(productId);
  if (!currentProduct) {
    const errorMessage =
      language === 'fa' ? '❌ محصول یافت نشد.' : '❌ Product not found.';
    await telegramService.sendMessage(chatId, errorMessage, {
      reply_markup: getAdminKeyboard(language),
    });
    return;
  }

  // Step 6: Ask for new stock
  const stockMessage =
    language === 'fa'
      ? `📊 موجودی انبار جدید را وارد کنید:\n\nموجودی فعلی: ${currentProduct.stock}`
      : `📊 Enter new stock quantity:\n\nCurrent: ${currentProduct.stock}`;
  await telegramService.sendMessage(chatId, stockMessage, {
    reply_markup: { force_reply: true },
  });

  bot.once('message', async (msgStock) => {
    const stock = parseInt(msgStock.text || String(currentProduct.stock));

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
      // Get stored update data
      const updateData = global.productUpdateStates?.get(
        `${telegramId}_${productId}`,
      );
      if (!updateData) {
        const errorMessage =
          language === 'fa'
            ? '❌ اطلاعات محصول یافت نشد. لطفاً دوباره تلاش کنید.'
            : '❌ Product data not found. Please try again.';
        await telegramService.sendMessage(chatId, errorMessage, {
          reply_markup: getAdminKeyboard(language),
        });
        return;
      }

      // Update the product
      await productService.update(productId, {
        name: updateData.name,
        price: updateData.price,
        description: updateData.description,
        imageUrl: updateData.imageUrl,
        categoryId: categoryId,
        stock: stock,
      });

      // Clear stored data
      global.productUpdateStates.delete(`${telegramId}_${productId}`);

      const successMessage =
        language === 'fa'
          ? '✅ محصول با موفقیت به‌روزرسانی شد!'
          : '✅ Product updated successfully!';
      await telegramService.sendMessage(chatId, successMessage, {
        reply_markup: getAdminKeyboard(language),
      });
    } catch (error) {
      logger.error(`Error in update_product: ${error.message}`);
      global.productUpdateStates?.delete(`${telegramId}_${productId}`);
      const errorMessage =
        language === 'fa'
          ? '❌ خطا در به‌روزرسانی محصول رخ داد.'
          : '❌ Error occurred while updating product.';
      await telegramService.sendMessage(chatId, errorMessage, {
        reply_markup: getAdminKeyboard(language),
      });
    }
  });
}
