import React from 'react';
import { PhoneOff, MessageSquareOff, MailX, ShieldAlert } from 'lucide-react';

export default function DoNotContactBanner({ household }) {
  const flags = [];
  if (household?.do_not_call) flags.push({ label: 'Do Not Call', icon: PhoneOff });
  if (household?.do_not_text) flags.push({ label: 'Do Not Text', icon: MessageSquareOff });
  if (household?.email_opt_out) flags.push({ label: 'Email Opt-Out', icon: MailX });

  if (flags.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            This Champion has requested limited or no contact
          </p>
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
            Please respect their wishes — do not reach out through the following:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {flags.map((f) => {
              const Icon = f.icon;
              return (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}