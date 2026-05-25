'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';

type Tab = 'signin' | 'signup';

interface AuthModalProps {
  open: boolean;
  defaultTab?: Tab;
  onClose: () => void;
}

export function AuthModal({ open, defaultTab = 'signup', onClose }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync tab when defaultTab changes (e.g. opening with different tab)
  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('signin')}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-colors ${
              activeTab === 'signin'
                ? 'text-foreground border-b-2 border-indigo-500 bg-indigo-500/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab('signup')}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-colors ${
              activeTab === 'signup'
                ? 'text-foreground border-b-2 border-indigo-500 bg-indigo-500/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'signin' ? (
            <>
              <h2 className="text-xl font-semibold mb-5">Welcome back</h2>
              <LoginForm />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setActiveTab('signup')}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline"
                >
                  Create one free
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-5">Create your account</h2>
              <SignupForm />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <button
                  onClick={() => setActiveTab('signin')}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline"
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
