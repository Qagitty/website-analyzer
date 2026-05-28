import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-gradient">Settings</h1>
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
