import type { ApplicationStatus } from '../types';

const LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

interface Props {
  status: ApplicationStatus;
}

export function StatusBadge({ status }: Props) {
  return <span className={`status-badge status-${status}`}>{LABELS[status]}</span>;
}
