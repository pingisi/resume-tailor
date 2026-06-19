export interface StoredResume {
  id: string;
  name: string;
  fileName: string;
  text: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ApplicationStatus =
  | 'draft'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface ApplicationRecipient {
  name?: string;
  title?: string;
}

export interface Application {
  id: string;
  name: string;
  company: string;
  role: string;
  resumeId: string;
  resumeName: string;
  jobDescription: string;
  recipient?: ApplicationRecipient;
  tone: string;
  generatedResume: string;
  generatedCoverLetter: string;
  status: ApplicationStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  appliedAt?: number;
}

export interface GenerateRequest {
  resumeText: string;
  jobDescription: string;
  tone?: string;
  company?: string;
  role?: string;
  recipient?: ApplicationRecipient;
}

export interface GenerateResponse {
  resume: string;
  coverLetter: string;
}
