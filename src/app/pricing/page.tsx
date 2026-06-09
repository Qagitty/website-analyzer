import type { Metadata } from 'next';
import { PricingPage } from '@/components/pricing/PricingPage';

export const metadata: Metadata = {
  title: 'Pricing — WebAnalyzer',
  description:
    'Simple, transparent pricing for website audits. Free plan available. Pro from $29/mo, Agency from $99/mo, Compliance from $249/mo.',
  openGraph: {
    title: 'Pricing — WebAnalyzer',
    description:
      'Start free. Upgrade when you need more audits, PDF reports, API access, or compliance features.',
    url: '/pricing',
  },
  alternates: {
    canonical: '/pricing',
  },
};

/** JSON-LD structured data for the pricing page */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'WebAnalyzer',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      description: 'Try the product. No credit card required.',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '29',
      priceCurrency: 'USD',
      description: 'For freelancers and small business owners.',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '29',
        priceCurrency: 'USD',
        billingIncrement: 1,
        unitCode: 'MON',
      },
    },
    {
      '@type': 'Offer',
      name: 'Agency',
      price: '99',
      priceCurrency: 'USD',
      description: 'For web studios and small agencies.',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '99',
        priceCurrency: 'USD',
        billingIncrement: 1,
        unitCode: 'MON',
      },
    },
    {
      '@type': 'Offer',
      name: 'Compliance',
      price: '249',
      priceCurrency: 'USD',
      description: 'For businesses that need accessibility compliance tracking.',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '249',
        priceCurrency: 'USD',
        billingIncrement: 1,
        unitCode: 'MON',
      },
    },
  ],
};

export default function PricingRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingPage />
    </>
  );
}
