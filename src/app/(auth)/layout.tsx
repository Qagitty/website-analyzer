export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] p-4">
      <div className="w-full max-w-md bg-[#13131A] border border-white/5 rounded-xl shadow-2xl p-8">
        {children}
      </div>
    </div>
  );
}
