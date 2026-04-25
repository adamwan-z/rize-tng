import { PaymentHandoff } from './PaymentHandoff.js';
import { ReviewSubmitHandoff } from './ReviewSubmitHandoff.js';
import { EmailHandoff } from './EmailHandoff.js';

export function HandoffCard({
  kind,
  payload,
}: {
  kind: 'payment' | 'review_submit' | 'email';
  payload: Record<string, unknown>;
}) {
  switch (kind) {
    case 'payment':
      return <PaymentHandoff payload={payload} />;
    case 'review_submit':
      return <ReviewSubmitHandoff payload={payload} />;
    case 'email':
      return <EmailHandoff payload={payload} />;
  }
}
