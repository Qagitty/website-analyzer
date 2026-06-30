/**
 * Public hosted widget page — no auth required.
 * Used as:
 *   - Standalone link: "Get your free audit at wa.dev/widget/wk_live_xxx"
 *   - Iframe embed: <iframe src="https://wa.dev/widget/wk_live_xxx" ...>
 */
import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { WidgetForm } from '@/components/widget/WidgetForm';
import { NOINDEX_NOFOLLOW_ROBOTS } from '@/lib/seo/robots';

interface PageProps {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const supabase = createServiceRoleClient();

  const { data } = await (supabase.from('user_settings') as any)
    .select('agency_name, brand_color')
    .eq('widget_key', key)
    .single();

  const agencyName = data?.agency_name ?? 'WebAnalyzer';
  return {
    title: `Free Website Audit — ${agencyName}`,
    description: 'Get a free performance, accessibility, and AI analysis of your website.',
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  };
}

export default async function WidgetPage({ params }: PageProps) {
  const { key } = await params;
  const supabase = createServiceRoleClient();

  const { data: settings } = await (supabase.from('user_settings') as any)
    .select('agency_name, brand_color, show_powered_by, widget_settings')
    .eq('widget_key', key)
    .single();

  // Invalid or not-found key
  if (!settings) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="text-4xl">🔑</div>
          <h1 className="text-xl font-bold text-foreground">Widget Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This widget key is invalid or has been deactivated.
          </p>
        </div>
      </div>
    );
  }

  const agencyName    = settings.agency_name ?? null;
  const brandColor    = settings.brand_color ?? '#6366f1';
  const showPoweredBy = settings.show_powered_by ?? true;
  const widgetSettings = settings.widget_settings ?? {};

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          {agencyName && (
            <p className="text-sm font-semibold" style={{ color: brandColor }}>
              {agencyName}
            </p>
          )}
          <h1 className="text-2xl font-bold text-white">Free Website Audit</h1>
          <p className="text-sm text-muted-foreground">
            Enter your URL to get a full performance, accessibility, and AI analysis.
          </p>
        </div>

        {/* Form */}
        <WidgetForm
          widgetKey={key}
          brandColor={brandColor}
          showEmail={widgetSettings.showEmail ?? true}
          buttonText={widgetSettings.buttonText ?? 'Analyze My Site'}
        />

        {/* Powered by */}
        {showPoweredBy && (
          <p className="text-center text-xs text-muted-foreground/50">
            Powered by{' '}
            <a
              href={process.env.NEXT_PUBLIC_APP_URL ?? '/'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              WebAnalyzer
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
