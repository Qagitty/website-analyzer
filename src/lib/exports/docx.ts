import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
} from 'docx';
import type { Analysis } from '@/types/analysis';

const INDIGO = '4F46E5';
const EMERALD = '059669';
const RED     = 'DC2626';
const AMBER   = 'D97706';
const GRAY    = '6B7280';
const DARK    = '1E1B4B';

function h1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    run: { color: DARK },
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    run: { color: INDIGO },
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
  });
}

function p(text: string, color?: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, color, size: 22 })],
    spacing: { after: 120 },
  });
}

function kv(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: INDIGO, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
    spacing: { after: 80 },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' } },
    spacing: { before: 200, after: 200 },
  });
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return GRAY;
  if (score >= 80) return EMERALD;
  if (score >= 50) return AMBER;
  return RED;
}

function simpleTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(h =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })],
          alignment: AlignmentType.CENTER,
        })],
        shading: { type: ShadingType.SOLID, color: DARK },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
      })
    ),
    tableHeader: true,
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: cell, size: 20 })],
          })],
          shading: { type: ShadingType.SOLID, color: ri % 2 === 0 ? 'F9FAFB' : 'FFFFFF' },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
      left:   { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
      right:  { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
    },
  });
}

export async function generateDOCX(analysis: Analysis): Promise<Buffer> {
  const scores  = analysis.lighthouse_scores as any;
  const ai      = analysis.ai_insights as any;
  const a11y    = analysis.accessibility_issues as any[];
  const errors  = analysis.console_errors as any[];
  const pages   = analysis.crawl_pages as any[];
  const date    = new Date(analysis.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const children: (Paragraph | Table)[] = [];

  // ── Title ──────────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Website Analysis Report', bold: true, size: 52, color: DARK })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  }));
  children.push(kv('URL',      analysis.url));
  children.push(kv('Analyzed', date));
  children.push(kv('Report ID', analysis.id));
  children.push(divider());

  // ── Executive Summary ─────────────────────────────────────────────
  if (analysis.ai_summary) {
    children.push(h2('Executive Summary'));
    children.push(p(analysis.ai_summary));
    children.push(divider());
  }

  // ── Scores ────────────────────────────────────────────────────────
  if (scores) {
    children.push(h2('Scores'));
    const scoreFields: [string, number | null][] = [
      ['Performance',    scores.performance],
      ['Accessibility',  scores.accessibility],
      ['SEO',            scores.seo],
      ['Best Practices', scores.bestPractices],
      ['LLM Readiness',  scores.llmReadiness ?? null],
    ];
    children.push(simpleTable(
      ['Category', 'Score'],
      scoreFields
        .filter(([, v]) => v != null)
        .map(([label, value]) => [label, `${value}/100`])
    ));

    if (scores.estimatedLcp != null) {
      children.push(new Paragraph({ spacing: { after: 120 } }));
      children.push(h3('Core Web Vitals'));
      children.push(simpleTable(
        ['Metric', 'Value'],
        [
          ['Largest Contentful Paint (LCP)', `${(scores.estimatedLcp / 1000).toFixed(1)}s`],
          ...(scores.ttfb != null ? [['Time to First Byte (TTFB)', `${scores.ttfb}ms`]] : []),
        ]
      ));
    }
    children.push(divider());
  }

  // ── Security Headers ──────────────────────────────────────────────
  if (scores?.securityHeaders?.length) {
    children.push(h2('Security Headers'));
    const present = (scores.securityHeaders as any[]).filter((h: any) => h.present).length;
    children.push(p(`${present}/${scores.securityHeaders.length} headers present`));
    children.push(simpleTable(
      ['Header', 'Status', 'Value / Recommendation'],
      (scores.securityHeaders as any[]).map((h: any) => [
        h.header,
        h.present ? '✅ Present' : `❌ Missing (${h.severity})`,
        h.present ? (h.value ?? '') : h.recommendation,
      ])
    ));
    children.push(divider());
  }

  // ── AI Insights ───────────────────────────────────────────────────
  if (ai?.insights?.length) {
    children.push(h2('AI Insights'));

    for (const ins of ai.insights) {
      const color = ins.priority === 'critical' || ins.priority === 'high' ? RED : ins.priority === 'medium' ? AMBER : EMERALD;
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `[${(ins.priority as string).toUpperCase()}] `, bold: true, color, size: 24 }),
          new TextRun({ text: ins.title, bold: true, size: 24 }),
        ],
        spacing: { before: 200, after: 80 },
      }));
      if (ins.description) children.push(p(ins.description));
      if (ins.recommendation) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: 'Recommendation: ', bold: true, size: 22 }),
            new TextRun({ text: ins.recommendation, size: 22 }),
          ],
          spacing: { after: 120 },
        }));
      }
    }
    children.push(divider());
  }

  // ── Quick Wins ────────────────────────────────────────────────────
  if (ai?.quickWins?.length) {
    children.push(h2('Quick Wins'));
    for (const win of ai.quickWins) children.push(bullet(win));
    children.push(divider());
  }

  // ── Accessibility Issues ──────────────────────────────────────────
  if (a11y?.length) {
    children.push(h2('Accessibility Issues'));
    children.push(simpleTable(
      ['Rule', 'Impact', 'Description', 'WCAG'],
      a11y.map(issue => [
        issue.id,
        issue.impact,
        issue.description ?? '',
        (issue.wcagCriteria ?? []).join(', '),
      ])
    ));
    children.push(divider());
  }

  // ── Console Errors ────────────────────────────────────────────────
  if (errors?.length) {
    children.push(h2('Console Errors'));
    children.push(simpleTable(
      ['Type', 'Message', 'Source'],
      errors.map(e => [
        (e.type ?? 'error').toUpperCase(),
        e.message,
        e.source ?? '',
      ])
    ));
    children.push(divider());
  }

  // ── Crawled Pages ─────────────────────────────────────────────────
  if (pages?.length) {
    children.push(h2('Crawled Pages'));
    children.push(simpleTable(
      ['URL', 'Status', 'Perf', 'SEO', 'A11y'],
      pages.map(page => {
        const url = (() => { try { const u = new URL(page.url); return u.hostname + u.pathname; } catch { return page.url; } })();
        return [url, String(page.statusCode ?? '—'), String(page.performance ?? '—'), String(page.seo ?? '—'), String(page.accessibility ?? '—')];
      })
    ));
    children.push(divider());
  }

  // ── Footer ────────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [new TextRun({ text: `Generated by Website Analyzer · ${date}`, color: GRAY, size: 18, italics: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1.2),
            right:  convertInchesToTwip(1.2),
          },
        },
      },
      children,
    }],
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
