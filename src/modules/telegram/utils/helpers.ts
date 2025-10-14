import { Category } from '../../category/category.entity';
import { Feedback } from '../../feedback/feedback.entity';
import { Order } from '../../order/order.entity';
import { Product } from '../../product/product.entity';
import { User } from '../../user/user.entity';
import { Delivery } from '../../delivery/delivery.entity';
import { ORDER_STATUS } from '../../../common/constants';

export function formatProductMessage(
  product: Product,
  language: string = 'fa',
): string {
  if (product.stock === 0) {
    return language === 'fa'
      ? '❌ این محصول در انبار موجود نیست.'
      : '❌ This product is out of stock.';
  }
  const name = language === 'fa' ? product.name : product.nameJP;
  const description =
    language === 'fa' ? product.description : product.description;
  return [
    `<b>${name || (language === 'fa' ? 'نام وارد نشده' : 'Name not specified')}</b>`,
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
      return `${language === 'fa' ? '📋 <b>شناسه</b>' : '📋 <b>ID</b>'}: ${cat.id}, <b>${language === 'fa' ? 'نام' : 'Name'}</b>: ${name || (language === 'fa' ? 'نام وارد نشده' : 'Name not specified')}, <b>${language === 'fa' ? 'توضیحات' : 'Description'}</b>: ${description || (language === 'fa' ? 'بدون توضیحات' : 'No description')}`;
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
      const name = language === 'fa' ? prod.name : prod.nameJP;
      const categoryName =
        language === 'fa'
          ? prod.category?.name || 'N/A'
          : prod.category?.nameFa || 'N/A';
      return `${language === 'fa' ? '📋 <b>شناسه</b>' : '📋 <b>ID</b>'}: ${prod.id}, <b>${language === 'fa' ? 'نام' : 'Name'}</b>: ${name || (language === 'fa' ? 'نام وارد نشده' : 'Name not specified')}, 💸 <b>${language === 'fa' ? 'قیمت' : 'Price'}</b>: ${prod.price} تومان, 📌 <b>${language === 'fa' ? 'دسته‌بندی' : 'Category'}</b>: ${categoryName}, 📦 <b>${language === 'fa' ? 'در انبار' : 'In stock'}</b>: ${prod.stock}`;
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
        `${language === 'fa' ? '👤 <b>شناسه</b>' : '👤 <b>ID</b>'}: ${user.id}, <b>${language === 'fa' ? 'نام' : 'Name'}</b>: ${user.fullName || (language === 'fa' ? 'وارد نشده' : 'Not specified')}, 📞 <b>${language === 'fa' ? 'تلفن' : 'Phone'}</b>: ${user.phone || (language === 'fa' ? 'وارد نشده' : 'Not specified')}, 🆔 <b>Telegram ID</b>: ${user.telegramId}, <b>${language === 'fa' ? 'مدیر' : 'Admin'}</b>: ${user.isAdmin ? (language === 'fa' ? '✅ بله' : '✅ Yes') : language === 'fa' ? '❌ خیر' : '❌ No'}`,
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
        `${language === 'fa' ? '📋 <b>شناسه</b>' : '📋 <b>ID</b>'}: ${fb.id}, 📦 <b>${language === 'fa' ? 'محصول' : 'Product'}</b>: ${language === 'fa' ? fb.product.name : fb.product.nameJP || fb.product.name}, 👤 <b>${language === 'fa' ? 'کاربر' : 'User'}</b>: ${fb.user?.fullName || (language === 'fa' ? 'وارد نشده' : 'Not specified')}, ⭐ <b>${language === 'fa' ? 'امتیاز' : 'Rating'}</b>: ${fb.rating}, 💬 <b>${language === 'fa' ? 'نظر' : 'Comment'}</b>: ${fb.comment}`,
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
            `${language === 'fa' ? item.product.name : item.product.nameJP || item.product.name} - ${item.quantity} ${language === 'fa' ? 'عدد' : 'pcs.'}`,
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
        `${language === 'fa' ? '📋 <b>تحویل</b>' : '📋 <b>Delivery</b>'} #${delivery.id}`,
        `${language === 'fa' ? '📋 <b>شناسه سفارش</b>' : '📋 <b>Order ID</b>'}: ${delivery.order.id}`,
        `${language === 'fa' ? '👤 <b>کاربر</b>' : '👤 <b>User</b>'}: ${delivery.order.user?.fullName || (language === 'fa' ? 'وارد نشده' : 'Not specified')}`,
        `${language === 'fa' ? '📍 <b>آدرس</b>' : '📍 <b>Address</b>'}: (${delivery.latitude}, ${delivery.longitude})`,
        `${language === 'fa' ? '🏠 <b>جزئیات</b>' : '🏠 <b>Details</b>'}: ${delivery.addressDetails || 'N/A'}`,
        `${language === 'fa' ? '📊 <b>وضعیت</b>' : '📊 <b>Status</b>'}: ${delivery.status}`,
        `${language === 'fa' ? '🚚 <b>پیک</b>' : '🚚 <b>Courier</b>'}: ${delivery.courierName || 'N/A'}`,
        `${language === 'fa' ? '📞 <b>تلفن</b>' : '📞 <b>Phone</b>'}: ${delivery.courierPhone || 'N/A'}`,
        `${language === 'fa' ? '📅 <b>تاریخ تحویل</b>' : '📅 <b>Delivery date</b>'}: ${delivery.deliveryDate?.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US') || 'N/A'}`,
        `${language === 'fa' ? '🔍 <b>شماره پیگیری</b>' : '🔍 <b>Tracking number</b>'}: ${delivery.trackingNumber || 'N/A'}`,
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
    `${language === 'fa' ? '📊 <b>آمار</b>' : '📊 <b>Statistics</b>'}`,
    `━━━━━━━━━━━━━━━`,
    `${language === 'fa' ? '📋 <b>کل سفارشات</b>' : '📋 <b>Total orders</b>'}: ${stats.totalOrders}`,
    `${language === 'fa' ? '💸 <b>مجموع مبلغ (پرداخت شده)</b>' : '💸 <b>Total amount (paid)</b>'}: ${stats.totalAmount} تومان`,
    `${language === 'fa' ? '⏳ <b>سفارشات در انتظار</b>' : '⏳ <b>Pending orders</b>'}: ${stats.pendingOrders}`,
    `${language === 'fa' ? '✅ <b>سفارشات پرداخت شده</b>' : '✅ <b>Paid orders</b>'}: ${stats.paidOrders}`,
    `${language === 'fa' ? '🚚 <b>در حال ارسال</b>' : '🚚 <b>In delivery</b>'}: ${stats.shippedOrders}`,
    `${language === 'fa' ? '✔️ <b>تحویل داده شده</b>' : '✔️ <b>Delivered</b>'}: ${stats.deliveredOrders}`,
    `${language === 'fa' ? '❌ <b>لغو شده</b>' : '❌ <b>Cancelled</b>'}: ${stats.cancelledOrders}`,
    `${language === 'fa' ? '📦 <b>محصولات فروخته شده</b>' : '📦 <b>Sold products</b>'}: ${stats.soldProducts}`,
    `${language === 'fa' ? '🛒 <b>محصولات در سبد خرید</b>' : '🛒 <b>Cart items</b>'}: ${stats.cartItems}`,
    `━━━━━━━━━━━━━━━`,
    `${language === 'fa' ? '📅 <b>گزارش ماهانه (پرداخت شده)</b>' : '📅 <b>Monthly report (paid)</b>'}:`,
    monthlyStats,
    `━━━━━━━━━━━━━━━`,
    `${language === 'fa' ? '📅 <b>گزارش سالانه (پرداخت شده)</b>' : '📅 <b>Yearly report (paid)</b>'}:`,
    yearlyStats,
    `━━━━━━━━━━━━━━━`,
  ].join('\n');
}
