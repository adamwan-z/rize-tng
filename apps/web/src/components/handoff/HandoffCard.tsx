import { PaymentHandoff } from './PaymentHandoff.js';
import { ReviewSubmitHandoff } from './ReviewSubmitHandoff.js';
import { EmailHandoff } from './EmailHandoff.js';

export function HandoffCard({
  kind,
  payload,
}: {
  kind: 'payment' | 'review_submit' | 'email' | 'supply_list';
  payload: Record<string, unknown>;
}) {
  switch (kind) {
    case 'payment':
      return <PaymentHandoff payload={payload} />;
    case 'review_submit':
      return <ReviewSubmitHandoff payload={payload} />;
    case 'email':
      return <EmailHandoff payload={payload} />;
    case 'supply_list':
      // Lane A: replace with SupplyListHandoff component when ready.
      return <EmailHandoff payload={payload} />;
  }
}
