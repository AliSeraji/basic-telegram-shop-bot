import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { OrderService } from '../order/order.service';
import { ORDER_STATUS } from 'src/common/constants';

@Injectable()
export class PaymentService {
  private logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private orderService: OrderService,
  ) {}

  // async generatePaymentLink(
  //   orderId: number,
  //   paymentType: string,
  // ): Promise<string> {
  //   const order = await this.orderService.findOne(orderId);
  //   if (!order) {
  //     throw new NotFoundException(`No order found for ID ${orderId}`);
  //   }

  //   const normalizedType = (paymentType || '').toString().trim().toLowerCase();

  //   let normalizedPaymentType: (typeof PAYMENT_TYPE)[keyof typeof PAYMENT_TYPE];

  //   if (normalizedType === PAYMENT_TYPE.CLICK) {
  //     normalizedPaymentType = PAYMENT_TYPE.CLICK;
  //   } else if (normalizedType === PAYMENT_TYPE.CARD) {
  //     normalizedPaymentType = PAYMENT_TYPE.CARD;
  //   } else {
  //     throw new Error('❌ Incorrect payment type');
  //   }

  //   // Test qilish uchun oddiy link
  //   const testUrl = `https://example.com/pay/${normalizedPaymentType}/${order.id}`;

  //   const payment = this.paymentRepository.create({
  //     order,
  //     paymentType: normalizedPaymentType,
  //     amount: order.totalAmount,
  //     status: 'Pending',
  //     createdAt: new Date(),
  //   });

  //   await this.paymentRepository.save(payment);
  //   await this.orderService.update(order.id, {
  //     paymentType: normalizedPaymentType,
  //   });

  //   return testUrl;
  // }

  async handlePaymentCallback(paymentType: string, data: any): Promise<void> {
    let payment;
    if (paymentType.toLowerCase() === 'click') {
      payment = await this.paymentRepository.findOne({
        where: { order: { id: data.order_id } },
        relations: ['order'],
      });
      if (!payment) {
        throw new NotFoundException(
          `Order ${data.order_id} uchun to'lov topilmadi`,
        );
      }
      if (data.status === 'success') {
        await this.paymentRepository.update(payment.id, {
          status: 'Success',
          transactionId: data.transaction_id,
        });
        await this.orderService.updateStatus(data.order_id, ORDER_STATUS.PAID); // 'Paid' → 'paid'
        this.logger.log(`Click to‘lovi muvaffaqiyatli: Order ${data.order_id}`);
      } else {
        await this.paymentRepository.update(payment.id, { status: 'Failed' });
      }
    } else if (paymentType.toLowerCase() === 'payme') {
      payment = await this.paymentRepository.findOne({
        where: { order: { id: data.order_id } },
        relations: ['order'],
      });
      if (!payment) {
        throw new NotFoundException(
          `Order ${data.order_id} uchun to'lov topilmadi`,
        );
      }
      if (data.state === 1) {
        await this.paymentRepository.update(payment.id, {
          status: 'Success',
          transactionId: data.transaction_id,
        });
        await this.orderService.updateStatus(data.order_id, ORDER_STATUS.PAID);
        this.logger.log(`Payme to‘lovi muvaffaqiyatli: Order ${data.order_id}`);
      } else {
        await this.paymentRepository.update(payment.id, { status: 'Failed' });
      }
    }
  }
}
