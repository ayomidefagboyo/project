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
        data: `${content}\n\n\n`,
      },
    ];
    await qz.print(config, data);
    return true;
  } catch {
    return false;
  }
};

export const openReceiptPrintWindow = (
  receiptContent: string,
  options?: {
    title?: string;
    copies?: number;
  }
): boolean => {
  const title = options?.title || 'Receipt';
  const copies = Math.max(1, Math.min(5, Math.floor(options?.copies || 1)));
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return false;

  const copyBlocks = Array.from({ length: copies })
    .map((_, index) => {
      const copyLabel = copies > 1 ? `<div class="copy-label">Copy ${index + 1}</div>` : '';
      return `
        <section class="copy">
          ${copyLabel}
          <pre>${escapeHtml(receiptContent)}</pre>
        </section>
      `;
    })
    .join('<hr class="cut" />');

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: monospace; padding: 16px; color: #111827; }
          pre { white-space: pre-wrap; font-size: 12px; margin: 0; }
          .copy { margin-bottom: 12px; }
          .copy-label { font-weight: 700; margin-bottom: 8px; text-transform: uppercase; }
          .cut { border: 0; border-top: 1px dashed #9ca3af; margin: 14px 0; }
          @media print {
            body { padding: 0; }
            .copy { break-inside: avoid; page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${copyBlocks}
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
  return true;
};

export const printReceiptContent = async (
  receiptContent: string,
  options?: {
    title?: string;
    copies?: number;
    printerName?: string;
  }
): Promise<{ success: boolean; mode: 'native' | 'browser' | 'none' }> => {
  const copies = Math.max(1, Math.min(5, Math.floor(options?.copies || 1)));
  const printerName = options?.printerName;

  // Attempt native bridge first (Compazz bridge / QZ Tray), then fallback to browser print.
  const nativeCompazz = await tryCompazzNativePrint(receiptContent, copies, printerName);
  if (nativeCompazz) {
    return { success: true, mode: 'native' };
  }

  const nativeQz = await tryQzRawPrint(receiptContent, copies, printerName);
  if (nativeQz) {
    return { success: true, mode: 'native' };
  }

  const opened = openReceiptPrintWindow(receiptContent, {
    title: options?.title,
    copies,
  });
  if (opened) return { success: true, mode: 'browser' };
  return { success: false, mode: 'none' };
};

export const encodeReceiptForBridge = (receiptContent: string): string => toBase64(receiptContent);
