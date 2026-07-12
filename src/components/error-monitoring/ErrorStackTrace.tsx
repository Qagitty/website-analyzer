'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StackFrame {
  function?: string;
  filename?:  string;
  lineno?:    number;
  colno?:     number;
}

interface Props {
  frames:   StackFrame[];
  maxShown?: number;
}

export function ErrorStackTrace({ frames, maxShown = 5 }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!frames || frames.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No stack trace available.</p>
    );
  }

  const shown = expanded ? frames : frames.slice(0, maxShown);
  const hidden = frames.length - maxShown;

  return (
    <div className="rounded-md bg-[#0A0A0F] border border-border overflow-x-auto">
      <div className="p-3 space-y-1">
        {shown.map((f, i) => (
          <div key={i} className="font-mono text-xs leading-5">
            <span className="text-indigo-400">{f.function ?? '(anonymous)'}</span>
            {f.filename && (
              <span className="text-muted-foreground">
                {' '}
                <span className="text-zinc-500">at</span>{' '}
                {f.filename}
                {f.lineno != null ? `:${f.lineno}` : ''}
                {f.colno  != null ? `:${f.colno}`  : ''}
              </span>
            )}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <div className="px-3 pb-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-6"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3 mr-1" /> Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3 mr-1" /> Show {hidden} more frame{hidden !== 1 ? 's' : ''}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
