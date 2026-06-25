import ExcelJS from 'exceljs';
import type { Analysis } from '@/types/analysis';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF1E1B4B' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFE0E0FF' }, size: 11 };
const BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FF3B3680' } },
  left:   { style: 'thin', color: { argb: 'FF3B3680' } },
  bottom: { style: 'thin', color: { argb: 'FF3B3680' } },
  right:  { style: 'thin', color: { argb: 'FF3B3680' } },
};

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'FF6B7280';
  if (score >= 80) return 'FF10B981';
  if (score >= 50) return 'FFF59E0B';
  return 'FFEF4444';
}

function addHeaders(sheet: ExcelJS.Worksheet, cols: string[]) {
  const row = sheet.addRow(cols);
  row.eachCell(cell => {
    cell.fill   = HEADER_FILL;
    cell.font   = HEADER_FONT;
    cell.border = BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 20;
}

export async function generateXLSX(analysis: Analysis): Promise<Buffer> {
  const wb    = new ExcelJS.Workbook();
  const scores = analysis.lighthouse_scores as any;
  const ai     = analysis.ai_insights as any;

  // ── Sheet 1: Summary ──────────────────────────────────────────────
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { key: 'label', width: 28 },
    { key: 'value', width: 52 },
  ];

  const metaRows: [string, string | number | null][] = [
    ['URL',           analysis.url],
    ['Analyzed',      new Date(analysis.created_at).toLocaleString()],
    ['Completed',     analysis.completed_at ? new Date(analysis.completed_at).toLocaleString() : '—'],
    ['Report ID',     analysis.id],
    ['', ''],
    ['Performance',   scores?.performance    ?? '—'],
    ['Accessibility', scores?.accessibility  ?? '—'],
    ['SEO',           scores?.seo            ?? '—'],
    ['Best Practices',scores?.bestPractices  ?? '—'],
    ['LLM Readiness', scores?.llmReadiness   ?? '—'],
    ['', ''],
    ['Est. LCP (ms)', scores?.estimatedLcp   ?? '—'],
    ['TTFB (ms)',     scores?.ttfb           ?? '—'],
  ];

  for (const [label, value] of metaRows) {
    const row = summary.addRow({ label, value });
    if (label) {
      row.getCell('label').font = { bold: true, color: { argb: 'FFA5B4FC' } };
      const scoreFields = ['Performance','Accessibility','SEO','Best Practices','LLM Readiness'];
      if (scoreFields.includes(label) && typeof value === 'number') {
        row.getCell('value').font = { bold: true, color: { argb: scoreColor(value) } };
      }
    }
  }

  if (analysis.ai_summary) {
    summary.addRow({ label: '', value: '' });
    summary.addRow({ label: 'AI Summary', value: '' }).getCell('label').font = { bold: true, color: { argb: 'FFA5B4FC' } };
    const sumRow = summary.addRow({ label: '', value: analysis.ai_summary });
    sumRow.getCell('value').alignment = { wrapText: true };
    sumRow.height = 80;
  }

  // ── Sheet 2: AI Insights ─────────────────────────────────────────
  if (ai?.insights?.length) {
    const sheet = wb.addWorksheet('AI Insights');
    sheet.columns = [
      { key: 'priority',    width: 12 },
      { key: 'category',    width: 16 },
      { key: 'title',       width: 36 },
      { key: 'description', width: 50 },
      { key: 'rec',         width: 50 },
      { key: 'impact',      width: 30 },
      { key: 'effort',      width: 12 },
    ];
    addHeaders(sheet, ['Priority','Category','Title','Description','Recommendation','Expected Impact','Effort']);

    for (const ins of ai.insights) {
      const row = sheet.addRow({
        priority:    ins.priority,
        category:    ins.category,
        title:       ins.title,
        description: ins.description,
        rec:         ins.recommendation,
        impact:      ins.estimatedImpact ?? '',
        effort:      ins.effortLevel ?? '',
      });
      row.eachCell(c => { c.border = BORDER; c.alignment = { wrapText: true, vertical: 'top' }; });
      const pCell = row.getCell('priority');
      pCell.font = { bold: true, color: { argb: ins.priority === 'critical' || ins.priority === 'high' ? 'FFEF4444' : ins.priority === 'medium' ? 'FFF59E0B' : 'FF10B981' } };
    }
  }

  // ── Sheet 3: Security Headers ────────────────────────────────────
  if (scores?.securityHeaders?.length) {
    const sheet = wb.addWorksheet('Security Headers');
    sheet.columns = [
      { key: 'header',  width: 36 },
      { key: 'present', width: 10 },
      { key: 'severity',width: 12 },
      { key: 'value',   width: 50 },
      { key: 'fix',     width: 55 },
    ];
    addHeaders(sheet, ['Header','Present','Severity','Current Value','Recommendation']);

    for (const h of scores.securityHeaders) {
      const row = sheet.addRow({
        header:  h.header,
        present: h.present ? 'Yes' : 'No',
        severity: h.present ? '' : h.severity,
        value:   h.value ?? '',
        fix:     h.present ? '' : h.recommendation,
      });
      row.eachCell(c => { c.border = BORDER; c.alignment = { wrapText: true, vertical: 'top' }; });
      row.getCell('present').font = { bold: true, color: { argb: h.present ? 'FF10B981' : 'FFEF4444' } };
    }
  }

  // ── Sheet 4: Accessibility Issues ────────────────────────────────
  const a11y = analysis.accessibility_issues as any[];
  if (a11y?.length) {
    const sheet = wb.addWorksheet('Accessibility');
    sheet.columns = [
      { key: 'id',     width: 30 },
      { key: 'impact', width: 12 },
      { key: 'desc',   width: 55 },
      { key: 'wcag',   width: 30 },
      { key: 'nodes',  width: 40 },
    ];
    addHeaders(sheet, ['Rule ID','Impact','Description','WCAG Criteria','Affected Elements']);

    for (const issue of a11y) {
      const row = sheet.addRow({
        id:     issue.id,
        impact: issue.impact,
        desc:   issue.description,
        wcag:   (issue.wcagCriteria ?? []).join(', '),
        nodes:  (issue.nodes ?? []).slice(0, 3).join('\n'),
      });
      row.eachCell(c => { c.border = BORDER; c.alignment = { wrapText: true, vertical: 'top' }; });
      const impactColors: Record<string, string> = { critical: 'FFEF4444', serious: 'FFF97316', moderate: 'FFF59E0B', minor: 'FF6B7280' };
      row.getCell('impact').font = { bold: true, color: { argb: impactColors[issue.impact] ?? 'FF6B7280' } };
    }
  }

  // ── Sheet 5: Console Errors ──────────────────────────────────────
  const consoleErrors = analysis.console_errors as any[];
  if (consoleErrors?.length) {
    const sheet = wb.addWorksheet('Console Errors');
    sheet.columns = [
      { key: 'type',    width: 12 },
      { key: 'message', width: 70 },
      { key: 'source',  width: 45 },
      { key: 'line',    width: 10 },
    ];
    addHeaders(sheet, ['Type','Message','Source','Line']);

    for (const err of consoleErrors) {
      const row = sheet.addRow({
        type:    err.type ?? 'error',
        message: err.message,
        source:  err.source ?? '',
        line:    err.line ?? '',
      });
      row.eachCell(c => { c.border = BORDER; c.alignment = { wrapText: true, vertical: 'top' }; });
      row.getCell('type').font = { bold: true, color: { argb: err.type === 'error' ? 'FFEF4444' : 'FFF59E0B' } };
    }
  }

  // ── Sheet 6: Crawled Pages ───────────────────────────────────────
  const pages = analysis.crawl_pages as any[];
  if (pages?.length) {
    const sheet = wb.addWorksheet('Crawled Pages');
    sheet.columns = [
      { key: 'url',    width: 50 },
      { key: 'title',  width: 36 },
      { key: 'status', width: 10 },
      { key: 'perf',   width: 12 },
      { key: 'seo',    width: 10 },
      { key: 'a11y',   width: 10 },
      { key: 'llm',    width: 14 },
      { key: 'ttfb',   width: 12 },
    ];
    addHeaders(sheet, ['URL','Title','Status','Performance','SEO','Accessibility','LLM Readiness','TTFB (ms)']);

    for (const page of pages) {
      const row = sheet.addRow({
        url:    page.url,
        title:  page.title ?? '',
        status: page.statusCode ?? page.status ?? '',
        perf:   page.performance ?? '',
        seo:    page.seo ?? '',
        a11y:   page.accessibility ?? '',
        llm:    page.llmReadiness ?? '',
        ttfb:   page.ttfb ?? '',
      });
      row.eachCell(c => { c.border = BORDER; c.alignment = { vertical: 'top' }; });
      for (const key of ['perf','seo','a11y','llm'] as const) {
        const cell = row.getCell(key);
        if (typeof cell.value === 'number') {
          cell.font = { bold: true, color: { argb: scoreColor(cell.value as number) } };
        }
      }
    }
  }

  return wb.xlsx.writeBuffer() as Promise<unknown> as Promise<Buffer>;
}
