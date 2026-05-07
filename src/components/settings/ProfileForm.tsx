'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const schema = z.object({
  displayName: z
    .string()
    .max(80, 'Max 80 characters')
    .refine(
      (v) => v === '' || /^[\p{L}\p{N}\s'\-_.]+$/u.test(v.trim()),
      'Only letters, numbers, spaces, and the characters \' - _ . are allowed'
    )
    .refine(
      (v) => v === '' || v.trim().length > 0,
      'Name cannot be only whitespace'
    )
    .optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  email: string;
  initialName: string;
}

export function ProfileForm({ email, initialName }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: initialName },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: data.displayName?.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Profile saved');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <p className="font-medium mt-0.5 text-[#475569]">{email}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground" htmlFor="displayName">
              Display name
            </label>
            <Input
              id="displayName"
              placeholder="Your name"
              className="mt-1 bg-[#0A0A0F] border-white/10 text-foreground placeholder:text-[#475569] focus:border-indigo-500/50 focus:ring-indigo-500/20"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-sm text-red-400 mt-1">{errors.displayName.message}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading || !isDirty}
            className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
