import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Tells leaders, on every messaging screen, whether texts are real. In test mode a
 * "sent" message is only recorded, so nobody should mistake that for delivery.
 */
export default function SmsModeBanner() {
  const { data } = useQuery({ queryKey: ['messaging-status'], queryFn: api.getMessagingStatus, refetchInterval: 30_000 });
  if (!data) return null;

  if (data.configError) {
    return (
      <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
        Text messaging is not set up correctly: {data.configError}
      </div>
    );
  }

  const whatsapp = data.whatsapp;
  const whatsappNote = whatsapp && (
    <p className="text-[11px] opacity-80">
      {whatsapp.configError
        ? `WhatsApp is not set up correctly: ${whatsapp.configError}`
        : whatsapp.dryRun
          ? 'WhatsApp: test mode (nothing sent).'
          : `WhatsApp: live via ${whatsapp.provider?.name}. ${Math.max(0, whatsapp.monthlyMessageCap - whatsapp.liveMessagesUsed)} of this month's ${whatsapp.monthlyMessageCap} messages remain.`}
    </p>
  );

  if (data.dryRun) {
    return (
      <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
        <strong>Test mode.</strong> Texts are recorded in the history below but <strong>nothing is actually sent</strong> and nothing
        is charged. Connect an SMS provider to go live.
        {whatsappNote}
      </div>
    );
  }

  const left = Math.max(0, data.monthlySegmentCap - data.liveSegmentsUsed);
  const percent = data.monthlySegmentCap === 0 ? 100 : Math.min(100, Math.round((data.liveSegmentsUsed / data.monthlySegmentCap) * 100));
  return (
    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs space-y-2">
      <p>
        <strong>Live.</strong> Texts are really being sent via {data.provider?.name}. {left} of this month&apos;s {data.monthlySegmentCap} text
        segments remain.
      </p>
      {whatsappNote}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full ${percent >= 90 ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
