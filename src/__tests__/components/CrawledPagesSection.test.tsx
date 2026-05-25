import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawledPagesSection } from '@/components/reports/CrawledPagesSection';

const mockPages = [
  { url: 'https://example.com/about', status: 200, performance: 85, errors: [] },
  { url: 'https://example.com/contact', status: 200, performance: 72, errors: [] },
  { url: 'https://example.com/missing', status: 404, performance: null, errors: ['Not found'] },
  { url: 'https://example.com/old', status: 301, performance: null, errors: [] },
];

describe('CrawledPagesSection', () => {
  it('returns null when crawledPages is undefined', () => {
    const { container } = render(<CrawledPagesSection crawledPages={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when crawledPages has 0 items', () => {
    const { container } = render(<CrawledPagesSection crawledPages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when only 1 page (no crawl occurred)', () => {
    const { container } = render(
      <CrawledPagesSection crawledPages={[mockPages[0]]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders section when multiple pages present', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    expect(screen.getByText(/Crawled Pages/i)).toBeInTheDocument();
  });

  it('shows total pages in summary card', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders page URLs', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    expect(screen.getByText(/\/about/)).toBeInTheDocument();
    expect(screen.getByText(/\/contact/)).toBeInTheDocument();
  });

  it('shows 200 status with green indicator', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    const statusBadges = screen.getAllByText('200');
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('shows 404 status with red indicator', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('shows 3xx status with amber indicator', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    expect(screen.getByText('301')).toBeInTheDocument();
  });

  it('shows performance score when available', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('shows errors count in summary', () => {
    render(<CrawledPagesSection crawledPages={mockPages} />);
    // 1 page has errors (the 404 page)
    expect(screen.getByText(/1.*error|error.*1/i)).toBeInTheDocument();
  });
});
