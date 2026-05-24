# Yuno Payments Knowledge Base

## Refunds
- Duplicate charges are refunded in full once verified against the order ID.
- Refunds typically settle to the original payment method within 5-10 business days.
- A refund requires the order ID and the customer's email on file.

## Failed transactions
- Most payment failures are temporary: insufficient funds, network timeouts, or issuer soft-declines.
- Retrying a soft-declined transaction with smart routing often succeeds on a second attempt.
- Hard declines (lost/stolen card, fraud flag) should not be retried and require customer contact.

## Payment methods
- Yuno supports 300+ payment methods across 80+ countries through a single API.
- Local payment methods improve authorization rates in emerging markets.

## Disputes / chargebacks
- A chargeback is a forced reversal initiated by the issuer; respond with evidence before the deadline.
- Providing clear receipts and delivery proof increases dispute win rates.
