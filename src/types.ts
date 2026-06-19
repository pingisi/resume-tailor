export interface StoredResume {
  id: 'current';
  fileName: string;
  text: string;
  updatedAt: number;
}

export interface GenerateRequest {
  resumeText: string;
  jobDescription: string;
  tone?: string;
}

export interface GenerateResponse {
  resume: string;
  coverLetter: string;
}
