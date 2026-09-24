export type Role = 'ADMIN' | 'DOCTOR' | 'NURSE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type PatientStatus = 'ADMITTED' | 'DISCHARGED' | 'IN_FOLLOW_UP' | 'STABLE';
export type ReferralStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
export type FollowUpStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
export type GeneralCondition = 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  facility: { id: string; name: string; type: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PatientListItem {
  id: string;
  fullName: string;
  birthDate: string;
  sex: 'MALE' | 'FEMALE';
  district: string;
  status: PatientStatus;
  riskLevel: Priority | null;
  dischargedAt: string | null;
  updatedAt: string;
  facility: { id: string; name: string };
  familyDoctor: { id: string; fullName: string } | null;
}

export interface Observation {
  id: string;
  clientId: string | null;
  followUpId: string | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  symptoms: string[];
  generalCondition: GeneralCondition | null;
  notes: string | null;
  recordedAt: string;
  syncedFromOffline: boolean;
  recordedBy?: { fullName: string; role: Role };
}

export interface RiskFactor {
  code: string;
  label: string;
  weight: number;
}

export interface RiskAssessment {
  id: string;
  level: Priority;
  score: number;
  factors: RiskFactor[];
  recommendedAction: string;
  engine: 'RULES' | 'LLM';
  createdAt: string;
}

export interface FollowUp {
  id: string;
  status: FollowUpStatus;
  scheduledFor: string | null;
  visitStartedAt: string | null;
  completedAt: string | null;
  outcome: string | null;
  syncedFromOffline: boolean;
  assignedNurse: { id: string; fullName: string } | null;
  observations?: Observation[];
}

export interface Referral {
  id: string;
  priority: Priority;
  reason: string;
  dischargeSummary: string | null;
  status: ReferralStatus;
  deadline: string;
  acceptedAt: string | null;
  completedAt: string | null;
  escalatedAt: string | null;
  createdAt: string;
  fromFacility: { name: string };
  toFacility: { name: string };
  assignedDoctor: { id: string; fullName: string } | null;
  followUps: FollowUp[];
}

export interface ContinuityStep {
  key: string;
  label: string;
  done: boolean;
}

export interface Continuity {
  score: number;
  steps: ContinuityStep[];
  onTime: boolean | null;
}

export interface PatientDetail extends Omit<PatientListItem, 'facility' | 'familyDoctor'> {
  phone: string | null;
  address: string;
  diagnosisNote: string | null;
  admittedAt: string | null;
  facility: { id: string; name: string; type: string };
  familyDoctor: { id: string; fullName: string; facility: { name: string } } | null;
  observations: Observation[];
  referrals: Referral[];
  riskAssessments: RiskAssessment[];
  continuity: Continuity;
}

export interface ReferralListItem {
  id: string;
  priority: Priority;
  reason: string;
  status: ReferralStatus;
  deadline: string;
  acceptedAt: string | null;
  createdAt: string;
  patient: { id: string; fullName: string; birthDate: string; district: string; riskLevel: Priority | null; status: PatientStatus };
  fromFacility: { name: string };
  toFacility: { name: string };
  assignedDoctor: { id: string; fullName: string } | null;
  followUps: { id: string; status: FollowUpStatus; assignedNurse: { id: string; fullName: string } | null }[];
}

export interface ReferralDetail extends Omit<Referral, 'followUps'> {
  patient: {
    id: string;
    fullName: string;
    birthDate: string;
    sex: 'MALE' | 'FEMALE';
    address: string;
    district: string;
    phone: string | null;
    diagnosisNote: string | null;
    riskLevel: Priority | null;
    status: PatientStatus;
  };
  followUps: (FollowUp & { observations: Observation[] })[];
}

export interface NurseVisit {
  id: string;
  status: FollowUpStatus;
  scheduledFor: string | null;
  visitStartedAt: string | null;
  patient: {
    id: string;
    fullName: string;
    birthDate: string;
    sex: 'MALE' | 'FEMALE';
    address: string;
    district: string;
    phone: string | null;
    riskLevel: Priority | null;
    diagnosisNote: string | null;
  };
  referral: { id: string; priority: Priority; reason: string; deadline: string; status: ReferralStatus };
}

export interface StaffMember {
  id: string;
  fullName: string;
  role: Role;
  facility: { id: string; name: string };
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  district: string;
  publicCode: string;
}

export interface FeedbackItem {
  id: string;
  ward: string | null;
  rating: number;
  type: 'COMPLAINT' | 'SUGGESTION' | 'PRAISE' | 'OTHER';
  text: string | null;
  createdAt: string;
  facility: { name: string };
  analysis: {
    sentiment: Sentiment;
    category: string;
    topics: string[];
    priority: Priority;
    summary: string | null;
    engine: 'RULES' | 'LLM';
  } | null;
}

export interface Dashboard {
  kpis: {
    totalPatients: number;
    activeReferrals: number;
    overdueFollowUps: number;
    highRiskPatients: number;
    feedbackCount: number;
    urgentFeedback: number;
    careContinuityRate: number;
    onTimeCompletionRate: number | null;
    offlineSyncedVisits: number;
  };
  feedbackSentiment: Record<Sentiment, number>;
  feedbackTopics: { topic: string; count: number }[];
  attention: {
    id: string;
    status: ReferralStatus;
    priority: Priority;
    deadline: string;
    overdue: boolean;
    reasons: string[];
    patient: { id: string; fullName: string; riskLevel: Priority | null; district: string };
    assignedDoctor: { fullName: string } | null;
  }[];
  insights: string[];
}
