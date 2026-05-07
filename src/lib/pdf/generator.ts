import type { Analysis } from '@/types/analysis';

// PDF generation is handled client-side via window.print() or a third-party lib.
// Install @react-pdf/renderer for full PDF generation in Week 3.
export async function generateReportPDF(analysis: Analysis): Promise<Buffer> {
  // Placeholder — replace with actual PDF generation
  const content = `
Website Analysis Report
=======================
URL: ${analysis.url}
Date: ${new Date(analysis.created_at).toLocaleDateString()}
Status: ${analysis.status}

Performance Score: ${analysis.lighthouse_scores?.performance ?? 'N/A'}/100
Accessibility Score: ${analysis.lighthouse_scores?.accessibility ?? 'N/A'}/100
SEO Score: ${analysis.lighthouse_scores?.seo ?? 'N/A'}/100

AI Summary:
${analysis.ai_summary ?? 'No AI analysis available'}
`.trim();

  return Buffer.from(content, 'utf-8');
}
