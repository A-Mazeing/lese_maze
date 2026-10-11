import type { ReactNode } from 'react';
import { useT } from '@/i18n';

interface SourceCardProps {
  title: string;
  description: string;
  tone: 'red' | 'purple' | 'green';
  icon: ReactNode;
  onClick?: () => void;
}

const TONES = {
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
} as const;

function SourceCard({ title, description, tone, icon, onClick }: SourceCardProps) {
  const content = (
    <>
      <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${TONES[tone]}`}>{icon}</div>
      <div className="text-center">
        <p className="font-semibold text-lg">{title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </>
  );
  const base =
    'flex flex-col items-center gap-4 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700';

  if (!onClick) return <div className={base}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} hover:border-blue-300 dark:hover:border-blue-600 transition-all hover:shadow-md`}
    >
      {content}
    </button>
  );
}

interface SourcePickerProps {
  onSelect: (mode: 'pdf' | 'epub') => void;
}

/** Startansicht: Quelle wählen. */
export function SourcePicker({ onSelect }: SourcePickerProps) {
  const t = useT();
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="grid md:grid-cols-3 gap-6 max-w-3xl">
        <SourceCard
          title={t('source.pdfTitle')}
          description={t('source.pdfDesc')}
          tone="red"
          onClick={() => onSelect('pdf')}
          icon={
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            </svg>
          }
        />
        <SourceCard
          title={t('source.epubTitle')}
          description={t('source.epubDesc')}
          tone="purple"
          onClick={() => onSelect('epub')}
          icon={
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
            </svg>
          }
        />
        <SourceCard
          title={t('source.pageTitle')}
          description={t('source.pageDesc')}
          tone="green"
          icon={
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
