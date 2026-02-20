import {
  defaultLabelTemplate,
  mergeLabelTemplate,
  type LabelTemplate,
} from './labelTemplate';

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
  template?: Partial<LabelTemplate>;
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

const resolveMetaText = (label: ProductLabelData, template: LabelTemplate): string => {
  if (!template.showCode) return '';

  if (template.codeSource === 'barcode') {
    return label.barcode || label.sku || 'NO-CODE';
  }

  if (template.codeSource === 'sku') {
    return label.sku || label.barcode || 'NO-CODE';
  }

  return label.barcode || label.sku || 'NO-CODE';
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
  const template = mergeLabelTemplate(defaultLabelTemplate, options.template);
  const title = options.title || 'Product Labels';
  const copiesPerProduct = normalizeCopies(options.copiesPerProduct, 1);
  const showPrice = options.showPrice ?? template.defaultShowPrice;
  const footerText = options.footerText ?? template.footerText;
  const showFooter = template.showFooter && footerText.trim().length > 0;
  const fontScale = Math.max(0.7, template.fontScalePercent / 100);

  const nameFontSize = Number((14 * fontScale).toFixed(2));
  const priceFontSize = Number((13 * fontScale).toFixed(2));
  const metaFontSize = Number((11 * fontScale).toFixed(2));
  const footerFontSize = Number((10 * fontScale).toFixed(2));

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
      const metaText = resolveMetaText(label, template);
      const priceLine =
        showPrice && typeof label.price === 'number'
          ? `<div class="price">${escapeHtml(formatCurrency(label.price))}</div>`
          : '';
      const metaLine = template.showCode
        ? `<div class="meta">${escapeHtml(metaText)}</div>`
        : '';
      const footerLine = showFooter
        ? `<div class="footer">${escapeHtml(footerText)}</div>`
        : '';

      return `
        <div class="label">
          <div class="name">${escapeHtml(label.name)}</div>
          ${priceLine}
          ${metaLine}
          ${footerLine}
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
          @page { margin: ${template.pageMarginMm}mm; }
          body {
            margin: 0;
            padding: ${template.pageMarginMm}mm;
            font-family: "Segoe UI", Arial, sans-serif;
            background: #fff;
            color: #111827;
          }
          .sheet {
            display: grid;
            grid-template-columns: repeat(${template.columns}, minmax(0, 1fr));
            gap: ${template.gapMm}mm;
          }
          .label {
            min-height: ${template.minHeightMm}mm;
            border: ${template.showBorder ? `1px solid ${template.borderColor}` : '1px solid transparent'};
            border-radius: ${template.borderRadiusPx}px;
            padding: ${template.paddingMm}mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            overflow: hidden;
          }
          .name {
            font-size: ${nameFontSize}px;
            font-weight: 700;
            line-height: 1.2;
            word-break: break-word;
          }
          .price {
            margin-top: 2px;
            font-size: ${priceFontSize}px;
            font-weight: 700;
          }
          .meta {
            margin-top: 4px;
            font-family: "Courier New", monospace;
            font-size: ${metaFontSize}px;
            letter-spacing: 0.04em;
          }
          .footer {
            margin-top: 4px;
            font-size: ${footerFontSize}px;
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
