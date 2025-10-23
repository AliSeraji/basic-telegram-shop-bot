import { Category } from '../../category/category.entity';
import { Feedback } from '../../feedback/feedback.entity';
import { Order } from '../../order/order.entity';
import { Product } from '../../product/product.entity';
import { User } from '../../user/user.entity';
import { Delivery } from '../../delivery/delivery.entity';

export function formatProductMessage(
  product: Product,
  language: string = 'fa',
): string {
  if (product.stock === 0) {
    return language === 'fa'
      ? '❌ این محصول در انبار موجود نیست.'
      : '❌ This product is out of stock.';
  }
  const name = language === 'fa' ? product.name : product.name;
  const description =
    language === 'fa' ? product.description : product.description;
  return [
    `${name || (language === 'fa' ? 'نام وارد نشده' : 'Name not specified')}`,
    `${description || (language === 'fa' ? 'بدون توضیحات' : 'No description')}`,
    `💸 ${language === 'fa' ? 'قیمت' : 'Price'}: ${product.price} تومان`,
    `📦 ${language === 'fa' ? 'در انبار' : 'In stock'}: ${product.stock} ${language === 'fa' ? 'عدد' : 'pcs.'}`,
  ].join('\n');
}

export function formatCategoryList(
  categories: Category[],
  language: string = 'fa',
): string {
  if (!categories.length)
    return language === 'fa'
      ? '❌ دسته‌بندی موجود نیست.'
      : '❌ No categories available.';
  return categories
    .map((cat) => {
      const name = language === 'fa' ? cat.name : cat.nameFa;
      const description =
        language === 'fa' ? cat.description : cat.descriptionFa;
      return `${language === 'fa' ? '📋 شناسه' : '📋 ID'}: ${cat.id}, ${language === 'fa' ? 'نام' : 'Name'}: ${name || (language === 'fa' ? 'نام وارد نشده' : 'Name not specified')}, ${language === 'fa' ? 'توضیحات' : 'Description'}: ${description || (language === 'fa' ? 'بدون توضیحات' : 'No description')}`;
    })
    .join('\n');
}

export function formatProductList(
  products: Product[],
  language: string = 'fa',
): string {
  if (!products.length)
    return language === 'fa'
      ? '❌ محصولی موجود نیست.'
      : '❌ No products available.';
  const availableProducts = products.filter((prod) => prod.stock > 0);
  if (!availableProducts.length)
    return language === 'fa'
      ? '❌ محصولی در انبار موجود نیست.'
      : '❌ No products in stock.';
  return availableProducts
    .map((prod) => {
      const name = language === 'fa' ? prod.name : prod.name;
      const categoryName =
        language === 'fa'
          ? prod.category?.name || 'N/A'
          : prod.category?.nameFa || 'N/A';
      return `${language === 'fa' ? '📋 شناسه' : '📋 ID'}: ${prod.id}, ${language === 'fa' ? 'نام' : 'Name'}: ${name || (language === 'fa' ? 'نام وارد نشده' : 'Name not specified')}, 💸 ${language === 'fa' ? 'قیمت' : 'Price'}: ${prod.price} تومان, 📌 ${language === 'fa' ? 'دسته‌بندی' : 'Category'}: ${categoryName}, 📦 ${language === 'fa' ? 'در انبار' : 'In stock'}: ${prod.stock}`;
    })
    .join('\n');
}

export function formatUserList(users: User[], language: string = 'fa'): string {
  if (!users.length)
    return language === 'fa'
      ? '❌ کاربری موجود نیست.'
      : '❌ No users available.';
  return users
    .map(
      (user) =>
        `${language === 'fa' ? '👤 شناسه' : '👤 ID'}: ${user.id}, ${language === 'fa' ? 'نام' : 'Name'}: ${user.fullName || (language === 'fa' ? 'وارد نشده' : 'Not specified')}, 📞 ${language === 'fa' ? 'تلفن' : 'Phone'}: ${user.phone || (language === 'fa' ? 'وارد نشده' : 'Not specified')}, 🆔 Telegram ID: ${user.telegramId}, ${language === 'fa' ? 'مدیر' : 'Admin'}: ${user.isAdmin ? (language === 'fa' ? '✅ بله' : '✅ Yes') : language === 'fa' ? '❌ خیر' : '❌ No'}`,
    )
    .join('\n');
}

export function formatFeedbackList(
  feedbacks: Feedback[],
  language: string = 'fa',
): string {
  if (!feedbacks.length)
    return language === 'fa'
      ? '❌ بازخوردی موجود نیست.'
      : '❌ No feedback available.';
  return feedbacks
    .map(
      (fb) =>
        `${language === 'fa' ? '📋 شناسه' : '📋 ID'}: ${fb.id}, 📦 ${language === 'fa' ? 'محصول' : 'Product'}: ${language === 'fa' ? fb.product.name : fb.product.name || fb.product.name}, 👤 ${language === 'fa' ? 'کاربر' : 'User'}: ${fb.user?.fullName || (language === 'fa' ? 'وارد نشده' : 'Not specified')}, ⭐ ${language === 'fa' ? 'امتیاز' : 'Rating'}: ${fb.rating}, 💬 ${language === 'fa' ? 'نظر' : 'Comment'}: ${fb.comment}`,
    )
    .join('\n');
}

export function formatOrderList(
  orders: Order[],
  language: string = 'fa',
): string {
  if (!orders.length)
    return language === 'fa'
      ? '❌ سفارشی موجود نیست.'
      : '❌ No orders available.';
  return orders
    .map((order) => {
      const items = order.orderItems
        ?.map(
          (item) =>
            `${language === 'fa' ? item.product.name : item.product.name || item.product.name} - ${item.quantity} ${language === 'fa' ? 'عدد' : 'pcs.'}`,
        )
        .join(', ');
      const delivery =
        order.deliveries && order.deliveries.length > 0
          ? [
              `${language === 'fa' ? '📍 آدرس' : '📍 Address'}: (${order.deliveries[0].latitude}, ${order.deliveries[0].longitude})`,
              `${language === 'fa' ? '🏠 جزئیات' : '🏠 Details'}: ${order.deliveries[0].addressDetails || 'N/A'}`,
              `${language === 'fa' ? '📊 وضعیت تحویل' : '📊 Delivery status'}: ${order.deliveries[0].status || 'N/A'}`,
              `${language === 'fa' ? '🚚 پیک' : '🚚 Courier'}: ${order.deliveries[0].courierName || 'N/A'}`,
              `${language === 'fa' ? '📞 تلفن' : '📞 Phone'}: ${order.deliveries[0].courierPhone || 'N/A'}`,
              `${language === 'fa' ? '📅 تاریخ تحویل' : '📅 Delivery date'}: ${order.deliveries[0].deliveryDate?.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US') || 'N/A'}`,
            ].join('\n')
          : language === 'fa'
            ? '❌ اطلاعات تحویل موجود نیست'
            : '❌ No delivery data available';

      return [
        `${language === 'fa' ? '📋 سفارش' : '📋 Order'} #${order.id}`,
        `${language === 'fa' ? '👤 کاربر' : '👤 User'}: ${order.user?.fullName || (language === 'fa' ? 'وارد نشده' : 'Not specified')}`,
        `${language === 'fa' ? '💸 جمع کل' : '💸 Total'}: ${order.totalAmount} تومان`,
        `${language === 'fa' ? '📊 وضعیت' : '📊 Status'}: ${order.status}`,
        `${language === 'fa' ? '💵 نوع پرداخت' : '💵 Payment type'}: ${order.paymentType || (language === 'fa' ? 'پرداخت نشده' : 'Not paid')}`,
        `${language === 'fa' ? '📦 محصولات' : '📦 Products'}: ${items || 'N/A'}`,
        delivery,
        `━━━━━━━━━━━━━━━`,
      ].join('\n');
    })
    .join('\n');
}

export function formatDeliveryList(
  deliveries: Delivery[],
  language: string = 'fa',
): string {
  if (!deliveries.length)
    return language === 'fa'
      ? '❌ تحویلی موجود نیست.'
      : '❌ No deliveries available.';
  return deliveries
    .map((delivery) => {
      return [
        `${language === 'fa' ? '📋 تحویل' : '📋 Delivery'} #${delivery.id}`,
        `${language === 'fa' ? '📋 شناسه سفارش' : '📋 Order ID'}: ${delivery.order.id}`,
        `${language === 'fa' ? '👤 کاربر' : '👤 User'}: ${delivery.order.user?.fullName || (language === 'fa' ? 'وارد نشده' : 'Not specified')}`,
        `${language === 'fa' ? '📍 آدرس' : '📍 Address'}: (${delivery.latitude}, ${delivery.longitude})`,
        `${language === 'fa' ? '🏠 جزئیات' : '🏠 Details'}: ${delivery.addressDetails || 'N/A'}`,
        `${language === 'fa' ? '📊 وضعیت' : '📊 Status'}: ${delivery.status}`,
        `${language === 'fa' ? '🚚 پیک' : '🚚 Courier'}: ${delivery.courierName || 'N/A'}`,
        `${language === 'fa' ? '📞 تلفن' : '📞 Phone'}: ${delivery.courierPhone || 'N/A'}`,
        `${language === 'fa' ? '📅 تاریخ تحویل' : '📅 Delivery date'}: ${delivery.deliveryDate?.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US') || 'N/A'}`,
        `${language === 'fa' ? '🔍 شماره پیگیری' : '🔍 Tracking number'}: ${delivery.trackingNumber || 'N/A'}`,
        `━━━━━━━━━━━━━━━`,
      ].join('\n');
    })
    .join('\n');
}

export function formatStats(stats: any, language: string = 'fa'): string {
  const monthlyStats =
    Object.entries(stats.monthlyStats || {})
      .map(([month, amount]) => `📆 ${month}: ${amount} تومان`)
      .join('\n') ||
    (language === 'fa' ? 'اطلاعاتی موجود نیست' : 'No data available');
  const yearlyStats =
    Object.entries(stats.yearlyStats || {})
      .map(([year, amount]) => `📆 ${year}: ${amount} تومان`)
      .join('\n') ||
    (language === 'fa' ? 'اطلاعاتی موجود نیست' : 'No data available');

  return [
    `${language === 'fa' ? '📊 آمار' : '📊 Statistics'}`,
    `━━━━━━━━━━━━━━━`,
    `${language === 'fa' ? '📋 کل سفارشات' : '📋 Total orders'}: ${stats.totalOrders}`,
    `${language === 'fa' ? '💸 مجموع مبلغ (پرداخت شده)' : '💸 Total amount (paid)'}: ${stats.totalAmount} تومان`,
    `${language === 'fa' ? '⏳ سفارشات در انتظار' : '⏳ Pending orders'}: ${stats.pendingOrders}`,
    `${language === 'fa' ? '✅ سفارشات پرداخت شده' : '✅ Paid orders'}: ${stats.paidOrders}`,
    `${language === 'fa' ? '🚚 در حال ارسال' : '🚚 In delivery'}: ${stats.shippedOrders}`,
    `${language === 'fa' ? '✔️ تحویل داده شده' : '✔️ Delivered'}: ${stats.deliveredOrders}`,
    `${language === 'fa' ? '❌ لغو شده' : '❌ Cancelled'}: ${stats.cancelledOrders}`,
    `${language === 'fa' ? '📦 محصولات فروخته شده' : '📦 Sold products'}: ${stats.soldProducts}`,
    `${language === 'fa' ? '🛒 محصولات در سبد خرید' : '🛒 Cart items'}: ${stats.cartItems}`,
    `━━━━━━━━━━━━━━━`,
    `${language === 'fa' ? '📅 گزارش ماهانه (پرداخت شده)' : '📅 Monthly report (paid)'}:`,
    monthlyStats,
    `━━━━━━━━━━━━━━━`,
    `${language === 'fa' ? '📅 گزارش سالانه (پرداخت شده)' : '📅 Yearly report (paid)'}:`,
    yearlyStats,
    `━━━━━━━━━━━━━━━`,
  ].join('\n');
}
