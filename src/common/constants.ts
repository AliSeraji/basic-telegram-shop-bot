export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PAYMENT_VALIDATED: 'payment_validated',
  PAYMENT_INVALIDATED: 'payment_invalidated',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;


export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const PAYMENT_TYPE = {
  CLICK: 'click',
  CARD: 'card',
} as const;

export const DELIVERY_STATUS = {
  PENDING: 'pending',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;