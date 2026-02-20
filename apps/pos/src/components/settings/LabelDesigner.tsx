import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Printer, RotateCcw, Save } from 'lucide-react';
import { useOutlet } from '../../contexts/OutletContext';
import { dataService } from '../../lib/dataService';
import { printProductLabels } from '../../lib/labelPrinter';
import {
  defaultLabelTemplate,
  extractLabelTemplateFromTerminalSettings,
  mergeLabelTemplate,
  mergeLabelTemplateIntoTerminalSettings,
  readCachedLabelTemplate,
  writeCachedLabelTemplate,
  type LabelTemplate,
} from '../../lib/labelTemplate';

const resolveCode = (
  sku: string | undefined,
  barcode: string | undefined,
  codeSource: LabelTemplate['codeSource']
): string => {
  if (codeSource === 'barcode') return barcode || sku || 'NO-CODE';
  if (codeSource === 'sku') return sku || barcode || 'NO-CODE';
  return barcode || sku || 'NO-CODE';
};

const sampleLabels = [
  { name: 'Peak Milk 400g', sku: 'PEAK-400', barcode: '123456789012', price: 850 },
  { name: 'Indomie Chicken Noodles', sku: 'INDO-CHICK', barcode: '400580835645', price: 220 },
  { name: 'Golden Penny Semovita 1kg', sku: 'SEMO-1KG', barcode: '885910379111', price: 1750 },
  { name: 'Dettol Antiseptic 125ml', sku: 'DETT-125', barcode: '761540010101', price: 1450 },
];

const LabelDesigner: React.FC = () => {
  const { currentOutlet, businessSettings, setBusinessSettings } = useOutlet();
  const [template, setTemplate] = useState<LabelTemplate>(defaultLabelTemplate);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  const outletId = currentOutlet?.id;

  useEffect(() => {
    if (!outletId) {
      setTemplate(defaultLabelTemplate);
      return;
    }

    const fromSettings = extractLabelTemplateFromTerminalSettings(
      businessSettings?.pos_terminal_settings
    );
    const fromCache = readCachedLabelTemplate(outletId);
    setTemplate(fromSettings ?? fromCache ?? defaultLabelTemplate);
  }, [outletId, businessSettings?.pos_terminal_settings]);

  useEffect(() => {
    if (!outletId) return;
    writeCachedLabelTemplate(outletId, template);
  }, [outletId, template]);

  const updateTemplate = (updates: Partial<LabelTemplate>) => {
    setTemplate((prev) => mergeLabelTemplate(prev, updates));
    setSaveStatus('idle');
  };

  const withDefaults = (payload: Record<string, unknown>): Record<string, unknown> => {
    if (businessSettings || !currentOutlet) return payload;

    return {
      ...payload,
      business_name: currentOutlet.name,
      business_type: currentOutlet.businessType || 'retail',
      theme: 'auto',
      language: 'en',
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      currency: currentOutlet.currency || 'NGN',
      timezone: currentOutlet.timezone || 'Africa/Lagos',
    };
  };

  const persistTemplate = async (nextTemplate: LabelTemplate) => {
    if (!outletId) return;

    setSaveStatus('saving');
    setMessage(null);

    const mergedTerminalSettings = mergeLabelTemplateIntoTerminalSettings(
      businessSettings?.pos_terminal_settings,
      nextTemplate
    );

    const response = await dataService.updateBusinessSettings(
      outletId,
      withDefaults({ pos_terminal_settings: mergedTerminalSettings }) as any
    );

    if (response.error || !response.data) {
      setSaveStatus('error');
      setMessage(response.error || 'Could not save label template.');
      return;
    }

    setBusinessSettings(response.data);
    writeCachedLabelTemplate(outletId, nextTemplate);
    setSaveStatus('saved');
    setMessage('Label template saved.');
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const handleSave = async () => {
    await persistTemplate(template);
  };

  const handleReset = async () => {
    const next = mergeLabelTemplate(defaultLabelTemplate);
    setTemplate(next);
    await persistTemplate(next);
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    setMessage(null);

    try {
      const opened = printProductLabels(sampleLabels, {
        title: `Label Test - ${currentOutlet?.name || 'Compazz'}`,
        copiesPerProduct: 1,
        showPrice: template.defaultShowPrice,
        footerText: template.footerText,
        template,
      });

      if (!opened) {
        setMessage('Allow pop-ups to run test label print.');
        return;
      }

      setMessage('Test label opened.');
    } finally {
      setIsTestPrinting(false);
    }
  };

  const previewGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${template.columns}, minmax(0, 1fr))`,
      gap: `${template.gapMm}mm`,
    }),
    [template.columns, template.gapMm]
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Label Designer</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure how product labels print from Receive Items and invoice history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestPrint}
              disabled={isTestPrinting}
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm font-semibold disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <Printer className="w-4 h-4" />
                {isTestPrinting ? 'Testing...' : 'Test Print'}
              </span>
            </button>
            <button
              onClick={handleReset}
              disabled={!outletId || saveStatus === 'saving'}
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm font-semibold disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Reset
              </span>
            </button>
            <button
              onClick={handleSave}
              disabled={!outletId || saveStatus === 'saving'}
              className="btn-brand px-4 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <Save className="w-4 h-4" />
                {saveStatus === 'saving' ? 'Saving...' : 'Save'}
              </span>
            </button>
          </div>
        </div>

        {saveStatus === 'saved' && (
          <p className="mb-4 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {message || 'Label template saved.'}
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {message || 'Could not save label template.'}
          </p>
        )}
        {saveStatus === 'idle' && message && (
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{message}</p>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Layout</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Columns
                  </label>
                  <select
                    value={template.columns}
                    onChange={(event) =>
                      updateTemplate({ columns: Number(event.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Min height (mm)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={80}
                    value={template.minHeightMm}
                    onChange={(event) =>
                      updateTemplate({ minHeightMm: Number(event.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Gap (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={template.gapMm}
                    onChange={(event) => updateTemplate({ gapMm: Number(event.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Page margin (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    step={0.5}
                    value={template.pageMarginMm}
                    onChange={(event) =>
                      updateTemplate({ pageMarginMm: Number(event.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Label padding (mm)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={template.paddingMm}
                    onChange={(event) =>
                      updateTemplate({ paddingMm: Number(event.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Typography & Border
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Font scale ({template.fontScalePercent}%)
                  </label>
                  <input
                    type="range"
                    min={70}
                    max={200}
                    step={5}
                    value={template.fontScalePercent}
                    onChange={(event) =>
                      updateTemplate({ fontScalePercent: Number(event.target.value) })
                    }
                    className="w-full"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={template.showBorder}
                    onChange={(event) => updateTemplate({ showBorder: event.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Show label border
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      Border color
                    </label>
                    <input
                      type="color"
                      value={template.borderColor}
                      onChange={(event) => updateTemplate({ borderColor: event.target.value })}
                      className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      Radius (px)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={template.borderRadiusPx}
                      onChange={(event) =>
                        updateTemplate({ borderRadiusPx: Number(event.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Content</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={template.defaultShowPrice}
                    onChange={(event) =>
                      updateTemplate({ defaultShowPrice: event.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  Show price by default
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={template.showCode}
                    onChange={(event) => updateTemplate({ showCode: event.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Show SKU / barcode line
                </label>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Code preference
                  </label>
                  <select
                    value={template.codeSource}
                    onChange={(event) =>
                      updateTemplate({
                        codeSource: event.target.value as LabelTemplate['codeSource'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="auto">Auto (barcode then SKU)</option>
                    <option value="barcode">Barcode first</option>
                    <option value="sku">SKU first</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={template.showFooter}
                    onChange={(event) => updateTemplate({ showFooter: event.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Show footer text
                </label>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Footer text
                  </label>
                  <input
                    value={template.footerText}
                    onChange={(event) => updateTemplate({ footerText: event.target.value })}
                    disabled={!template.showFooter}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white disabled:opacity-60"
                    placeholder="Compazz POS"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="xl:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Live Preview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              This preview reflects the layout used by Receive Items label printing.
            </p>
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-4 overflow-auto">
              <div className="grid min-w-[420px]" style={previewGridStyle}>
                {sampleLabels.map((label, index) => (
                  <div
                    key={`${label.sku}-${index}`}
                    className="bg-white text-gray-900"
                    style={{
                      minHeight: `${template.minHeightMm}mm`,
                      border: template.showBorder
                        ? `1px solid ${template.borderColor}`
                        : '1px solid transparent',
                      borderRadius: `${template.borderRadiusPx}px`,
                      padding: `${template.paddingMm}mm`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        fontSize: `${14 * (template.fontScalePercent / 100)}px`,
                        fontWeight: 700,
                        lineHeight: 1.2,
                      }}
                    >
                      {label.name}
                    </div>
                    {template.defaultShowPrice && (
                      <div
                        style={{
                          marginTop: '2px',
                          fontSize: `${13 * (template.fontScalePercent / 100)}px`,
                          fontWeight: 700,
                        }}
                      >
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN',
                        }).format(label.price)}
                      </div>
                    )}
                    {template.showCode && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontFamily: '"Courier New", monospace',
                          fontSize: `${11 * (template.fontScalePercent / 100)}px`,
                        }}
                      >
                        {resolveCode(label.sku, label.barcode, template.codeSource)}
                      </div>
                    )}
                    {template.showFooter && template.footerText.trim() && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: `${10 * (template.fontScalePercent / 100)}px`,
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {template.footerText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabelDesigner;
