/**
 * Inventory Import/Export Service
 * Supports: CSV, Excel (.xlsx), QuickBooks, Square POS, Generic POS formats
 */

import * as XLSX from 'xlsx';

// ─── Our internal product format ───
export interface ImportProduct {
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  category?: string;
  unit_price: number;
  cost_price: number;
  quantity_on_hand: number;
  reorder_level: number;
  reorder_quantity: number;
  tax_rate: number;
  is_active: boolean;
  vendor_id?: string;
  image_url?: string;
  // Extra metadata from import
  _source?: string;
  _row?: number;
  _errors?: string[];
  _warnings?: string[];
}

// ─── Supported source formats ───
export type ImportSource = 'auto' | 'quickbooks' | 'square' | 'shopify' | 'generic' | 'compazz' | 'busy21';

// ─── Field mapping definitions per POS system ───
interface FieldMapping {
  [internalField: string]: string[]; // list of possible column names (case-insensitive)
}

/**
 * Column name maps for each POS system.
 * Order matters – first match wins.
 */
const FIELD_MAPS: Record<string, FieldMapping> = {
  // ── QuickBooks Desktop POS / QuickBooks Online ──
  quickbooks: {
    name:              ['Item Name', 'Item', 'Product Name', 'Product/Service', 'Name', 'Description'],
    sku:               ['Item Number', 'SKU', 'Item Code', 'Product/Service SKU'],
    barcode:           ['UPC', 'Barcode', 'UPC/EAN', 'Alternate Lookup'],
    description:       ['Sales Description', 'Description', 'Item Description', 'Purchase Description'],
    category:          ['Type', 'Category', 'Item Type', 'Department', 'Sub-Type'],
    unit_price:        ['Sales Price', 'Price', 'Rate', 'Retail Price', 'Amount'],
    cost_price:        ['Cost', 'Purchase Cost', 'Avg Cost', 'COGS', 'Cost Price', 'Buy Price'],
    quantity_on_hand:  ['Quantity On Hand', 'Qty On Hand', 'On Hand', 'Stock', 'Inventory Qty', 'Quantity', 'Qty'],
    reorder_level:     ['Reorder Point', 'Min Qty', 'Minimum Qty', 'Reorder Level', 'Min Stock'],
    reorder_quantity:  ['Reorder Qty', 'Max Qty', 'Reorder Quantity', 'Order Qty'],
    tax_rate:          ['Tax Rate', 'Tax %', 'Tax Percentage', 'VAT Rate', 'Sales Tax Rate'],
    is_active:         ['Active', 'Status', 'Is Active'],
    vendor_id:         ['Preferred Vendor', 'Vendor', 'Supplier', 'Supplier Name'],
  },

  // ── Square POS ──
  square: {
    name:              ['Item Name', 'Name', 'Product Name'],
    sku:               ['SKU', 'Item SKU', 'Variation SKU'],
    barcode:           ['GTIN', 'Barcode', 'UPC'],
    description:       ['Description', 'Item Description'],
    category:          ['Category', 'Category Name'],
    unit_price:        ['Price', 'Current Price', 'Regular Price', 'Variation Price'],
    cost_price:        ['Cost', 'Current Cost', 'Default Cost'],
    quantity_on_hand:  ['Current Quantity', 'Quantity', 'Stock Count', 'New Quantity'],
    reorder_level:     ['Stock Alert', 'Alert Enabled', 'Reorder Point'],
    reorder_quantity:  ['Reorder Qty'],
    tax_rate:          ['Tax', 'Tax Rate', 'Tax - Sales Tax (7.5%)'],
    is_active:         ['Enabled', 'Visibility', 'Active'],
    vendor_id:         ['Vendor', 'Supplier'],
  },

  // ── Shopify ──
  shopify: {
    name:              ['Title', 'Product', 'Handle'],
    sku:               ['Variant SKU', 'SKU'],
    barcode:           ['Variant Barcode', 'Barcode'],
    description:       ['Body (HTML)', 'Body', 'Description'],
    category:          ['Type', 'Product Type', 'Category'],
    unit_price:        ['Variant Price', 'Price'],
    cost_price:        ['Variant Cost', 'Cost per item'],
    quantity_on_hand:  ['Variant Inventory Qty', 'Qty', 'Inventory'],
    reorder_level:     ['Reorder Point'],
    reorder_quantity:  ['Reorder Qty'],
    tax_rate:          ['Variant Tax'],
    is_active:         ['Status', 'Published'],
    vendor_id:         ['Vendor'],
  },

  // ── Generic / Fallback ──
  generic: {
    name:              ['Name', 'Product Name', 'Item Name', 'Product', 'Item', 'Title', 'Description'],
    sku:               ['SKU', 'Item Code', 'Product Code', 'Code', 'Item Number', 'Part Number', 'Ref'],
    barcode:           ['Barcode', 'UPC', 'EAN', 'GTIN', 'UPC/EAN'],
    description:       ['Description', 'Notes', 'Details', 'Product Description', 'Memo'],
    category:          ['Category', 'Group', 'Type', 'Department', 'Class'],
    unit_price:        ['Price', 'Selling Price', 'Unit Price', 'Retail Price', 'Sales Price', 'Rate', 'Amount'],
    cost_price:        ['Cost', 'Cost Price', 'Buy Price', 'Purchase Price', 'Unit Cost'],
    quantity_on_hand:  ['Quantity', 'Qty', 'Stock', 'On Hand', 'Stock Qty', 'Balance', 'Inventory'],
    reorder_level:     ['Reorder Level', 'Min Stock', 'Min Qty', 'Reorder Point', 'Alert Level'],
    reorder_quantity:  ['Reorder Qty', 'Order Qty', 'Max Qty'],
    tax_rate:          ['Tax', 'Tax Rate', 'VAT', 'Tax %'],
    is_active:         ['Active', 'Status', 'Enabled'],
    vendor_id:         ['Vendor', 'Supplier', 'Supplier Name'],
  },

  // ── Compazz own format (re-import) ──
  compazz: {
    name:              ['Product Name'],
    sku:               ['SKU'],
    barcode:           ['Barcode'],
    description:       ['Description'],
    category:          ['Category'],
    unit_price:        ['Selling Price (₦)', 'Selling Price'],
    cost_price:        ['Cost Price (₦)', 'Cost Price'],
    quantity_on_hand:  ['Stock Qty', 'Quantity'],
    reorder_level:     ['Reorder Level'],
    reorder_quantity:  ['Reorder Qty'],
    tax_rate:          ['Tax Rate (%)'],
    is_active:         ['Active'],
    vendor_id:         ['Supplier'],
  },

  // ── Busy21 Accounting Software ──
  busy21: {
    name:              ['Item Details'],
    sku:               ['Item Details'], // Will use same as name, then auto-generate unique SKU
    barcode:           [], // Not available in Busy21 export
    description:       ['Item Details'],
    category:          ['Parent Group'],
    unit_price:        ['Cl. Amt.', 'Cl Amt', 'Closing Amt'], // Calculate from closing values
    cost_price:        ['Cl. Amt.', 'Cl Amt', 'Closing Amt'], // Calculate from closing values
    quantity_on_hand:  ['Cl. Qty', 'Cl Qty', 'Closing Qty'], // Closing Quantity
    reorder_level:     [], // Not available
    reorder_quantity:  [], // Not available
    tax_rate:          [], // Not available, will default
    is_active:         [], // Not available, will default to true
    vendor_id:         [], // Not available
  },
};

// ─── Helpers ───

/** Normalise a header string for matching */
const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9%]/g, '');

/** Find the column header that matches a field */
function findColumn(headers: string[], possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    const target = norm(name);
    const match = headers.find(h => norm(h) === target);
    if (match) return match;
  }
  return null;
}

/** Parse a number from various formats (₦1,200.50, $5.00, "1 200", etc.) */
function parseNumber(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[₦$€£,\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/** Parse a boolean-ish value */
function parseBool(val: any): boolean {
  if (val == null || val === '') return true; // default active
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase().trim();
  return !['false', 'no', '0', 'inactive', 'disabled', 'n', 'off', 'hidden'].includes(str);
}

/** Auto-detect source from column headers */
function detectSource(headers: string[]): ImportSource {
  const normHeaders = headers.map(norm);

  // Busy21 has 'Item Details' + 'Parent Group' + 'Cl. Qty'
  if (normHeaders.some(h => h.includes('itemdetails')) &&
      normHeaders.some(h => h.includes('parentgroup')) &&
      normHeaders.some(h => h.includes('clqty'))) return 'busy21';

  // Square has 'Current Quantity' or 'Variation SKU'
  if (normHeaders.some(h => h.includes('currentquantity') || h.includes('variationsku') || h.includes('squareid'))) return 'square';

  // QuickBooks has 'Item Name' + 'Qty On Hand' or 'Sales Price'
  if (normHeaders.some(h => h.includes('qtyonhand') || h.includes('salesprice') || h.includes('itemnumber'))) return 'quickbooks';

  // Shopify has 'Variant SKU' or 'Handle'
  if (normHeaders.some(h => h.includes('variantsku') || h.includes('handle') || h.includes('bodyhtml'))) return 'shopify';

  // Compazz own format
  if (normHeaders.some(h => h.includes('sellingprice₦') || h.includes('reorderlevel'))) return 'compazz';

  return 'generic';
}

// ─── Main API ───

export interface ImportResult {
  products: ImportProduct[];
  source: ImportSource;
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  headers: string[];
  unmappedColumns: string[];
}

/**
 * Parse a file (CSV or Excel) into ImportProduct[].
 */
export async function parseImportFile(
  file: File,
  preferredSource: ImportSource = 'auto'
): Promise<ImportResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // For Busy21, we need to handle the metadata rows at the top
  // Get raw data first to detect and skip metadata
  const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (allRows.length === 0) {
    return { products: [], source: 'generic', totalRows: 0, validCount: 0, errorCount: 0, warningCount: 0, headers: [], unmappedColumns: [] };
  }

  // Find the actual header row - look for "Item Details" pattern for Busy21
  let headerRowIndex = 0;
  let dataStartIndex = 1;

  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    if (row && typeof row[0] === 'string') {
      const firstCol = String(row[0]).toLowerCase();
      // Look for header patterns
      if (firstCol.includes('item details') ||
          firstCol.includes('product name') ||
          firstCol.includes('name') ||
          firstCol.includes('sku')) {
        headerRowIndex = i;
        dataStartIndex = i + 1;
        break;
      }
    }
  }

  const headers = allRows[headerRowIndex]?.map(h => String(h || '').trim()).filter(Boolean) || [];
  const dataRows = allRows.slice(dataStartIndex).filter(row =>
    row && row.length > 0 && row.some(cell => cell !== '' && cell != null)
  );

  if (headers.length === 0 || dataRows.length === 0) {
    return { products: [], source: 'generic', totalRows: 0, validCount: 0, errorCount: 0, warningCount: 0, headers: [], unmappedColumns: [] };
  }

  // Convert back to object format for processing
  const rows = dataRows.map(row => {
    const obj: Record<string, any> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });

  const source = preferredSource === 'auto' ? detectSource(headers) : preferredSource;
  const mapping = FIELD_MAPS[source] || FIELD_MAPS.generic;

  // Build column lookup: internalField → actual header in file
  const columnLookup: Record<string, string | null> = {};
  const mappedHeaders = new Set<string>();
  for (const [field, possibleNames] of Object.entries(mapping)) {
    const col = findColumn(headers, possibleNames);
    columnLookup[field] = col;
    if (col) mappedHeaders.add(col);
  }

  const unmappedColumns = headers.filter(h => !mappedHeaders.has(h));

  // Map rows
  const products: ImportProduct[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];
    const warnings: string[] = [];

    const getValue = (field: string) => {
      const col = columnLookup[field];
      return col ? row[col] : undefined;
    };

    const name = String(getValue('name') || '').trim();
    let sku = String(getValue('sku') || '').trim();
    let unitPrice = parseNumber(getValue('unit_price'));
    let costPrice = parseNumber(getValue('cost_price'));
    const qty = parseNumber(getValue('quantity_on_hand'));

    // Special handling for Busy21 format
    if (source === 'busy21') {
      // For Busy21, use Item Details as both name and generate unique SKU
      if (!sku && name) {
        sku = name.toUpperCase()
          .replace(/[^A-Z0-9\s]/g, '') // Remove special chars
          .replace(/\s+/g, '-')        // Replace spaces with hyphens
          .substring(0, 20);           // Limit length
        // Add index to ensure uniqueness
        sku = `${sku}-${i + 1}`;
      }

      // For Busy21, calculate cost price from closing amount and quantity
      if (qty > 0) {
        // Since both unit_price and cost_price map to 'Cl. Amt.', we get the closing amount directly
        const closingAmt = unitPrice; // This is actually the closing amount from 'Cl. Amt.'
        if (closingAmt > 0) {
          const avgCostPrice = Math.round(closingAmt / qty);
          costPrice = avgCostPrice;
          unitPrice = 0; // Leave selling price empty for manual entry
        } else {
          // If no closing amount, set defaults
          costPrice = 0;
          unitPrice = 0;
        }
      }
    }

    // Validation
    if (!name) {
      errors.push('Missing product name');
    }

    if (unitPrice <= 0 && costPrice <= 0) {
      warnings.push('No price set');
    }

    if (costPrice > unitPrice && unitPrice > 0) {
      warnings.push('Cost price exceeds selling price');
    }

    // Parse tax rate – handle "7.5" or "0.075" or "7.5%"
    let taxRate = parseNumber(getValue('tax_rate'));
    if (taxRate > 1) taxRate = taxRate / 100; // Convert 7.5 → 0.075
    if (taxRate === 0) taxRate = 0.075; // Default Nigerian VAT

    const product: ImportProduct = {
      name: name || `Unnamed Product (Row ${i + 2})`,
      sku: sku || `SKU-${Date.now()}-${i}`,
      barcode: String(getValue('barcode') || '').trim() || undefined,
      description: String(getValue('description') || '').trim() || undefined,
      category: String(getValue('category') || '').trim() || 'Other',
      unit_price: unitPrice,
      cost_price: costPrice,
      quantity_on_hand: Math.max(0, Math.round(qty)),
      reorder_level: Math.max(0, Math.round(parseNumber(getValue('reorder_level')))),
      reorder_quantity: Math.max(0, Math.round(parseNumber(getValue('reorder_quantity')))),
      tax_rate: taxRate,
      is_active: parseBool(getValue('is_active')),
      vendor_id: String(getValue('vendor_id') || '').trim() || undefined,
      _source: source,
      _row: i + 2, // 1-indexed + header row
      _errors: errors.length > 0 ? errors : undefined,
      _warnings: warnings.length > 0 ? warnings : undefined,
    };

    if (errors.length > 0) errorCount++;
    if (warnings.length > 0) warningCount++;

    products.push(product);
  }

  return {
    products,
    source,
    totalRows: rows.length,
    validCount: rows.length - errorCount,
    errorCount,
    warningCount,
    headers,
    unmappedColumns,
  };
}

// ─── Export ───

export interface ExportOptions {
  format: 'csv' | 'xlsx';
  filename?: string;
  outletName?: string;
}

/**
 * Export products to CSV or Excel file.
 * Uses Compazz column names so re-import works perfectly.
 */
export function exportProducts(products: any[], options: ExportOptions) {
  const { format, outletName } = options;
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = outletName?.replace(/[^a-zA-Z0-9]/g, '-') || 'products';
  const filename = options.filename || `${safeName}-inventory-${dateStr}`;

  // Build rows
  const exportRows = products.map(p => ({
    'Product Name':       p.name || '',
    'SKU':                p.sku || '',
    'Barcode':            p.barcode || '',
    'Description':        p.description || '',
    'Category':           p.category || '',
    'Selling Price (₦)':  p.unit_price ?? 0,
    'Cost Price (₦)':     p.cost_price ?? 0,
    'Stock Qty':          p.quantity_on_hand ?? p.stock_quantity ?? 0,
    'Reorder Level':      p.reorder_level ?? p.min_stock_level ?? 0,
    'Reorder Qty':        p.reorder_quantity ?? 0,
    'Tax Rate (%)':       ((p.tax_rate ?? 0.075) * 100).toFixed(1),
    'Active':             p.is_active !== false ? 'Yes' : 'No',
    'Supplier':           p.vendor_id || p.supplier_name || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);

  // Auto-size columns
  const colWidths = Object.keys(exportRows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...exportRows.map(r => String((r as any)[key] || '').length).slice(0, 50)) + 2
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  if (format === 'xlsx') {
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } else {
    XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
  }
}

/**
 * Generate a template file that users can fill in.
 */
export function downloadTemplate(format: 'csv' | 'xlsx' = 'xlsx') {
  const templateRows = [
    {
      'Product Name': 'Example: Coca Cola 350ml',
      'SKU': 'COCA-001',
      'Barcode': '1234567890123',
      'Description': 'Classic cola soft drink',
      'Category': 'Beverages',
      'Selling Price (₦)': 250,
      'Cost Price (₦)': 180,
      'Stock Qty': 48,
      'Reorder Level': 10,
      'Reorder Qty': 50,
      'Tax Rate (%)': '7.5',
      'Active': 'Yes',
      'Supplier': 'NBC',
    },
    {
      'Product Name': 'Example: Peak Milk 400g',
      'SKU': 'PEAK-001',
      'Barcode': '2345678901234',
      'Description': 'Full cream milk powder',
      'Category': 'Food & Groceries',
      'Selling Price (₦)': 1200,
      'Cost Price (₦)': 950,
      'Stock Qty': 22,
      'Reorder Level': 8,
      'Reorder Qty': 30,
      'Tax Rate (%)': '7.5',
      'Active': 'Yes',
      'Supplier': 'FrieslandCampina',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateRows);
  const colWidths = Object.keys(templateRows[0]).map(key => ({
    wch: Math.max(key.length, 25)
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  if (format === 'xlsx') {
    XLSX.writeFile(wb, 'compazz-import-template.xlsx');
  } else {
    XLSX.writeFile(wb, 'compazz-import-template.csv', { bookType: 'csv' });
  }
}
