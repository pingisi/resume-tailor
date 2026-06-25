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

export type InterviewCategory =
  | 'technical'
  | 'behavioral'
  | 'role-specific'
  | 'culture';

export interface InterviewQuestion {
  category: InterviewCategory;
  question: string;
  why: string;
  talkingPoints: string[];
}

export interface InterviewPrep {
  generatedAt: number;
  questions: InterviewQuestion[];
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
  applyUrl?: string;
  generatedResume: string;
  generatedCoverLetter: string;
  status: ApplicationStatus;
  notes?: string;
  interviewPrep?: InterviewPrep;
  quickAnswers?: { question: string; answer: string }[];
  messages?: AppMessage[];
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
  keywords?: string[];
  /** 0-100. Higher = more aggressive fabrication to hit ATS keywords. */
  targetAts?: number;
  /** Optional feedback from the previous attempt's fit score, used for
   *  iterative auto-improvement loops. */
  previousFeedback?: {
    score: number;
    verdict?: string;
    gaps: string[];
    previousResume?: string;
  };
}

export interface GenerateResponse {
  resume: string;
  coverLetter: string;
}

export interface ProfileQA {
  question: string;
  answer: string;
}

export interface Profile {
  fullName?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  location?: string;
  workAuthorization?: string;
  willingToRelocate?: string;
  noticePeriod?: string;
  yearsOfExperience?: string;
  salaryExpectation?: string;
  preferredArrangement?: string;
  about?: string;
  reasonForLeaving?: string;
  customAnswers?: ProfileQA[];
  updatedAt: number;
}

export interface AnswerRequest {
  profile: Profile;
  company?: string;
  role?: string;
  jobDescription?: string;
  tailoredResume?: string;
  questions: string[];
}

export interface AnswerResponse {
  answers: { question: string; answer: string }[];
}

export type MessageKind = 'follow-up' | 'thank-you' | 'recruiter-dm';

export interface AppMessage {
  kind: MessageKind;
  subject?: string;
  body: string;
  generatedAt: number;
}

export interface ComposeMessageRequest {
  kind: MessageKind;
  profile?: Profile;
  company?: string;
  role?: string;
  jobDescription?: string;
  tailoredResume?: string;
  recipient?: ApplicationRecipient;
  appliedAt?: number;
  daysSinceApplied?: number;
  /** Optional free-text guidance, e.g. “mention the AI/ML angle”. */
  extra?: string;
}

export interface ComposeMessageResponse {
  subject?: string;
  body: string;
}

export interface ApplicationFormPrefill {
  resumeId?: string;
  company?: string;
  role?: string;
  recipientName?: string;
  recipientTitle?: string;
  tone?: string;
  targetAts?: number;
  jobDescription?: string;
  jdUrl?: string;
}

export interface FitScoreRequest {
  resumeText: string;
  jobDescription: string;
  company?: string;
  role?: string;
}

export interface FitScoreResponse {
  score: number; // 1-10
  verdict: string;
  reasonsToApply: string[];
  gapsToAddress: string[];
}
