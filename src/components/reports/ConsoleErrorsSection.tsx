import type { ConsoleError } from '@/types/analysis';

export function ConsoleErrorsSection({ errors }: { errors: ConsoleError[] }) {
  const errorCount = errors.filter((e) => e.type === 'error').length;
  const warnCount = errors.filter((e) => e.type === 'warning').length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Console Errors</h2>
        {errorCount > 0 && (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            {errorCount} errors
          </span>
        )}
        {warnCount > 0 && (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {warnCount} warnings
          </span>
        )}
      </div>

      {errors.length === 0 ? (
        <p className="text-emerald-400 text-center py-4">No console errors found</p>
      ) : (
        <div className="space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="bg-[#0A0A0F] rounded-lg p-3 border border-white/5 space-y-1">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 mt-0.5 ${
                    err.type === 'error'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {err.type}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-mono break-all ${err.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                    {err.message}
                  </p>
                  {err.source && (
                    <p className="text-[#475569] text-xs mt-1 truncate">
                      {err.source}{err.line ? `:${err.line}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
