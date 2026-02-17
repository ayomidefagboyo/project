/**
 * ESC/POS Command Builder
 *
 * Builds raw binary buffers that thermal receipt printers understand.
 * Covers the universal ESC/POS subset supported by Epson, Star, Bixolon,
 * Sunmi, and virtually every generic 58 mm / 80 mm thermal printer.
 *
 * No external dependencies — just byte arrays.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a UTF-8 string into bytes (most thermal printers accept UTF-8). */
const encodeText = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Concatenate multiple byte arrays / Uint8Arrays into one. */
const concat = (...parts: (Uint8Array | number[])[]): Uint8Array => {
  const arrays = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
};

// ---------------------------------------------------------------------------
// Command builders
// ---------------------------------------------------------------------------

/** Initialize / reset the printer to its default state. */
export const cmdInitialize = (): Uint8Array => new Uint8Array([ESC, 0x40]);

/** Print a line of text followed by a line-feed. */
export const cmdText = (text: string): Uint8Array => concat(encodeText(text), [LF]);

/** Print raw text without appending a line-feed. */
export const cmdTextRaw = (text: string): Uint8Array => encodeText(text);

/** Feed `n` blank lines. */
export const cmdFeedLines = (n: number): Uint8Array => {
  const count = Math.max(0, Math.min(255, Math.floor(n)));
  return new Uint8Array([ESC, 0x64, count]);
};

/** Enable or disable bold (emphasized) mode. */
export const cmdBold = (on: boolean): Uint8Array =>
  new Uint8Array([ESC, 0x45, on ? 0x01 : 0x00]);

/** Enable or disable underline mode (0 = off, 1 = thin, 2 = thick). */
export const cmdUnderline = (mode: 0 | 1 | 2 = 0): Uint8Array =>
  new Uint8Array([ESC, 0x2d, mode]);

/** Set text alignment: 0 = left, 1 = center, 2 = right. */
export const cmdAlign = (alignment: 0 | 1 | 2): Uint8Array =>
  new Uint8Array([ESC, 0x61, alignment]);

/** Set character size. `width` and `height` are multipliers 1–8. */
export const cmdCharSize = (width: number, height: number): Uint8Array => {
  const w = Math.max(0, Math.min(7, Math.floor(width) - 1));
  const h = Math.max(0, Math.min(7, Math.floor(height) - 1));
  return new Uint8Array([GS, 0x21, (w << 4) | h]);
};

/**
 * Full paper cut.
 * Mode 0 = full cut, mode 1 = partial cut (some printers only).
 */
export const cmdCut = (partial = false): Uint8Array =>
  new Uint8Array([GS, 0x56, partial ? 0x01 : 0x00]);

/**
 * Open (kick) the cash drawer.
 * Pin 2 (connector pin) is the most common; some drawers use pin 5.
 * `onMs` / `offMs` control the pulse duration (multiples of 2 ms).
 */
export const cmdOpenDrawer = (
  pin: 0 | 1 = 0,
  onMs = 100,
  offMs = 100,
): Uint8Array => {
  const onVal = Math.max(0, Math.min(255, Math.floor(onMs / 2)));
  const offVal = Math.max(0, Math.min(255, Math.floor(offMs / 2)));
  return new Uint8Array([ESC, 0x70, pin, onVal, offVal]);
};

/** A single line-feed byte. */
export const cmdLineFeed = (): Uint8Array => new Uint8Array([LF]);

// ---------------------------------------------------------------------------
// High-level receipt builder
// ---------------------------------------------------------------------------

export interface ReceiptBuildOptions {
  /** Receipt text content (plain text with newlines). */
  content: string;
  /** Number of copies to print. */
  copies?: number;
  /** Whether to cut the paper after printing. Default true. */
  cut?: boolean;
  /** Whether to kick the cash drawer after printing. Default false. */
  openDrawer?: boolean;
  /** Number of blank lines to feed before cutting. Default 3. */
  feedBeforeCut?: number;
}

/**
 * Build a complete ESC/POS binary payload for a receipt.
 *
 * The returned `Uint8Array` can be written directly to a printer device
 * (USB path, TCP socket, or Windows spooler in RAW mode).
 */
export const buildReceiptPayload = (options: ReceiptBuildOptions): Uint8Array => {
  const {
    content,
    copies = 1,
    cut = true,
    openDrawer = false,
    feedBeforeCut = 3,
  } = options;

  const parts: (Uint8Array | number[])[] = [];

  const copyCount = Math.max(1, Math.min(5, Math.floor(copies)));

  for (let i = 0; i < copyCount; i++) {
    // Reset printer state at the start of each copy
    parts.push(cmdInitialize());

    // Print each line
    const lines = content.split('\n');
    for (const line of lines) {
      parts.push(cmdText(line));
    }

    // Feed blank lines before cut
    if (feedBeforeCut > 0) {
      parts.push(cmdFeedLines(feedBeforeCut));
    }

    // Cut paper
    if (cut) {
      parts.push(cmdCut(false));
    }
  }

  // Open cash drawer (once, after all copies)
  if (openDrawer) {
    parts.push(cmdOpenDrawer(0));
  }

  return concat(...parts);
};
