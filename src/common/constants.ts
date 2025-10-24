export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PAYMENT_VALIDATED: 'payment_validated',
  PAYMENT_INVALIDATED: 'payment_invalidated',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const DELIVERY_STATUS = {
  PENDING: 'pending',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;
