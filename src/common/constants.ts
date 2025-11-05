export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PAYMENT_VALIDATED: 'payment_validated',
  PAYMENT_INVALIDATED: 'payment_invalidated',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const ORDERSTATTEXT = {
  PENDING: 'در انتظار پرداخت',
  PAID: 'پرداخت شده',
  PAYMENT_VALIDATED: 'پرداخت تایید شده',
  PAYMENT_INVALIDATED: 'پرداخت نامعتبر',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل داده شده',
  CANCELLED: 'لغو شده',
};

export const DELIVERY_STATUS = {
  PENDING: 'pending',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export interface OrderStatistics {
  totalOrders: number;
  totalAmount: number;
  monthlyStats: any;
  yearlyStats: any;
  pendingOrders: number;
  paidOrders: number;
  validatedPayments: number;
  invalidatedPayments: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  soldProducts: number;
  cartItems: number;
}
