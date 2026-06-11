export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string | null;
  email: string;
  role: 'USER' | 'ADMIN';
  userId: number;
}

export interface UserSummary {
  id: number;
  email: string;
  role: string;
  enabled: boolean;
  createdAt: string;
  lastLogin: string | null;
  progressSummary: {
    totalSections: number;
    sectionsPassed: number;
    overallProgress: number;
    totalQuestionsAnswered: number;
    overallAccuracy: number;
  };
}
