export interface ProductLabelData {
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  copies?: number;
}

export interface ProductLabelPrintOptions {
  title?: string;
  copiesPerProduct?: number;
  showPrice?: boolean;
  footerText?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount);

const normalizeCopies = (value: unknown, fallback = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(200, Math.floor(parsed));
};

const expandLabelCopies = (
  labels: ProductLabelData[],
  copiesPerProduct: number
): ProductLabelData[] => {
  const expanded: ProductLabelData[] = [];

  labels.forEach((label) => {
    const perItemCopies = normalizeCopies(label.copies, 1) * normalizeCopies(copiesPerProduct, 1);
    for (let index = 0; index < perItemCopies; index += 1) {
      expanded.push(label);
    }
  });

  return expanded;
};

export const printProductLabels = (
  labels: ProductLabelData[],
  options: ProductLabelPrintOptions = {}
): boolean => {
  const title = options.title || 'Product Labels';
  const copiesPerProduct = normalizeCopies(options.copiesPerProduct, 1);
  const showPrice = options.showPrice ?? false;
  const footerText = options.footerText || 'Compazz POS';

  const validLabels = labels
    .map((label) => ({
      ...label,
      name: label.name?.trim() || '',
      sku: label.sku?.trim() || '',
      barcode: label.barcode?.trim() || '',
    }))
    .filter((label) => label.name.length > 0);

  if (validLabels.length === 0) return false;

  const printableLabels = expandLabelCopies(validLabels, copiesPerProduct);
  if (printableLabels.length === 0) return false;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return false;

  const labelsHtml = printableLabels
    .map((label) => {
      const skuOrBarcode = label.barcode || label.sku || '';
      const priceLine =
        showPrice && typeof label.price === 'number'
          ? `<div class="price">${escapeHtml(formatCurrency(label.price))}</div>`
          : '';

      return `
        <div class="label">
          <div class="name">${escapeHtml(label.name)}</div>
          ${priceLine}
          <div class="meta">${escapeHtml(skuOrBarcode || 'NO-CODE')}</div>
          <div class="footer">${escapeHtml(footerText)}</div>
        </div>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <meta charset="utf-8" />
        <style>
          @page { margin: 6mm; }
          body {
            margin: 0;
            padding: 10px;
            font-family: "Segoe UI", Arial, sans-serif;
            background: #fff;
            color: #111827;
          }
          .sheet {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 8px;
          }
          .label {
            min-height: 88px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 8px 9px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
          }
          .name {
            font-size: 14px;
            font-weight: 700;
            line-height: 1.2;
            word-break: break-word;
          }
          .price {
            margin-top: 2px;
            font-size: 13px;
            font-weight: 700;
          }
          .meta {
            margin-top: 4px;
            font-family: "Courier New", monospace;
            font-size: 11px;
            letter-spacing: 0.04em;
          }
          .footer {
            margin-top: 4px;
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          @media print {
            body { padding: 0; }
            .label { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">${labelsHtml}</div>
        <script>
          window.onload = () => window.print();
          window.onafterprint = () => window.close();
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  return true;
};
