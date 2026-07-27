import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

const ENCOURAGEMENTS = [
  'Thank you for investing in stronger marriages.',
  'Every relationship matters.',
  'Small conversations create lasting impact.',
  'Faithful stewardship changes families.',
  'Pray first. Love well. Serve faithfully.',
];

export default function WelcomeHeader({ user }) {
  const [message] = useState(() => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const firstName = (user?.full_name || user?.email || 'Champion').split(' ')[0];

  return (
    <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-sm">
      <div className="flex items-center gap-2 text-primary-foreground/80">
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium uppercase tracking-wide">Home Workspace</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back, {firstName}</h1>
      <p className="mt-1 text-sm text-primary-foreground/80">{today}</p>
      <p className="mt-3 text-base font-medium text-primary-foreground/90">{message}</p>
    </div>
  );
}