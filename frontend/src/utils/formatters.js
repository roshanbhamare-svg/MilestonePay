const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export function formatCurrency(amount, currency = 'USD') {
  const numeric = Number(amount ?? 0);
  if (Number.isNaN(numeric)) return `${CURRENCY_SYMBOLS[currency] || '$'}0.00`;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    return `${symbol}${numeric.toFixed(2)}`;
  }
}

export function formatCurrencySummary(items = [], getAmount, getCurrency) {
  if (!items || items.length === 0) {
    return formatCurrency(0, 'USD');
  }

  const totalsByCurrency = new Map();
  for (const item of items) {
    const amount = Number(getAmount(item) ?? 0);
    if (Number.isNaN(amount)) continue;
    const currency = getCurrency(item) || 'USD';
    totalsByCurrency.set(currency, (totalsByCurrency.get(currency) || 0) + amount);
  }

  if (totalsByCurrency.size === 0) {
    return formatCurrency(0, 'USD');
  }

  return Array.from(totalsByCurrency.entries())
    .map(([currency, sum]) => formatCurrency(sum, currency))
    .join(' + ');
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

export function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(value);
}

export function getErrorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

export function isOverdue(deadline, status) {
  if (!deadline || status === 'PAID' || status === 'COMPLETED' || status === 'CANCELLED') {
    return false;
  }
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

