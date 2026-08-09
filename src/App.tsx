import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { StudentSubmissionView } from './components/StudentSubmissionView';
import { TeacherAdminView } from './components/TeacherAdminView';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import {
  KnowledgeUnit,
  RubricCriteria,
  SystemConfig,
  AssessmentResult
} from './types';
import {
  DEFAULT_KNOWLEDGE_UNITS,
  DEFAULT_RUBRIC_CRITERIA,
  DEFAULT_SYSTEM_CONFIG,
  INITIAL_SAMPLE_RESULTS
} from './data/defaults';

export default function App() {
  const [activeMainTab, setActiveMainTab] = useState<'student' | 'teacher'>('student');
  const [activeTeacherSubTab, setActiveTeacherSubTab] = useState<'results' | 'misconceptions' | 'settings'>('results');

  // Teacher Authentication State
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(false);
  const [teacherPassword, setTeacherPassword] = useState<string>(() => {
    return localStorage.getItem('teacherPassword') || 'bio1234';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [pendingTeacherSubTab, setPendingTeacherSubTab] = useState<'results' | 'misconceptions' | 'settings'>('results');

  // State loaded from backend or defaults
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [knowledgeUnits, setKnowledgeUnits] = useState<KnowledgeUnit[]>(DEFAULT_KNOWLEDGE_UNITS);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriteria[]>(DEFAULT_RUBRIC_CRITERIA);
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>(INITIAL_SAMPLE_RESULTS);

  // Load backend data
  const refreshResults = () => {
    fetch('/api/results')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAssessmentResults(data);
        }
      })
      .catch((err) => console.log('Using initial assessment results:', err));
  };

  useEffect(() => {
    // Fetch config
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((e) => console.log('Config fallback'));

    // Fetch knowledge units
    fetch('/api/knowledge-base')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setKnowledgeUnits(data);
      })
      .catch((e) => console.log('Knowledge base fallback'));

    // Fetch rubrics
    fetch('/api/rubrics')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setRubricCriteria(data);
      })
      .catch((e) => console.log('Rubrics fallback'));

    // Fetch results
    refreshResults();
  }, []);

  const handleNewAssessmentCreated = (newResult: AssessmentResult) => {
    setAssessmentResults((prev) => [newResult, ...prev]);
  };

  const handleRequestTeacherLogin = (subTab: 'results' | 'misconceptions' | 'settings' = 'results') => {
    if (isTeacherAuthenticated) {
      setActiveTeacherSubTab(subTab);
      setActiveMainTab('teacher');
    } else {
      setPendingTeacherSubTab(subTab);
      setIsLoginModalOpen(true);
    }
  };

  const handleLoginSuccess = () => {
    setIsTeacherAuthenticated(true);
    sessionStorage.setItem('isTeacherAuth', 'true');
    setIsLoginModalOpen(false);
    setActiveTeacherSubTab(pendingTeacherSubTab);
    setActiveMainTab('teacher');
  };

  const handleTeacherLogout = () => {
    setIsTeacherAuthenticated(false);
    sessionStorage.removeItem('isTeacherAuth');
    setActiveMainTab('student');
  };

  const handleUpdateTeacherPassword = (newPassword: string) => {
    setTeacherPassword(newPassword);
    localStorage.setItem('teacherPassword', newPassword);
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-900 font-sans overflow-hidden">
      {/* Dark Sidebar */}
      <Sidebar
        activeMainTab={activeMainTab}
        setActiveMainTab={(tab) => {
          if (tab === 'teacher' && !isTeacherAuthenticated) {
            handleRequestTeacherLogin('results');
          } else {
            setActiveMainTab(tab);
          }
        }}
        activeTeacherSubTab={activeTeacherSubTab}
        setActiveTeacherSubTab={setActiveTeacherSubTab}
        config={config}
        totalResultsCount={assessmentResults.length}
        totalKnowledgeUnitsCount={knowledgeUnits.length}
        isTeacherAuthenticated={isTeacherAuthenticated}
        onRequestTeacherLogin={handleRequestTeacherLogin}
      />

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#f4f6fb]">
        <HeaderBar
          activeMainTab={activeMainTab}
          config={config}
          isTeacherAuthenticated={isTeacherAuthenticated}
          onRequestTeacherLogin={handleRequestTeacherLogin}
          onTeacherLogout={handleTeacherLogout}
        />

        <main className="flex-1 pb-12">
          {activeMainTab === 'student' ? (
            <StudentSubmissionView
              knowledgeUnits={knowledgeUnits}
              config={config}
              onNewAssessmentCreated={handleNewAssessmentCreated}
            />
          ) : (
            <TeacherAdminView
              activeSubTab={activeTeacherSubTab}
              setActiveSubTab={setActiveTeacherSubTab}
              knowledgeUnits={knowledgeUnits}
              setKnowledgeUnits={setKnowledgeUnits}
              rubricCriteria={rubricCriteria}
              setRubricCriteria={setRubricCriteria}
              config={config}
              setConfig={setConfig}
              assessmentResults={assessmentResults}
              onRefreshResults={refreshResults}
              teacherPassword={teacherPassword}
              onUpdatePassword={handleUpdateTeacherPassword}
              isTeacherAuthenticated={isTeacherAuthenticated}
              onRequestTeacherLogin={handleRequestTeacherLogin}
            />
          )}
        </main>
      </div>

      {/* Teacher Admin Login Modal */}
      <TeacherLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        teacherPassword={teacherPassword}
      />
    </div>
  );
};
