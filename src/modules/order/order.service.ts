import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UserService } from '../user/user.service';
import { CartService } from '../cart/cart.service';
import { ProductService } from '../product/product.service';
import { ORDER_STATUS } from '../../common/constants';
import { TelegramService } from '../telegram/telegram.service';
import TelegramBot from 'node-telegram-bot-api';
import { getOrderStatusText } from '../telegram/utils/helpers';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private userService: UserService,
    private cartService: CartService,
    private productService: ProductService,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
  ) {}

  async createOrder(telegramId: string): Promise<Order> {
    this.logger.log(`Creating order for telegramId: ${telegramId}`);
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      this.logger.error(`User not found for telegramId: ${telegramId}`);
      throw new NotFoundException('User not found');
    }

    const cartItems = await this.cartService.getCartItems(telegramId);
    if (!cartItems.length) {
      this.logger.error('Cart is empty');
      throw new Error('Cart is empty');
    }

    const order = this.orderRepository.create({
      user,
      totalAmount: 0,
      status: ORDER_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const savedOrder = await this.orderRepository.save(order);

    let totalAmount = 0;
    const orderItems = await Promise.all(
      cartItems.map(async (item) => {
        const product = await this.productService.findOne(item.product.id);
        if (!product) {
          this.logger.error(`Product ID ${item.product.id} not found`);
          throw new NotFoundException(
            `Product ID ${item.product.id} not found`,
          );
        }
        if (product.stock < item.quantity) {
          this.logger.error(`Insufficient stock for product ${product.name}`);
          throw new Error(`Insufficient stock for Product ${product.name}`);
        }
        totalAmount += item.product.price * item.quantity;
        product.stock -= item.quantity;
        await this.productService.update(item.product.id, {
          stock: product.stock,
        });
        return this.orderItemRepository.create({
          order: savedOrder,
          product: item.product,
          quantity: item.quantity,
          price: item.product.price,
        });
      }),
    );

    await this.orderItemRepository.save(orderItems);
    savedOrder.totalAmount = totalAmount;
    savedOrder.orderItems = orderItems;
    await this.orderRepository.save(savedOrder);

    await this.cartService.clearCart(telegramId);
    //await this.notifyAdminOrderCreated(savedOrder, user);

    return savedOrder;
  }

  async notifyAdminsOfNewOrder(
    bot: TelegramBot,
    orderId: number,
    receiptImage: Buffer,
  ): Promise<void> {
    const order = await this.findOne(orderId);

    const adminMessage =
      `🔔 سفارش جدید دریافت شد!\n\n` +
      `📦 شناسه سفارش: ${order.id}\n` +
      `👤 کاربر: ${order.user?.fullName || 'نامشخص'}\n` +
      `💰 مبلغ: ${order.totalAmount.toLocaleString('fa-IR')} تومان\n` +
      `📋 کد پیگیری: ${order.trackingNumber}\n\n` +
      `لطفاً رسید را بررسی و تایید کنید.`;

    const admins = await this.userService.findAllAdmins();

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
  }

  async notifyAdminOrderCreated(order: Order, user: any) {
    const admins = await this.userService.findAllAdmins();

    for (const admin of admins) {
      const adminLang = admin.language || 'fa';
      const items = order.orderItems
        ?.map((item) =>
          adminLang === 'fa'
            ? `${item.product.name} - ${item.quantity} dona`
            : `${item.product.name} - ${item.quantity} шт.`,
        )
        .join(', ');

      const message =
        adminLang === 'fa'
          ? `🔔 <b>سفارش جدیدی ایجاد شده</b>\n` +
            `📋 <b>شماره سفارش:</b> ${order.id}\n` +
            `👤 <b>کاربر:</b> ${user.fullName || 'نام کاربر وارد نشده'}\n` +
            `📦 <b>محصولات:</b> ${items || 'هیچ محصولی وارد نشده'}\n` +
            `💸 <b>جمع سفارش:</b> ${order.totalAmount} ریال\n` +
            `📊 <b>وضعیت:</b> ${order.status}\n` +
            `━━━━━━━━━━━━━━━`
          : `🔔 <b>A new order has been created!</b>\n` +
            `📋 <b>ID:</b> ${order.id}\n` +
            `👤 <b>User:</b> ${user.fullName || 'Not specified'}\n` +
            `📦 <b>Products:</b> ${items || 'N/A'}\n` +
            `💸 <b>Total:</b> ${order.totalAmount} Rial\n` +
            `📊 <b>Status:</b> ${order.status}\n` +
            `━━━━━━━━━━━━━━━`;

      await this.telegramService.sendMessage(admin.telegramId, message, {
        parse_mode: 'HTML',
      });
    }
  }

  async findAll(page: number = 1, limit: number = 10): Promise<Order[]> {
    this.logger.log(`Fetching orders, page: ${page}, limit: ${limit}`);
    const orders = await this.orderRepository.find({
      relations: ['user', 'orderItems', 'orderItems.product', 'deliveries'],
      skip: (page - 1) * limit,
      take: limit,
    });
    this.logger.log(`Found ${orders.length} orders`);
    return orders;
  }

  async findOne(id: number): Promise<Order> {
    this.logger.log(`Fetching order with ID: ${id}`);
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'orderItems', 'orderItems.product', 'deliveries'],
    });
    if (!order) {
      this.logger.error(`Order ID ${id} not found`);
      throw new NotFoundException(`Order not found for ID ${id}`);
    }
    if (!order.user) {
      this.logger.warn(`Order ID ${id} has no associated user`);
    }
    return order;
  }

  async getUserOrders(
    telegramId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<Order[]> {
    this.logger.log(
      `Fetching orders for telegramId: ${telegramId}, page: ${page}, limit: ${limit}`,
    );
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      this.logger.error(`User not found for telegramId: ${telegramId}`);
      throw new NotFoundException('User not found');
    }
    const orders = await this.orderRepository.find({
      where: { user: { id: user.id } },
      relations: ['user', 'orderItems', 'orderItems.product', 'deliveries'],
      skip: (page - 1) * limit,
      take: limit,
    });
    this.logger.log(`Found ${orders.length} orders for user ${telegramId}`);
    return orders;
  }

  async updateStatus(
    id: number,
    status: (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS],
  ): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    order.updatedAt = new Date();
    await this.orderRepository.save(order);
    const language = order.user.language || 'fa';

    const message =
      language === 'fa'
        ? `وضعیت سفارش #${id} بروز رسانی شد\n${getOrderStatusText(status)}`
        : `📋 Order status #${id} has been updated: ${status}`;

    await this.telegramService.sendMessage(order.user.telegramId, message, {
      parse_mode: 'HTML',
    });

    return order;
  }

  async update(id: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    order.updatedAt = new Date();
    return this.orderRepository.save(order);
  }

  async getUserOrdersCount(telegramId: string): Promise<number> {
    return await this.orderRepository.count({
      where: { user: { telegramId } },
    });
  }

  async getStats(): Promise<{
    totalOrders: number;
    totalAmount: number;
    monthlyStats: any;
    yearlyStats: any;
    pendingOrders: number;
    paidOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    soldProducts: number;
    cartItems: number;
  }> {
    this.logger.log('Fetching order stats');
    const orders = await this.orderRepository.find({
      relations: ['orderItems', 'orderItems.product'],
    });
    const cartItems = await this.cartService.getAllCartItems();

    const monthlyStats = {};
    const yearlyStats = {};
    let pendingOrders = 0;
    let validatedPayments = 0;
    let invalidatedPayments = 0;
    let paidOrders = 0;
    let shippedOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let soldProducts = 0;
    let totalAmount = 0;

    const paidStatuses = [
      ORDER_STATUS.PAYMENT_VALIDATED,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
    ] as const;

    orders.forEach((order) => {
      if (order.status === ORDER_STATUS.PENDING) {
        pendingOrders++;
      } else if (order.status === ORDER_STATUS.PAID) {
        paidOrders++;
      } else if (order.status === ORDER_STATUS.PAYMENT_VALIDATED) {
        validatedPayments++;
        totalAmount += order.totalAmount;
      } else if (order.status === ORDER_STATUS.PAYMENT_INVALIDATED) {
        invalidatedPayments++;
      } else if (order.status === ORDER_STATUS.SHIPPED) {
        shippedOrders++;
        totalAmount += order.totalAmount;
      } else if (order.status === ORDER_STATUS.DELIVERED) {
        deliveredOrders++;
        totalAmount += order.totalAmount;
      } else if (order.status === ORDER_STATUS.CANCELLED) {
        cancelledOrders++;
      }

      if (
        paidStatuses.includes(
          order.status as
            | typeof ORDER_STATUS.PAYMENT_VALIDATED
            | typeof ORDER_STATUS.SHIPPED
            | typeof ORDER_STATUS.DELIVERED,
        )
      ) {
        const month = order.createdAt.toISOString().slice(0, 7);
        const year = order.createdAt.getFullYear();
        monthlyStats[month] = (monthlyStats[month] || 0) + order.totalAmount;
        yearlyStats[year] = (yearlyStats[year] || 0) + order.totalAmount;
        order.orderItems.forEach((item) => (soldProducts += item.quantity));
      }
    });

    return {
      totalOrders: orders.length,
      totalAmount,
      monthlyStats,
      yearlyStats,
      pendingOrders,
      paidOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      soldProducts,
      cartItems: cartItems.length,
    };
  }

  async getOrdersForAdmin(
    page: number = 1,
    limit: number = 5,
    status?: string,
    hasReceipt?: boolean,
  ): Promise<{ orders: Order[]; total: number }> {
    this.logger.log(
      `Fetching admin orders, page: ${page}, limit: ${limit}, status: ${status}, hasReceipt: ${hasReceipt}`,
    );

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (hasReceipt !== undefined) {
      if (hasReceipt) {
        queryBuilder.andWhere('order.receiptImage IS NOT NULL');
      } else {
        queryBuilder.andWhere('order.receiptImage IS NULL');
      }
    }

    const [orders, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    this.logger.log(`Found ${orders.length} orders out of ${total} total`);
    return { orders, total };
  }

  async updateOrderStatus(
    orderId: number,
    status: (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS],
  ): Promise<Order> {
    this.logger.log(`Updating order ${orderId} status to: ${status}`);
    const order = await this.findOne(orderId);
    order.status = status;
    order.updatedAt = new Date();
    return await this.orderRepository.save(order);
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Order | null> {
    this.logger.log(
      `Searching for order with tracking number: ${trackingNumber}`,
    );
    const order = await this.orderRepository.findOne({
      where: { trackingNumber },
      relations: ['user', 'orderItems', 'orderItems.product'],
    });

    if (!order) {
      this.logger.log(`No order found with tracking number: ${trackingNumber}`);
    }

    return order;
  }
}
