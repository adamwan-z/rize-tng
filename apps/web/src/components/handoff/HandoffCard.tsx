import { AP2PaymentCard } from '../agent/AP2PaymentCard.js';
import { DeclineCard } from '../agent/DeclineCard.js';
import { ReviewSubmitHandoff } from './ReviewSubmitHandoff.js';
import { EmailHandoff } from './EmailHandoff.js';
import { SupplyListHandoff } from './SupplyListHandoff.js';

// Lane B has widened the shared union to include 'supply_list' (this branch).
// Lane A still keeps 'decline' as a local widening pending a contract update.
// Once Lane B adds 'decline' to AgentEvent.handoff.kind, drop this alias.
type HandoffKind = 'payment' | 'review_submit' | 'email' | 'decline' | 'supply_list';

export function HandoffCard({
  kind,
  payload,
}: {
  kind: HandoffKind;
  payload: Record<string, unknown>;
}) {
  switch (kind) {
    case 'payment': {
      const amountRm = (payload.amountRm as number | undefined) ?? 0;
      const payee = (payload.payee as string | undefined) ?? "Lotus's Malaysia";
      return <AP2PaymentCard amountRm={amountRm} payee={payee} />;
    }
    case 'decline': {
      return (
        <DeclineCard
          what={(payload.what as string | undefined) ?? 'permohonan ni'}
          reason={
            (payload.reason as string | undefined) ??
            'CFO check tak lulus. Cashflow tak cukup ruang sekarang.'
          }
          cashOnHandRm={payload.cashOnHandRm as number | undefined}
          monthlyDebtServiceRm={payload.monthlyDebtServiceRm as number | undefined}
          alternative={
            payload.alternative as
              | { label: string; cta: string }
              | undefined
          }
        />
      );
    }
    case 'review_submit':
      return <ReviewSubmitHandoff payload={payload} />;
    case 'email':
      return <EmailHandoff payload={payload} />;
    case 'supply_list':
      return <SupplyListHandoff payload={payload} />;
  }
}
