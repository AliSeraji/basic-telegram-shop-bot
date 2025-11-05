import * as TelegramBot from 'node-telegram-bot-api';

export function getMainKeyboard(
  showContact: boolean,
  language: string = 'fa',
): TelegramBot.SendMessageOptions['reply_markup'] {
  const keyboard: TelegramBot.KeyboardButton[][] = [
    [
      { text: language === 'fa' ? '📁 لیست محصولات' : '📁 Categories' },
      { text: language === 'fa' ? '🛒 سبد خرید' : '🛒 Cart' },
    ],
    [
      { text: language === 'fa' ? '👤 پروفایل من' : '👤 My Profile' },
      { text: language === 'fa' ? '🕘 تاریخچه سفارشات' : '🕘 Order History' },
    ],
    [
      { text: language === 'fa' ? 'ℹ️ درباره ما' : 'ℹ️ About Us' },
      { text: language === 'fa' ? '🆘 پشتیبانی' : '🆘 Help' },
    ],
  ];

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function getAdminKeyboard(
  language: string = 'fa',
): TelegramBot.SendMessageOptions['reply_markup'] {
  return {
    inline_keyboard: [
      [
        {
          text:
            language === 'fa' ? '📋 مشاهده دسته‌بندی‌ها' : '📋 View Categories',
          callback_data: 'view_categories',
        },
        {
          text: language === 'fa' ? '➕ افزودن دسته‌بندی' : '➕ Add Category',
          callback_data: 'add_category',
        },
      ],
      [
        {
          text: language === 'fa' ? '✏️ ویرایش دسته‌بندی' : '✏️ Edit Category',
          callback_data: 'edit_category',
        },
        {
          text: language === 'fa' ? '🗑️ حذف دسته‌بندی' : '🗑️ Delete Category',
          callback_data: 'delete_category',
        },
      ],
      [
        {
          text: language === 'fa' ? '📋 مشاهده محصولات' : '📋 View Products',
          callback_data: 'view_products',
        },
        {
          text: language === 'fa' ? '➕ افزودن محصول' : '➕ Add Product',
          callback_data: 'add_product',
        },
      ],
      [
        {
          text: language === 'fa' ? '✏️ ویرایش محصول' : '✏️ Edit Product',
          callback_data: 'edit_product',
        },
        {
          text: language === 'fa' ? '🗑️ حذف محصول' : '🗑️ Delete Product',
          callback_data: 'delete_product',
        },
      ],
      [
        {
          text: language === 'fa' ? '👥 مشاهده کاربران' : '👥 View Users',
          callback_data: 'view_users',
        },
        {
          text: language === 'fa' ? '✏️ ویرایش کاربر' : '✏️ Edit User',
          callback_data: 'edit_user',
        },
        {
          text: language === 'fa' ? '🗑️ حذف کاربر' : '🗑️ Delete User',
          callback_data: 'delete_user',
        },
      ],
      [
        {
          text: language === 'fa' ? '📦 سفارشات' : '📦 Orders',
          callback_data: 'view_orders',
        },
        {
          text: language === 'fa' ? '📦 مدیریت سفارشات' : '📦 Manage Orders', // NEW BUTTON
          callback_data: 'manage_orders',
        },
      ],
      [
        {
          text: language === 'fa' ? '🔍 جستجوی سفارش' : '🔍 Search Order', // NEW BUTTON
          callback_data: 'search_order',
        },
      ],
      [
        {
          text: language === 'fa' ? '🗒️ بازخوردها' : '🗒️ Feedbacks',
          callback_data: 'view_feedback',
        },
        {
          text: language === 'fa' ? '🗑️ حذف بازخورد' : '🗑️ Delete Feedback',
          callback_data: 'delete_feedback',
        },
      ],
      [
        {
          text: language === 'fa' ? '📊 آمار' : '📊 Statistics',
          callback_data: 'view_stats',
        },
      ],
    ],
  };
}
