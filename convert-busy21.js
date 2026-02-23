#!/usr/bin/env node
/**
 * Convert Busy21 Stock Status CSV to Compazz-compatible format
 * Usage: node convert-busy21.js input.csv output.csv
 */

const fs = require('fs');
const path = require('path');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseNumber(str) {
  if (!str || str === '') return 0;
  // Remove currency symbols, commas, and spaces
  const cleaned = String(str).replace(/[₦$€£,\s"]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function generateSKU(itemName, index) {
  if (!itemName) return `ITEM-${index}`;

  return itemName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '-')        // Replace spaces with hyphens
    .substring(0, 15)            // Limit length
    + `-${index}`;               // Add unique suffix
}

function convertBusy21ToCsv(inputFile, outputFile) {
  console.log('🔄 Converting Busy21 export to Compazz format...');

  try {
    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);

    if (lines.length === 0) {
      throw new Error('Input file is empty');
    }

    // Find header row (contains "Item Details")
    let headerRowIndex = -1;
    let headerRow = [];

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const parsedLine = parseCSVLine(lines[i]);
      if (parsedLine.length > 0 && parsedLine[0].toLowerCase().includes('item details')) {
        headerRowIndex = i;
        headerRow = parsedLine;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row with "Item Details"');
    }

    console.log(`📋 Found header at row ${headerRowIndex + 1}: ${headerRow.join(', ')}`);

    // Map column indices
    const columnMap = {};
    headerRow.forEach((header, index) => {
      const normalized = header.toLowerCase().trim();
      if (normalized.includes('item details')) columnMap.itemDetails = index;
      else if (normalized.includes('parent group')) columnMap.parentGroup = index;
      else if (normalized.includes('cl. qty') || normalized.includes('cl qty')) columnMap.clQty = index;
      else if (normalized.includes('cl. amt') || normalized.includes('cl amt')) columnMap.clAmt = index;
      else if (normalized.includes('unit')) columnMap.unit = index;
    });

    console.log('📍 Column mapping:', columnMap);

    // Process data rows
    const dataRows = [];
    const startRow = headerRowIndex + 1;

    for (let i = startRow; i < lines.length; i++) {
      const parsedLine = parseCSVLine(lines[i]);

      if (parsedLine.length < 3 || !parsedLine[columnMap.itemDetails]) {
        continue; // Skip empty or invalid rows
      }

      const itemName = String(parsedLine[columnMap.itemDetails] || '').replace(/"/g, '').trim();
      const parentGroup = String(parsedLine[columnMap.parentGroup] || 'Other').replace(/"/g, '').trim();
      const clQty = parseNumber(parsedLine[columnMap.clQty]);
      const clAmt = parseNumber(parsedLine[columnMap.clAmt]);
      const unit = String(parsedLine[columnMap.unit] || 'Pcs').replace(/"/g, '').trim();

      // Skip items with no name or negative/zero quantity
      if (!itemName || clQty <= 0) {
        continue;
      }

      // Calculate estimated prices
      let costPrice = 0;
      let sellingPrice = 0;

      if (clAmt > 0 && clQty > 0) {
        costPrice = Math.round(clAmt / clQty);
        sellingPrice = Math.round(costPrice * 1.25); // 25% markup
      }

      // Generate SKU
      const sku = generateSKU(itemName, i - startRow + 1);

      dataRows.push({
        'Product Name': itemName,
        'SKU': sku,
        'Barcode': '',
        'Description': itemName,
        'Category': parentGroup || 'Other',
        'Selling Price (₦)': sellingPrice,
        'Cost Price (₦)': costPrice,
        'Stock Qty': Math.round(clQty),
        'Reorder Level': Math.round(clQty * 0.2), // 20% of current stock
        'Reorder Qty': Math.round(clQty * 0.5),  // 50% of current stock
        'Tax Rate (%)': '7.5',
        'Active': 'Yes',
        'Supplier': ''
      });
    }

    console.log(`✅ Processed ${dataRows.length} products`);

    // Write CSV output
    const headers = Object.keys(dataRows[0]);
    let csvContent = headers.map(h => `"${h}"`).join(',') + '\n';

    dataRows.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += values.join(',') + '\n';
    });

    fs.writeFileSync(outputFile, csvContent);

    console.log(`🎉 Conversion complete!`);
    console.log(`📁 Output saved to: ${outputFile}`);
    console.log(`📊 Total products: ${dataRows.length}`);

    // Show sample of converted data
    console.log('\n📋 Sample converted products:');
    dataRows.slice(0, 3).forEach((row, i) => {
      console.log(`${i + 1}. ${row['Product Name']} - ${row['SKU']} - Stock: ${row['Stock Qty']} - Price: ₦${row['Selling Price (₦)']}`);
    });

  } catch (error) {
    console.error('❌ Conversion failed:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node convert-busy21.js input.csv [output.csv]');
    console.log('Example: node convert-busy21.js StockStatus.csv compazz-inventory.csv');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || path.join(
    path.dirname(inputFile),
    'compazz-' + path.basename(inputFile, '.csv') + '.csv'
  );

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }

  convertBusy21ToCsv(inputFile, outputFile);
}

module.exports = { convertBusy21ToCsv };