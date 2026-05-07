import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
        Website Analyzer
      </h1>
      <p className="text-base md:text-xl text-muted-foreground max-w-2xl mb-8">
        Automatically analyze your website for performance, accessibility, and SEO.
        Get AI-powered recommendations in under 60 seconds.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/signup">Get Started Free</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    </main>
  );
}
