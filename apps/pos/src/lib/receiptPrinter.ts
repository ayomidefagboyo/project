type NativeReceiptPrinter = {
  printReceipt?: (payload: {
    content: string;
    copies?: number;
    printerName?: string;
  }) => Promise<boolean> | boolean;
};

declare global {
  interface Window {
    qz?: any;
    CompazzNativePrinter?: NativeReceiptPrinter;
  }
}

export interface ReceiptPrintStyle {
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: 'monospace' | 'serif' | 'sans-serif';
  lineSpacing?: 'compact' | 'normal' | 'loose';
  paperWidth?: '58mm' | '80mm' | 'A4';
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const toBase64 = (value: string): string => {
  const utf8 = new TextEncoder().encode(value);
  let binary = '';
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const normalizeReceiptContent = (content: string): string =>
  content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

const tryCompazzNativePrint = async (
  content: string,
  copies: number,
  printerName?: string
): Promise<boolean> => {
  const nativePrinter = window.CompazzNativePrinter;
  if (!nativePrinter?.printReceipt) return false;
  try {
    const result = await nativePrinter.printReceipt({
      content,
      copies,
      printerName,
    });
    return result !== false;
  } catch {
    return false;
  }
};

const tryQzRawPrint = async (
  content: string,
  copies: number,
  printerName?: string
): Promise<boolean> => {
  const qz = window.qz;
  if (!qz?.websocket || !qz?.configs || !qz?.print) return false;

  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }

    const config = qz.configs.create(printerName || null, {
      copies,
    });
    const data = [
      {
        type: 'raw',
        format: 'plain',
        data: `${content}\n`,
      },
    ];
    await qz.print(config, data);
    return true;
  } catch {
    return false;
  }
};

const resolveFontSize = (size?: ReceiptPrintStyle['fontSize']): string => {
  if (size === 'small') return '10px';
  if (size === 'large') return '14px';
  return '12px';
};

const resolveFontFamily = (family?: ReceiptPrintStyle['fontFamily']): string => {
  if (family === 'serif') return 'Georgia, "Times New Roman", serif';
  if (family === 'sans-serif') return '-apple-system, "Segoe UI", Arial, sans-serif';
  return '"Courier New", Courier, monospace';
};

const resolveLineHeight = (spacing?: ReceiptPrintStyle['lineSpacing']): string => {
  if (spacing === 'compact') return '1.2';
  if (spacing === 'loose') return '1.6';
  return '1.4';
};

const resolvePaperMaxWidth = (width?: ReceiptPrintStyle['paperWidth']): string => {
  if (width === '58mm') return '58mm';
  if (width === 'A4') return '210mm';
  return '80mm';
};

export const openReceiptPrintWindow = (
  receiptContent: string,
  options?: {
    title?: string;
    copies?: number;
    style?: ReceiptPrintStyle;
  }
): boolean => {
  const title = options?.title || 'Receipt';
  const copies = Math.max(1, Math.min(5, Math.floor(options?.copies || 1)));
  const style = options?.style;
  const normalizedContent = normalizeReceiptContent(receiptContent);
  if (!normalizedContent) return false;

  const fontSize = resolveFontSize(style?.fontSize);
  const fontFamily = resolveFontFamily(style?.fontFamily);
  const lineHeight = resolveLineHeight(style?.lineSpacing);
  const maxWidth = resolvePaperMaxWidth(style?.paperWidth);

  const printWindow = window.open('', '_blank', 'width=420,height=600');
  if (!printWindow) return false;

  const copyBlocks = Array.from({ length: copies })
    .map((_, index) => {
      const copyLabel = copies > 1 ? `<div class="copy-label">Copy ${index + 1}</div>` : '';
      return `
        <section class="copy">
          ${copyLabel}
          <pre>${escapeHtml(normalizedContent)}</pre>
        </section>
      `;
    })
    .join('<hr class="cut" />');

  printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        margin: 0;
        size: ${maxWidth} auto;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: ${maxWidth};
        background: #fff;
        color: #111827;
      }
      body {
        font-family: ${fontFamily};
        max-width: ${maxWidth};
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        font-family: inherit;
        font-size: ${fontSize};
        line-height: ${lineHeight};
        margin: 0;
        padding: 0;
      }
      .copy { margin: 0; }
      .copy-label { font-weight: 700; margin-bottom: 4px; text-transform: uppercase; font-size: ${fontSize}; }
      .cut { border: 0; border-top: 1px dashed #9ca3af; margin: 4px 0; }
      @media print {
        html, body { padding: 0; margin: 0; width: ${maxWidth}; }
        body { padding: 0; }
        .copy { break-inside: avoid; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    ${copyBlocks}
    <script>
      window.onload = function() { window.print(); };
      window.onafterprint = function() { window.close(); };
    </script>
  </body>
</html>`);
  printWindow.document.close();
  return true;
};

export const printReceiptContent = async (
  receiptContent: string,
  options?: {
    title?: string;
    copies?: number;
    printerName?: string;
    style?: ReceiptPrintStyle;
  }
): Promise<{ success: boolean; mode: 'native' | 'browser' | 'none' }> => {
  const copies = Math.max(1, Math.min(5, Math.floor(options?.copies || 1)));
  const printerName = options?.printerName;
  const normalizedContent = normalizeReceiptContent(receiptContent);
  if (!normalizedContent) return { success: false, mode: 'none' };

  // Attempt native bridge first (Compazz bridge / QZ Tray), then fallback to browser print.
  const nativeCompazz = await tryCompazzNativePrint(normalizedContent, copies, printerName);
  if (nativeCompazz) {
    return { success: true, mode: 'native' };
  }

  const nativeQz = await tryQzRawPrint(normalizedContent, copies, printerName);
  if (nativeQz) {
    return { success: true, mode: 'native' };
  }

  const opened = openReceiptPrintWindow(normalizedContent, {
    title: options?.title,
    copies,
    style: options?.style,
  });
  if (opened) return { success: true, mode: 'browser' };

  return { success: false, mode: 'none' };
};

export const encodeReceiptForBridge = (receiptContent: string): string => toBase64(receiptContent);
