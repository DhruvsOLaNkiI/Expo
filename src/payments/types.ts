/** Payment domain types — see PAYMENTS_ARCHITECTURE.md */

export type PaymentKind = 'exhibitor' | 'visitor' | 'eoi';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export type PaymentGateway = 'razorpay' | 'stripe';

export type PaymentPlan = {
  planId: string;
  kind: PaymentKind;
  label: string;
  /** Amount in smallest currency unit (paise for INR). */
  amountPaise: number;
  currency: string;
  hallId?: string;
  boothTier?: 'standard' | 'premium';
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentOrder = {
  orderId: string;
  planId: string;
  kind: PaymentKind;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;

  visitorId?: string;
  exhibitorEmail?: string;
  boothId?: string;
  hallId?: string;

  gateway: PaymentGateway;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  idempotencyKey?: string;
  webhookEventIds: string[];

  metadata?: Record<string, string>;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentWebhookEvent = {
  eventId: string;
  type: string;
  orderId?: string;
  payload: unknown;
  processedAt: Date;
  ok: boolean;
  error?: string;
};

export type ExhibitorEntitlement = {
  exhibitorEmail: string;
  boothId: string;
  hallId: string;
  paidUntil: Date | null;
  lastOrderId: string;
  updatedAt: Date;
};

/** POST /api/payments/create-order */
export type CreatePaymentOrderRequest = {
  planId: string;
  visitorId?: string;
  exhibitorEmail?: string;
  boothId?: string;
  hallId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
};

export type CreatePaymentOrderResponse = {
  ok: true;
  orderId: string;
  amountPaise: number;
  currency: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
};

export type PaymentOrderStatusResponse = {
  ok: true;
  order: Pick<
    PaymentOrder,
    'orderId' | 'status' | 'planId' | 'kind' | 'amountPaise' | 'currency' | 'paidAt' | 'boothId' | 'hallId'
  >;
};

export const PAYMENT_COLLECTIONS = {
  plans: 'paymentPlans',
  orders: 'paymentOrders',
  webhookEvents: 'paymentWebhookEvents',
  entitlements: 'exhibitorEntitlements',
} as const;
