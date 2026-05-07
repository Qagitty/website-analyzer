import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  url: string | null;
  siteUrl: string;
}

export function ScreenshotViewer({ url, siteUrl }: Props) {
  if (!url) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screenshot</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-hidden rounded-md border">
          <Image
            src={url}
            alt={`Screenshot of ${siteUrl}`}
            width={1440}
            height={900}
            className="w-full h-auto"
            priority
          />
        </div>
      </CardContent>
    </Card>
  );
}
