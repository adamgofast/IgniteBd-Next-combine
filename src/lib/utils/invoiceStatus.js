/**
 * Invoice Status Helper
 * 
 * Derives invoice status from payments ledger (DO NOT STORE status in DB)
 * 
 * Status values:
 * - "pending" - No payments received
 * - "partially_paid" - Some payments received but less than total
 * - "paid" - Total payments >= invoice totalAmount
 */

/**
 * Calculate invoice status from payments
 * @param {Object} invoice - Invoice object with totalAmount
 * @param {Array} payments - Array of Payment objects
 * @returns {string} - "pending" | "partially_paid" | "paid"
 */
export function getInvoiceStatus(invoice, payments = []) {
  if (!invoice || !invoice.totalAmount) {
    return 'pending';
  }

  // Sum all paid payments
  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amountReceived || 0), 0);

  if (totalPaid === 0) {
    return 'pending';
  }

  if (totalPaid < invoice.totalAmount) {
    return 'partially_paid';
  }

  // totalPaid >= invoice.totalAmount
  return 'paid';
}

/**
 * Calculate outstanding amount (totalAmount - totalPaid)
 * @param {Object} invoice - Invoice object with totalAmount
 * @param {Array} payments - Array of Payment objects
 * @returns {number} - Outstanding amount
 */
export function getOutstandingAmount(invoice, payments = []) {
  if (!invoice || !invoice.totalAmount) {
    return 0;
  }

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amountReceived || 0), 0);

  return Math.max(0, invoice.totalAmount - totalPaid);
}

/**
 * Get last payment date
 * @param {Array} payments - Array of Payment objects
 * @returns {Date|null} - Last payment date or null
 */
export function getLastPaymentDate(payments = []) {
  const paidPayments = payments
    .filter((p) => p.status === 'paid' && p.paidAt)
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

  return paidPayments.length > 0 ? paidPayments[0].paidAt : null;
}

