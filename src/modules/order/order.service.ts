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
      paymentType: null,
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
    await this.notifyAdminOrderCreated(savedOrder, user);

    return savedOrder;
  }

  async notifyAdminOrderCreated(order: Order, user: any) {
    const admins = await this.userService.findAllAdmins(); // isAdmin=true bo‘lganlar

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
        ? `${status}: به روز رسانی شد ${id}# وضعیت سفارش📋`
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
}
