export interface RubricTypeItem {
  id: string;
  title: string;
  text: string;
}

export interface StudentInfo {
  name: string;
  className: string;
  seatNo: string;
}

export interface MisconceptionItem {
  id: string;
  code: string;
  concept: string;
  correction: string;
  frequencyCount?: number;
}

export interface QuizQuestion {
  id: string;
  misconceptionCode?: string;
  targetMisconception?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface KnowledgeUnit {
  id: string;
  unitCode: string;
  subject: '生物' | '理化' | '地科';
  title: string;
  description: string;
  keyConcepts: string[];
  commonMisconceptions: MisconceptionItem[];
  conceptMapNodes: number;
  conceptMapLinks: number;
  knowledgePointsCount: number;
  textbookExcerpt: string;
  quizQuestions?: QuizQuestion[];
}

export interface RubricLevel {
  level: 'A' | 'B' | 'C' | 'D';
  name: string;
  scoreRange: string;
  description: string;
}

export interface RubricCriteria {
  id: string;
  title: string;
  weight: number; // percentage, e.g. 30
  maxPoints: number; // e.g. 25 or 100
  levels: RubricLevel[];
}

export interface RubricScoreItem {
  criteriaId: string;
  criteriaTitle: string;
  score: number;
  maxScore: number;
  level: 'A' | 'B' | 'C' | 'D';
  feedback: string;
}

export interface MisconceptionFound {
  id: string;
  code: string;
  conceptTitle: string;
  studentStatementExcerpt: string;
  remedialHint: string;
  logicViolation?: string;
}

export interface DifferentiatedAdvice {
  strengths: string[];
  improvements: string[];
  recommendedReviewTask: string;
}

export interface ScoringTableItem {
  item: string;
  details: string;
  score: string;
  explanation: string;
}

export interface ConceptMapLogicError {
  error_location: string;
  error_type: string;
  student_wrote: string;
  logic_violation: string;
  generic_explanation: string;
}

export interface ConceptMapAnalysis {
  identified_theme: string;
  structural_metrics?: {
    hierarchical_levels?: number;
    propositions_count?: number;
    cross_links_count?: number;
    examples_count?: number;
  };
  identified_errors: ConceptMapLogicError[];
  universal_grading_summary: string;
}

export interface AssessmentResult {
  id: string;
  hash: string; // MD5/SHA256 deterministic hash
  studentName: string;
  className: string;
  seatNo: string;
  unitId: string;
  unitTitle: string;
  submittedAt: string;
  totalScore: number;
  gradeLevel: string; // e.g. "A (優秀)"
  isRelevant: boolean; // Relevant filtering flag
  scoringTable: ScoringTableItem[]; // 4-column detailed scoring table
  socraticFeedback: string; // Socratic differentiated feedback
  ocrExtractedText: string;
  hasImage: boolean;
  imageUrl?: string;
  fileName?: string;
  fileType?: string;
  rubricScores: RubricScoreItem[];
  misconceptions: MisconceptionFound[];
  summaryFeedback: string;
  differentiatedAdvice: DifferentiatedAdvice;
  conceptMapAnalysis?: ConceptMapAnalysis;
  cached: boolean;
  googleSheetsSynced: boolean;
  firebaseSynced: boolean;
  teacherOverridden?: boolean;
  teacherNotes?: string;
}

export interface SystemConfig {
  classes: string[];
  firebaseConnected: boolean;
  googleSheetsConnected: boolean;
  googleSheetId: string;
  temperature: number; // 0.0 for reliability lock
  seed: number; // fixed seed
  autoSyncGoogleSheets: boolean;
  strictReliabilityCache: boolean;
}

export interface MisconceptionStat {
  unitId: string;
  unitTitle: string;
  misconceptionCode: string;
  misconceptionTitle: string;
  count: number;
  percentage: number;
  affectedStudents: { name: string; className: string; seatNo: string }[];
  suggestedTeachingStrategy: string;
}
