import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  FileCheck,
  Brain,
  Settings,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Database,
  Table,
  Plus,
  Save,
  Sparkles,
  BookOpen,
  Users,
  Check,
  X,
  Printer,
  ExternalLink,
  ShieldCheck,
  Layers,
  Award,
  FileText,
  Dna,
  Key,
  Calendar
} from 'lucide-react';
import {
  AssessmentResult,
  KnowledgeUnit,
  RubricCriteria,
  SystemConfig,
  MisconceptionStat,
  RubricTypeItem
} from '../types';
import { getCombinedMisconceptions } from '../utils/misconceptionUtils';

interface TeacherAdminViewProps {
  activeSubTab: 'results' | 'misconceptions' | 'settings';
  setActiveSubTab: (tab: 'results' | 'misconceptions' | 'settings') => void;
  knowledgeUnits: KnowledgeUnit[];
  setKnowledgeUnits: React.Dispatch<React.SetStateAction<KnowledgeUnit[]>>;
  rubricCriteria: RubricCriteria[];
  setRubricCriteria: React.Dispatch<React.SetStateAction<RubricCriteria[]>>;
  config: SystemConfig;
  setConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  assessmentResults: AssessmentResult[];
  onRefreshResults: () => void;
  teacherPassword?: string;
  onUpdatePassword?: (newPassword: string) => void;
  isTeacherAuthenticated?: boolean;
  onRequestTeacherLogin?: () => void;
}

export const TeacherAdminView: React.FC<TeacherAdminViewProps> = ({
  activeSubTab,
  setActiveSubTab,
  knowledgeUnits,
  setKnowledgeUnits,
  rubricCriteria,
  setRubricCriteria,
  config,
  setConfig,
  assessmentResults,
  onRefreshResults,
  teacherPassword = 'bio1234',
  onUpdatePassword,
  isTeacherAuthenticated = false,
  onRequestTeacherLogin
}) => {
  // Filters State
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterTimeRange, setFilterTimeRange] = useState<string>('60DAYS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Password Settings State
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<boolean>(false);

  // Selected Student Modal Inspector State
  const [selectedResult, setSelectedResult] = useState<AssessmentResult | null>(null);
  const [teacherOverrideNotes, setTeacherOverrideNotes] = useState<string>('');
  const [teacherOverrideScore, setTeacherOverrideScore] = useState<number>(0);

  // If not authenticated, render Lock Prompt Screen
  if (!isTeacherAuthenticated) {
    return (
      <div className="p-6 sm:p-12 max-w-xl mx-auto my-12 bg-white border border-slate-200/80 rounded-3xl shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <Key className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900">老師管理中心（請登入解鎖）</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            此專區包含全班作業評分結果、迷思概念統計與系統知識庫管理。存取前請先輸入老師登入密碼。
          </p>
          <div className="pt-2">
            <span className="inline-block bg-slate-100 text-slate-700 text-xs font-mono px-3 py-1 rounded-lg border border-slate-200">
              預設登入密碼：<strong className="text-emerald-700 font-bold">{teacherPassword}</strong>
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => {
              if (onRequestTeacherLogin) onRequestTeacherLogin();
            }}
            className="w-full py-3.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>開啟密碼驗證視窗</span>
          </button>
        </div>
      </div>
    );
  }
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Misconceptions Analytics State
  const [misconceptionStats, setMisconceptionStats] = useState<MisconceptionStat[]>([]);
  const [generatedRemedialPlan, setGeneratedRemedialPlan] = useState<string>('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Settings / RAG Editing State
  const [editingUnit, setEditingUnit] = useState<KnowledgeUnit | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [newClassInput, setNewClassInput] = useState<string>('');

  // Dynamic Rubric Assignment Types & Content State
  const [rubricTypes, setRubricTypes] = useState<RubricTypeItem[]>(() => {
    const saved = localStorage.getItem('rubricTypes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse rubricTypes from localStorage', e);
      }
    }
    return [
      {
        id: 'conceptMap',
        title: '規準一：概念構圖 (預設)',
        text: `1.知識正確性與邏輯正確性  (最高50分.每個錯誤扣2分)
   (1)內容完整度: 以完全涵蓋內容百分比給分
   (2)科學正確性：連接詞所表達的邏輯是否符合學術事實？ （例如：肺循環「導致」氧氣增加 vs 肺循環「包含」氧氣增加）。
   (3)概念密度：核心概念周圍的連接數量。密度越高，代表學生對該核心概念的理解越豐富。
   (4)迷思概念偵測：檢查構圖中是否存在錯誤的邏輯路徑，這通常是教學論文中「補救教學」的重要指標。
2.有效命題 (Propositions)-連接詞   ( 每個1分. 最高15分)
    兩個概念之間是否由連接詞構成有意義、正確的陳述。重複性命題最多計分數量5分
3.階層層級 (Hierarchy) (每個3分. 最高15分)
    構圖是否由廣泛到具體呈現。最高層級向下延伸的層數。知識與邏輯正確性為其必要條件
4. 交叉連結 (Cross-links) (每個5分. 最高10分)
    顯示不同分支概念間的整合關係，這代表高層次認知與知識統整。知識與邏輯正確性為其必要條件
5.實例 (Examples) (每個1分. 最高10分)
  代表該概念的具體例子（通常不加圈）。知識與邏輯正確性為其必要條件`
      },
      {
        id: 'report',
        title: '規準二：報告 (探究與實驗報告)',
        text: `規準二：探究與實驗報告評分規準 (適用於所有單元)\n1. 探究主題與假設擬定 (20%)：明確陳述探究問題，提出可檢驗的科學假設與變因對照。\n2. 實驗設計與控制變因邏輯 (30%)：正確區分操作變因、控制變因與應變變因，步驟規劃嚴謹合理。\n3. 數據記錄與圖表分析 (25%)：數據表格記錄詳實精確，能將數據繪製為圖表並精準分析變化趨勢。\n4. 實驗結論推論與反思討論 (25%)：結論符合實驗數據實證，能對照假設進行科學論證並提出可能誤差反思。`
      }
    ];
  });

  const [selectedAssignmentTypeId, setSelectedAssignmentTypeId] = useState<string>(() => {
    return localStorage.getItem('primaryRubricTypeId') || localStorage.getItem('primaryRubricType') || 'conceptMap';
  });

  // Modal states for adding/editing rubric types
  const [isAddRubricTypeModal, setIsAddRubricTypeModal] = useState<boolean>(false);
  const [newTypeTitle, setNewTypeTitle] = useState<string>('');
  const [newTypeText, setNewTypeText] = useState<string>('');

  const [isEditTypeNameModal, setIsEditTypeNameModal] = useState<boolean>(false);
  const [editTypeTitleInput, setEditTypeTitleInput] = useState<string>('');

  const [isEditingRubricModal, setIsEditingRubricModal] = useState<boolean>(false);
  const [tempRubricText, setTempRubricText] = useState<string>('');
  const [rubricSaveSuccessMessage, setRubricSaveSuccessMessage] = useState<string>('');

  // Active rubric item
  const activeRubricItem = rubricTypes.find((r) => r.id === selectedAssignmentTypeId) || rubricTypes[0] || {
    id: 'conceptMap',
    title: '規準一：概念構圖 (預設)',
    text: ''
  };

  // Fetch Server Rubric Settings on mount
  useEffect(() => {
    fetch('/api/rubric')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.rubricTypes) && data.rubricTypes.length > 0) {
          setRubricTypes(data.rubricTypes);
          localStorage.setItem('rubricTypes', JSON.stringify(data.rubricTypes));
        }
        if (data.primaryTypeId) {
          setSelectedAssignmentTypeId(data.primaryTypeId);
          localStorage.setItem('primaryRubricTypeId', data.primaryTypeId);
        }
      })
      .catch((err) => console.error('Error fetching rubric settings:', err));
  }, []);

  // Save Rubric Settings to localStorage and Server
  const handleSaveRubricSettings = async (
    updatedTypes?: RubricTypeItem[],
    targetTypeId?: string
  ) => {
    const typesToSave = updatedTypes || rubricTypes;
    const activeTypeId = targetTypeId || selectedAssignmentTypeId;

    setRubricTypes(typesToSave);
    setSelectedAssignmentTypeId(activeTypeId);

    localStorage.setItem('rubricTypes', JSON.stringify(typesToSave));
    localStorage.setItem('primaryRubricTypeId', activeTypeId);
    localStorage.setItem('primaryRubricType', activeTypeId);

    try {
      await fetch('/api/rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryTypeId: activeTypeId,
          rubricTypes: typesToSave
        })
      });
    } catch (err) {
      console.error('Error syncing rubric to server:', err);
    }

    const item = typesToSave.find((t) => t.id === activeTypeId);
    const typeTitle = item ? item.title : '指定作業類型';
    setRubricSaveSuccessMessage(`✓ 已將【${typeTitle}】設為學生作業最主要評分規準！`);
    setTimeout(() => setRubricSaveSuccessMessage(''), 4000);
  };

  // Handler: Add New Rubric Type
  const handleCreateRubricType = () => {
    if (!newTypeTitle.trim()) return;
    const newId = 'rubric_' + Date.now();
    const createdTypeItem: RubricTypeItem = {
      id: newId,
      title: newTypeTitle.trim(),
      text: newTypeText.trim() || `【${newTypeTitle.trim()}】評分規準 (適用於所有單元)\n1. 項次一評分重點 (40%)\n2. 項次二評分重點 (30%)\n3. 項次三評分重點 (30%)`
    };
    const newTypes = [...rubricTypes, createdTypeItem];
    setRubricTypes(newTypes);
    setSelectedAssignmentTypeId(newId);
    handleSaveRubricSettings(newTypes, newId);

    setIsAddRubricTypeModal(false);
    setNewTypeTitle('');
    setNewTypeText('');
  };

  // Handler: Edit Rubric Type Name
  const handleUpdateTypeName = () => {
    if (!editTypeTitleInput.trim()) return;
    const updatedTypes = rubricTypes.map((r) =>
      r.id === selectedAssignmentTypeId ? { ...r, title: editTypeTitleInput.trim() } : r
    );
    setRubricTypes(updatedTypes);
    handleSaveRubricSettings(updatedTypes, selectedAssignmentTypeId);
    setIsEditTypeNameModal(false);
  };

  // Handler: Delete Rubric Type
  const handleDeleteRubricType = (typeId: string) => {
    if (rubricTypes.length <= 1) {
      alert('至少需保留一項評分規準類型！');
      return;
    }
    const targetItem = rubricTypes.find((r) => r.id === typeId);
    if (!confirm(`確定要刪除規準類型【${targetItem?.title || typeId}】嗎？`)) return;

    const remainingTypes = rubricTypes.filter((r) => r.id !== typeId);
    const nextSelectedId = remainingTypes[0].id;
    setRubricTypes(remainingTypes);
    setSelectedAssignmentTypeId(nextSelectedId);
    handleSaveRubricSettings(remainingTypes, nextSelectedId);
  };

  // Fetch Misconception Stats
  useEffect(() => {
    fetch('/api/misconceptions/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.misconceptionStats) {
          setMisconceptionStats(data.misconceptionStats);
        }
      })
      .catch((err) => console.error('Error loading stats:', err));
  }, [assessmentResults]);

  // Check if date string matches selected time range (Web Teacher Admin displays up to 60 days)
  const isWithinTimeRange = (submittedAtStr: string, range: string) => {
    const date = new Date(submittedAtStr);
    if (isNaN(date.getTime())) return true;
    const now = new Date();

    // Mandatory Web Teacher Admin limit: Web only displays results within last 60 days
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    if (date < sixtyDaysAgo) {
      return false; // Web only displays results within 60 days
    }

    if (range === 'TODAY') {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    }
    if (range === 'WEEK') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    }
    if (range === 'MONTH') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= monthAgo;
    }
    if (range === '60DAYS' || range === 'ALL') {
      return date >= sixtyDaysAgo;
    }
    return true;
  };

  // Filter Results
  const filteredResults = assessmentResults.filter((r) => {
    if (filterClass !== 'ALL' && r.className !== filterClass) return false;
    if (filterUnit !== 'ALL' && r.unitId !== filterUnit) return false;
    if (!isWithinTimeRange(r.submittedAt, filterTimeRange)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.seatNo.includes(q) ||
        r.unitTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Export Results to Excel (.xlsx) File
  const handleExportExcel = () => {
    const exportData = filteredResults.map((r) => {
      const combined = getCombinedMisconceptions(r);
      return {
        '學生姓名': r.studentName,
        '班級': `${r.className} 班`,
        '座號': `${r.seatNo} 號`,
        '評改單元': r.unitTitle,
        '繳交時間': r.submittedAt,
        'AI 總分': r.totalScore,
        '評定等級': r.gradeLevel,
        '迷思與邏輯錯誤數量': combined.length,
        '迷思與邏輯錯誤項目': combined.length > 0 ? combined.map((m) => `[${m.code}] ${m.conceptTitle}`).join('; ') : '無迷思概念',
        '綜合評語': r.summaryFeedback
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 12 }, // 學生姓名
      { wch: 10 }, // 班級
      { wch: 10 }, // 座號
      { wch: 32 }, // 評改單元
      { wch: 20 }, // 繳交時間
      { wch: 10 }, // AI 總分
      { wch: 12 }, // 評定等級
      { wch: 14 }, // 迷思概念數量
      { wch: 45 }, // 迷思概念項目
      { wch: 55 }, // 綜合評語
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '學生評改總覽');

    const dateTag = new Date().toISOString().slice(0, 10);
    const fileName = `自然科AI評改紀錄表_${filterClass !== 'ALL' ? filterClass + '班_' : ''}${dateTag}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Trigger Google Sheets Sync API
  const handleSyncGoogleSheets = async () => {
    setIsSyncingSheets(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds: filteredResults.map((r) => r.id) })
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`✓ 已成功將 ${data.syncedCount} 筆評改數據按班級同步寫入 Google Sheet (試算表 ID: ${data.sheetId.slice(0, 10)}...)`);
        onRefreshResults();
      }
    } catch (err) {
      setSyncMessage('同步至 Google Sheets 時發生網路傳輸錯誤');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Save Teacher Override Score / Notes
  const handleSaveTeacherOverride = async () => {
    if (!selectedResult) return;
    try {
      const res = await fetch(`/api/results/${selectedResult.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalScore: teacherOverrideScore,
          teacherNotes: teacherOverrideNotes
        })
      });
      if (res.ok) {
        onRefreshResults();
        setSelectedResult((prev) => (prev ? { ...prev, totalScore: teacherOverrideScore, teacherNotes: teacherOverrideNotes, teacherOverridden: true } : null));
      }
    } catch (e) {
      console.error('Error overriding result:', e);
    }
  };

  // Delete Result Record
  const handleDeleteResult = async (id: string) => {
    if (!window.confirm('確定要刪除此筆學生評改紀錄嗎？')) return;
    try {
      await fetch(`/api/results/${id}`, { method: 'DELETE' });
      onRefreshResults();
      if (selectedResult?.id === id) setSelectedResult(null);
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Filtered assessment results for Misconception Analysis (by Class, Unit, Time Range)
  const resultsFilteredForMisconceptions = React.useMemo(() => {
    return assessmentResults.filter((r) => {
      if (filterClass !== 'ALL' && r.className !== filterClass) return false;
      if (filterUnit !== 'ALL' && r.unitId !== filterUnit) return false;
      if (!isWithinTimeRange(r.submittedAt, filterTimeRange)) return false;
      return true;
    });
  }, [assessmentResults, filterClass, filterUnit, filterTimeRange]);

  // Dynamic Misconception Stats aggregated based on selected Class, Unit, Time filters
  const activeMisconceptionStats = React.useMemo(() => {
    if (!resultsFilteredForMisconceptions || resultsFilteredForMisconceptions.length === 0) {
      return [];
    }

    const map = new Map<
      string,
      {
        unitId: string;
        misconceptionCode: string;
        misconceptionTitle: string;
        unitTitle: string;
        count: number;
        affectedStudentsMap: Map<string, { name: string; className: string; seatNo: string }>;
        suggestedTeachingStrategy: string;
      }
    >();

    resultsFilteredForMisconceptions.forEach((r) => {
      const combined = getCombinedMisconceptions(r);
      if (combined && combined.length > 0) {
        combined.forEach((m) => {
          const key = `${r.unitId}:${m.code || 'MISC'}:${m.conceptTitle || ''}`;
          if (!map.has(key)) {
            map.set(key, {
              unitId: r.unitId,
              misconceptionCode: m.code || 'MISC-01',
              misconceptionTitle: m.conceptTitle || '迷思概念 / 邏輯錯誤',
              unitTitle: r.unitTitle,
              count: 0,
              affectedStudentsMap: new Map(),
              suggestedTeachingStrategy: m.remedialHint || '對照課本圖表與 RAG 知識庫，進行概念澄清教學與關鍵實驗對比。'
            });
          }
          const entry = map.get(key)!;
          const studentKey = `${r.studentName}_${r.className}_${r.seatNo}`;
          if (!entry.affectedStudentsMap.has(studentKey)) {
            entry.count += 1;
            entry.affectedStudentsMap.set(studentKey, {
              name: r.studentName,
              className: r.className,
              seatNo: r.seatNo || '01'
            });
          }
        });
      }
    });

    if (map.size === 0) {
      return [];
    }

    const result: MisconceptionStat[] = [];
    const totalCount = resultsFilteredForMisconceptions.length;

    map.forEach((val) => {
      const affectedStudents = Array.from(val.affectedStudentsMap.values());
      result.push({
        unitId: val.unitId,
        misconceptionCode: val.misconceptionCode,
        misconceptionTitle: val.misconceptionTitle,
        unitTitle: val.unitTitle,
        count: val.count,
        percentage: Math.round((affectedStudents.length / totalCount) * 100),
        affectedStudents,
        suggestedTeachingStrategy: val.suggestedTeachingStrategy
      });
    });

    result.sort((a, b) => b.count - a.count);
    return result;
  }, [resultsFilteredForMisconceptions]);

  // Generate Differentiated Remedial Worksheet & Teaching Plan with AI
  const handleGenerateRemedialPlan = () => {
    setIsGeneratingPlan(true);
    setTimeout(() => {
      const classNameLabel = filterClass === 'ALL' ? '全體班級' : `${filterClass} 班`;
      const unitItem = knowledgeUnits.find((u) => u.id === filterUnit);
      const unitNameLabel = filterUnit === 'ALL' ? '全部評改單元' : (unitItem?.title || filterUnit);
      const timeRangeLabel =
        filterTimeRange === 'ALL'
          ? '全部時間區間'
          : filterTimeRange === 'TODAY'
          ? '今天 (Today)'
          : filterTimeRange === 'WEEK'
          ? '近 7 天 (Last 7 Days)'
          : filterTimeRange === 'MONTH'
          ? '近 30 天 (Last 30 Days)'
          : '本學期 (This Semester)';

      if (!resultsFilteredForMisconceptions || resultsFilteredForMisconceptions.length === 0) {
        const planText = `
=== 國中自然科（生物）班級差異化分組教學與補救學習方案 ===
【篩選分析條件】:
  • 指定班級: ${classNameLabel}
  • 評改單元: ${unitNameLabel}
  • 時間區間: ${timeRangeLabel}

【歸納分析結果】:
無作答紀錄可進行分析
`.trim();
        setGeneratedRemedialPlan(planText);
        setIsGeneratingPlan(false);
        return;
      }

      const topMisconceptions = activeMisconceptionStats.slice(0, 3);

      // Categorize students in resultsFilteredForMisconceptions into tiers
      const levelA = resultsFilteredForMisconceptions.filter((r) => r.totalScore >= 90);
      const levelB = resultsFilteredForMisconceptions.filter((r) => r.totalScore >= 75 && r.totalScore < 90);
      const levelCD = resultsFilteredForMisconceptions.filter((r) => r.totalScore < 75);

      const levelANames = levelA.map((s) => `${s.studentName}(${s.className}班)`).join('、') || '無';
      const levelBNames = levelB.map((s) => `${s.studentName}(${s.className}班)`).join('、') || '無';
      const levelCDNames = levelCD.map((s) => `${s.studentName}(${s.className}班)`).join('、') || '無';

      const planText = `
=== 國中自然科（生物）班級差異化分組教學與補救學習方案 ===
【篩選分析條件】:
  • 指定班級: ${classNameLabel}
  • 評改單元: ${unitNameLabel}
  • 時間區間: ${timeRangeLabel}
  • 統計範疇: 共納入 ${resultsFilteredForMisconceptions.length} 筆學生作答紀錄進行深度歸納分析

一、 歸納高頻迷思概念排行榜 (依選定條件):
${
  topMisconceptions.length > 0
    ? topMisconceptions
        .map(
          (m, i) =>
            `${i + 1}. [${m.misconceptionCode}] ${m.misconceptionTitle}\n   - 出現率: ${m.percentage}% (${m.affectedStudents.length} 人)\n   - 涉及學生: ${m.affectedStudents.map((s) => `${s.name}(${s.className}班)`).join('、')}\n   - 觀念補救策略: ${m.suggestedTeachingStrategy}`
        )
        .join('\n')
    : '  (目前選定範圍內尚無偵測到高頻迷思概念)'
}

二、 班級學生能力差異化分組與教學策略 (共 ${resultsFilteredForMisconceptions.length} 人):
1. 💡 高熟練組 (A 級，分數 ≥ 90 分，共 ${levelA.length} 人):
   - 學生名單: ${levelANames}
   - 學習任務: 擔任同儕小組科學小導師，執行「洋蔥鱗片葉與水蘊草顯微鏡對照實驗」高階探究設計。
   - 延伸思考題: 為何洋蔥鱗片葉表皮細胞沒有葉綠體，而水蘊草葉片細胞卻含有大量葉綠體？

2. 📘 成長精進組 (B 級，分數 75-89 分，共 ${levelB.length} 人):
   - 學生名單: ${levelBNames}
   - 學習任務: 對照 RAG 專家概念圖，完成「細胞膜（門衛）與細胞壁（城牆）」功能差異對比表。
   - 觀念澄清重點: 強化選擇性通透與物理支持的觀念差異。

3. 🛠️ 觀念補救組 (C/D 級，分數 < 75 分，共 ${levelCD.length} 人):
   - 學生名單: ${levelCDNames}
   - 學習任務: 觀看「高倍鏡光線變化與物鏡切換」與「純水滲透壓植物細胞膨壓」動畫演示。
   - 專題練習: 完成圖卡排序學習單，重新釐清顯微鏡調光步驟與植物細胞不脹破原因。

三、 下一堂課建議教學澄清與實力測驗策略:
• 實做對照: 將浸泡濃鹽水萎縮的紅血球與植物細胞於顯微鏡下進行實測對照。
• 隨堂測驗: 針對高頻迷思 [${topMisconceptions[0]?.misconceptionCode || '重點迷思'}] 進行 5 分鐘觀念澄清 Kahoot 快問快答。
`.trim();

      setGeneratedRemedialPlan(planText);
      setIsGeneratingPlan(false);
    }, 1200);
  };

  // Add New Class Tag
  const handleAddClassTag = () => {
    if (newClassInput.trim() && !config.classes.includes(newClassInput.trim())) {
      const updatedClasses = [...config.classes, newClassInput.trim()];
      setConfig({ ...config, classes: updatedClasses });
      setNewClassInput('');
    }
  };

  // Remove Class Tag
  const handleRemoveClassTag = (cName: string) => {
    const updated = config.classes.filter((c) => c !== cName);
    setConfig({ ...config, classes: updated });
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Sub-tab Pills Switcher Bar matching screenshot 2 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="bg-[#f1f5f9] p-1.5 rounded-2xl flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('results')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'results'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-4 h-4 text-[#10b981]" />
            <span>評改結果總覽 ({assessmentResults.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('misconceptions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'misconceptions'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Brain className="w-4 h-4 text-amber-500" />
            <span>迷思概念分析</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'settings'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 text-indigo-600" />
            <span>系統設定與 RAG 知識庫</span>
          </button>
        </div>

        {/* Quick Sync Button */}
        <button
          onClick={handleSyncGoogleSheets}
          disabled={isSyncingSheets}
          className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
          <span>同步至 Google Sheets</span>
        </button>
      </div>

      {/* Sync Alert */}
      {syncMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
            <span className="font-medium">{syncMessage}</span>
          </div>
          <button onClick={() => setSyncMessage('')} className="text-slate-400 hover:text-slate-700 font-bold text-xs">
            關閉
          </button>
        </div>
      )}

      {/* SUB-TAB 1: 評改結果 (Results Table) */}
      {activeSubTab === 'results' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search input */}
                <div className="relative w-60">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜尋學生姓名 / 座號..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-200/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981]"
                  />
                </div>

                {/* Class Filter */}
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="bg-[#f8fafc] border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none font-medium"
                >
                  <option value="ALL">所有班級</option>
                  {config.classes.map((c) => (
                    <option key={c} value={c}>
                      {c} 班
                    </option>
                  ))}
                </select>

                {/* Unit Filter */}
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="bg-[#f8fafc] border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none font-medium max-w-xs truncate"
                >
                  <option value="ALL">所有評改單元</option>
                  {knowledgeUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>

                {/* Time Range Filter */}
                <div className="flex items-center gap-1.5 bg-[#f8fafc] border border-slate-200/80 rounded-xl px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={filterTimeRange}
                    onChange={(e) => setFilterTimeRange(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 focus:outline-none font-medium py-1"
                  >
                    <option value="60DAYS">近 60 天內 (Web 顯示預設與上限)</option>
                    <option value="TODAY">今天 (Today)</option>
                    <option value="WEEK">近 7 天 (Last 7 Days)</option>
                    <option value="MONTH">近 30 天 (Last 30 Days)</option>
                    <option value="ALL">全部 (Web 顯示上限 60 天)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>匯出 Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Retention Policy Banner */}
          <div className="px-4 py-2.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-center justify-between text-xs text-blue-900 font-medium">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                資料保存規範
              </span>
              <span>Web 老師管理中心僅顯示最近 <strong>60 天</strong> 內之評改結果；Firebase 雲端資料庫保持保存最近 <strong>360 天 (1年)</strong> 內之評改紀錄。</span>
            </div>
            <span className="text-[11px] text-blue-700 font-mono font-bold shrink-0">
              Web: 60 天 / Firebase: 360 天
            </span>
          </div>

          {/* Results Table Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] text-slate-600 border-b border-slate-200 font-bold">
                    <th className="p-3.5">繳交時間</th>
                    <th className="p-3.5">學生姓名</th>
                    <th className="p-3.5">班級 / 座號</th>
                    <th className="p-3.5">評改單元</th>
                    <th className="p-3.5 text-center">AI 總分</th>
                    <th className="p-3.5 text-center">評定等級</th>
                    <th className="p-3.5 text-center">迷思概念</th>
                    <th className="p-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        查無符合條件的學生評改資料
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap">{r.submittedAt}</td>
                        <td className="p-3.5 font-bold text-slate-900">{r.studentName}</td>
                        <td className="p-3.5 text-slate-600 font-medium">{r.className} 班 ({r.seatNo}號)</td>
                        <td className="p-3.5 font-medium text-slate-800 max-w-xs truncate">{r.unitTitle}</td>
                        <td className="p-3.5 text-center font-mono font-black text-[#10b981] text-sm">
                          {r.totalScore}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#10b981] border border-emerald-200">
                            {r.gradeLevel}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {(() => {
                            const combined = getCombinedMisconceptions(r);
                            return combined.length > 0 ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                                {combined.length} 項
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">無迷思</span>
                            );
                          })()}
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedResult(r);
                              setTeacherOverrideScore(r.totalScore);
                              setTeacherOverrideNotes(r.teacherNotes || '');
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#10b981]" />
                            <span>檢視詳情</span>
                          </button>

                          <button
                            onClick={() => handleDeleteResult(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: 迷思概念分析 (Misconception Analytics Dashboard) */}
      {activeSubTab === 'misconceptions' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200/80 p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-xs tracking-wider uppercase">
                <Brain className="w-4 h-4" />
                <span>國中自然科 迷思概念診斷與差異化教學</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">班級高頻迷思分析與 AI 輔導策略</h3>
              <p className="text-slate-500 text-xs">
                依據選定的班級、單元與時間區間，即時歸納分析科學迷思，並一鍵生成個別班級的差異化分組學習方案。
              </p>
            </div>

            <button
              onClick={handleGenerateRemedialPlan}
              disabled={isGeneratingPlan}
              className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-2 shrink-0 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGeneratingPlan ? '生成差異化方案中...' : '一鍵生成班級差異化分組方案'}</span>
            </button>
          </div>

          {/* 3 Functional Filter Buttons Toolbar for Misconceptions */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <Filter className="w-4 h-4 text-[#10b981]" />
                <span>迷思概念歸納條件選擇 (連動分組方案)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  符合條件之作答紀錄: <strong className="text-[#10b981] font-bold">{resultsFilteredForMisconceptions.length}</strong> 筆
                </span>
                {(filterClass !== 'ALL' || filterUnit !== 'ALL' || filterTimeRange !== 'ALL') && (
                  <button
                    onClick={() => {
                      setFilterClass('ALL');
                      setFilterUnit('ALL');
                      setFilterTimeRange('ALL');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                  >
                    重置篩選
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Button 1: 班級 (Class) */}
              <div className="flex items-center gap-2.5 bg-[#f8fafc] border border-slate-200/90 rounded-2xl p-3 hover:border-[#10b981] transition-all">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#10b981] flex items-center justify-center shrink-0 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    1. 班級選擇
                  </label>
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="w-full bg-transparent font-bold text-xs text-slate-800 focus:outline-none cursor-pointer truncate"
                  >
                    <option value="ALL">全部班級 (ALL)</option>
                    {config.classes.map((c) => (
                      <option key={c} value={c}>
                        {c} 班
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Button 2: 單元 (Unit) */}
              <div className="flex items-center gap-2.5 bg-[#f8fafc] border border-slate-200/90 rounded-2xl p-3 hover:border-[#10b981] transition-all">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    2. 單元選擇
                  </label>
                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                    className="w-full bg-transparent font-bold text-xs text-slate-800 focus:outline-none cursor-pointer truncate"
                  >
                    <option value="ALL">全部單元 (ALL)</option>
                    {knowledgeUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Button 3: 時間 (Time) */}
              <div className="flex items-center gap-2.5 bg-[#f8fafc] border border-slate-200/90 rounded-2xl p-3 hover:border-[#10b981] transition-all">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    3. 時間區間
                  </label>
                  <select
                    value={filterTimeRange}
                    onChange={(e) => setFilterTimeRange(e.target.value)}
                    className="w-full bg-transparent font-bold text-xs text-slate-800 focus:outline-none cursor-pointer truncate"
                  >
                    <option value="60DAYS">近 60 天內 (Web 顯示預設與上限)</option>
                    <option value="TODAY">今天 (Today)</option>
                    <option value="WEEK">近 7 天 (Last 7 Days)</option>
                    <option value="MONTH">近 30 天 (Last 30 Days)</option>
                    <option value="ALL">全部 (Web 顯示上限 60 天)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Misconception Frequency Cards Grid */}
          {resultsFilteredForMisconceptions.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-8 text-center space-y-2">
              <Brain className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800">無作答紀錄可進行分析</p>
              <p className="text-xs text-slate-400">
                在目前選定的【{filterClass === 'ALL' ? '全部班級' : filterClass + ' 班'} / {filterUnit === 'ALL' ? '全部單元' : (knowledgeUnits.find(u => u.id === filterUnit)?.title || filterUnit)} / {filterTimeRange === 'ALL' ? '全部時間' : filterTimeRange}】條件下尚無學生評改紀錄，請切換選單條件。
              </p>
            </div>
          ) : activeMisconceptionStats.length === 0 ? (
            <div className="bg-white border border-emerald-200 border-dashed rounded-3xl p-8 text-center space-y-2 bg-emerald-50/20">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800">在此篩選條件下，無記錄到任何學生迷思概念</p>
              <p className="text-xs text-slate-500">代表選定範疇內的學生科學概念掌握度極高！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMisconceptionStats.map((st, i) => (
                <div key={i} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-50 text-amber-800 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                        {st.misconceptionCode}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{st.unitTitle}</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      出現率 {st.percentage}% ({st.count} 人)
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900">{st.misconceptionTitle}</h4>

                  {/* Affected Students list */}
                  <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-200/80 text-xs space-y-1">
                    <span className="text-slate-500 text-[11px] font-bold block">涉及學生:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {st.affectedStudents.map((s, idx) => (
                        <span
                          key={idx}
                          className="bg-white text-slate-700 px-2.5 py-0.5 rounded-lg text-[11px] font-medium border border-slate-200 shadow-2xs"
                        >
                          {s.name} ({s.className}班)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Remedial hint / strategy */}
                  <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                    <span className="font-bold block text-emerald-800 mb-0.5">觀念釐清引導策略:</span>
                    <p>{st.suggestedTeachingStrategy}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Generated Remedial Plan Box */}
          {generatedRemedialPlan && (
            <div className="bg-white border border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>AI 產出之班級差異化分組與補救學習方案</span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedRemedialPlan)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  複製文字方案
                </button>
              </div>

              <div className="bg-[#f8fafc] p-4 rounded-2xl border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {generatedRemedialPlan}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: 系統設定與 RAG Store */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          {/* Main 2-column layout matching screenshot */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT CARD: 評分規準 (Rubrics) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-800" />
                    <h3 className="text-base font-bold text-slate-900">評分規準 (Rubrics) 管理</h3>
                  </div>
                  <button
                    onClick={() => {
                      setNewTypeTitle('');
                      setNewTypeText('');
                      setIsAddRubricTypeModal(true);
                    }}
                    className="text-white bg-[#10b981] hover:bg-[#059669] font-bold text-xs flex items-center gap-1 transition-all px-3 py-1.5 rounded-xl shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增規準類型</span>
                  </button>
                </div>

                {/* Assignment Type Selector & Management Actions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      選擇要檢視／評分的作業類型：
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditTypeTitleInput(activeRubricItem.title);
                          setIsEditTypeNameModal(true);
                        }}
                        className="text-slate-700 hover:text-[#10b981] bg-slate-100 hover:bg-emerald-50 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors border border-slate-200/80"
                        title="編輯目前選取的類型名稱"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>編輯名稱</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRubricType(selectedAssignmentTypeId)}
                        disabled={rubricTypes.length <= 1}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors border ${
                          rubricTypes.length <= 1
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200/80 cursor-pointer'
                        }`}
                        title={rubricTypes.length <= 1 ? '至少需保留一種規準類型' : '刪除此規準類型'}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>刪除</span>
                      </button>
                    </div>
                  </div>

                  <select
                    value={selectedAssignmentTypeId}
                    onChange={(e) => {
                      const newTypeId = e.target.value;
                      setSelectedAssignmentTypeId(newTypeId);
                    }}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] transition-all cursor-pointer shadow-2xs"
                  >
                    {rubricTypes.map((typeItem) => (
                      <option key={typeItem.id} value={typeItem.id}>
                        {typeItem.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rubric Content Box linked to Dropdown */}
                <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="truncate max-w-[220px]">
                        【{activeRubricItem.title}】評改細項內文
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setTempRubricText(activeRubricItem.text);
                        setIsEditingRubricModal(true);
                      }}
                      className="text-[#10b981] hover:text-[#059669] font-bold text-[11px] flex items-center gap-1 transition-colors px-2.5 py-1 bg-white hover:bg-emerald-50 rounded-lg border border-emerald-200/80 shadow-2xs"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>編輯內文</span>
                    </button>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-700 font-mono leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap shadow-2xs">
                    {activeRubricItem.text}
                  </div>
                </div>

                {/* Save Button & Status */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSaveRubricSettings()}
                    className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>儲存評分規準設定（設為學生作業主要評分規準）</span>
                  </button>

                  {rubricSaveSuccessMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{rubricSaveSuccessMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Yellow Warning Alert Banner */}
              <div className="bg-amber-50/90 border border-amber-200/90 text-amber-900 rounded-2xl p-3.5 text-xs flex items-start gap-2.5 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">
                  儲存後會作為學生繳交作業的最主要評分規準，AI 將【優先嚴格對照】所選規準指標進行細項評改與核算配分。
                </span>
              </div>
            </div>

            {/* RIGHT CARD: 教師知識庫與專家概念構圖管理 (RAG Store) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
              {/* Header */}
              <div className="border-b border-slate-100 pb-3 space-y-1">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Dna className="w-5 h-5 text-teal-600" />
                  <span>教師知識庫與專家概念構圖管理 (RAG Store)</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  管理國中生物課綱內文，隨時修改預設內文、增減主題，或利用 AI 自動擴充概念節點。
                </p>
              </div>

              {/* Unit Cards List */}
              <div className="space-y-4">
                {knowledgeUnits.map((unit) => {
                  const misconceptionCount = unit.commonMisconceptions?.length || 0;
                  const quizCount = unit.quizQuestions?.length || 0;
                  const isExpanded = expandedUnitId === unit.id;

                  return (
                    <div
                      key={unit.id}
                      className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-4 sm:p-5 text-xs space-y-3 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold bg-white text-slate-700 px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                            國中生物 7年級上冊
                          </span>
                          {misconceptionCount > 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                              {misconceptionCount} 個常見迷思
                            </span>
                          )}
                          {quizCount > 0 && (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                              {quizCount} 題對應測驗
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                            className="text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1 transition-colors bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs"
                          >
                            <span>{isExpanded ? '收合詳情' : '展開檢視迷思與測驗'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUnit(unit)}
                            className="text-[#10b981] hover:text-[#059669] font-bold text-xs flex items-center gap-1 transition-colors bg-white hover:bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>編輯內文/主題</span>
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{unit.title}</h4>

                      <p className="text-slate-600 leading-relaxed line-clamp-3">
                        {unit.description}
                      </p>

                      {/* Expandable Section for Misconceptions & Quiz Questions */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-200/80 space-y-4 animate-fadeIn">
                          {/* Common Misconceptions List */}
                          {unit.commonMisconceptions && unit.commonMisconceptions.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span>常見迷思概念與正確觀念（共 {unit.commonMisconceptions.length} 項）</span>
                              </h5>
                              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {unit.commonMisconceptions.map((m, idx) => (
                                  <div key={m.id || idx} className="p-3 bg-white border border-amber-200/70 rounded-xl space-y-1 text-xs">
                                    <div className="font-bold text-rose-700 flex items-start gap-1">
                                      <span className="shrink-0">✕</span>
                                      <span>{m.concept}</span>
                                    </div>
                                    <div className="text-emerald-800 font-medium pl-4 border-l-2 border-emerald-500 text-[11px] leading-relaxed">
                                      {m.correction}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Quiz Questions List */}
                          {unit.quizQuestions && unit.quizQuestions.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                                <FileCheck className="w-4 h-4 text-indigo-500" />
                                <span>單元對應測驗題庫（共 {unit.quizQuestions.length} 題單選題）</span>
                              </h5>
                              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {unit.quizQuestions.map((q, idx) => (
                                  <div key={q.id || idx} className="p-3 bg-white border border-indigo-100 rounded-xl space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-indigo-900">
                                        題 {idx + 1} ({q.targetMisconception || '迷思題型'})
                                      </span>
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                        標準答案：{q.correctAnswer}
                                      </span>
                                    </div>
                                    <p className="font-medium text-slate-800 leading-snug">{q.question}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600 pl-2">
                                      {q.options.map((opt, oIdx) => (
                                        <div key={oIdx} className={opt.startsWith(q.correctAnswer) ? 'font-bold text-emerald-700' : ''}>
                                          {opt}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 leading-relaxed">
                                      <strong>【解析】</strong> {q.explanation}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                        <span className="text-slate-500 font-medium">
                          包含 {unit.knowledgePointsCount || 12} 個專家概念節點 / {unit.conceptMapLinks || 14} 條連結
                        </span>
                        <span className="text-[#10b981] font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          已在畫布中開啟
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Class Tags Management */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users className="w-4 h-4 text-[#10b981]" />
              <span>授課班級標籤管理</span>
            </h3>

            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                placeholder="新增班級 (例如: 803)"
                value={newClassInput}
                onChange={(e) => setNewClassInput(e.target.value)}
                className="bg-[#f8fafc] border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981]"
              />
              <button
                onClick={handleAddClassTag}
                className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                新增班級
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {config.classes.map((c) => (
                <span
                  key={c}
                  className="bg-[#f8fafc] text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200/80 flex items-center gap-2"
                >
                  <span>{c} 班</span>
                  <button
                    onClick={() => handleRemoveClassTag(c)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Section 3: Teacher Admin Password Settings */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key className="w-4 h-4 text-[#10b981]" />
              <span>老師管理中心登入密碼設定</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-2">
                <p className="text-xs text-slate-600 leading-relaxed">
                  存取「老師管理中心」時所需的登入密碼。預設密碼為 <code className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono font-bold text-emerald-800">bio1234</code>。
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                  <span>目前登入密碼：<span className="font-mono font-bold text-slate-900">{teacherPassword}</span></span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="輸入新密碼 (預設: bio1234)"
                    value={newPasswordInput}
                    onChange={(e) => {
                      setNewPasswordInput(e.target.value);
                      setPasswordChangeSuccess(false);
                    }}
                    className="bg-[#f8fafc] border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] flex-1"
                  />
                  <button
                    onClick={() => {
                      if (newPasswordInput.trim() && onUpdatePassword) {
                        onUpdatePassword(newPasswordInput.trim());
                        setPasswordChangeSuccess(true);
                        setNewPasswordInput('');
                      }
                    }}
                    disabled={!newPasswordInput.trim()}
                    className="px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shadow-sm shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    更新密碼
                  </button>
                </div>
              </div>
            </div>

            {passwordChangeSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
                <span>登入密碼已順利更新！下次登入老師管理中心請使用新密碼。</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Inspector Modal (Full Rubrics & Teacher Override) */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#f8fafc] border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  學生評改完整紀錄 — {selectedResult.studentName} ({selectedResult.className}班 {selectedResult.seatNo}號)
                </h3>
                <p className="text-xs text-slate-500 font-medium">{selectedResult.unitTitle}</p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* Image Preview if present */}
              {selectedResult.imageUrl && (
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">上傳作業原始照片:</label>
                  <img
                    src={selectedResult.imageUrl}
                    alt="Student Worksheet"
                    className="max-h-60 rounded-2xl border border-slate-200 mx-auto object-contain bg-slate-50"
                  />
                </div>
              )}

              {/* OCR Text */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">OCR 提取文字:</label>
                <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-200 font-mono whitespace-pre-wrap text-slate-800">
                  {selectedResult.ocrExtractedText}
                </div>
              </div>

              {/* Universal Concept Map Logic Verification Card */}
              {selectedResult.conceptMapAnalysis && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-200/90 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <span>通用概念構圖自動評改與邏輯驗證</span>
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">
                          主題: {selectedResult.conceptMapAnalysis.identified_theme || selectedResult.unitTitle}
                        </span>
                      </h4>
                    </div>
                  </div>

                  {selectedResult.conceptMapAnalysis.structural_metrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white p-2 rounded-xl border border-indigo-100 text-center">
                        <div className="text-[10px] text-slate-500">階層連貫深度</div>
                        <div className="text-xs font-bold text-indigo-700 font-mono">
                          {selectedResult.conceptMapAnalysis.structural_metrics.hierarchical_levels ?? 4} 層
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-indigo-100 text-center">
                        <div className="text-[10px] text-slate-500">有效命題(連接詞)</div>
                        <div className="text-xs font-bold text-emerald-600 font-mono">
                          {selectedResult.conceptMapAnalysis.structural_metrics.propositions_count ?? 10} 個
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-indigo-100 text-center">
                        <div className="text-[10px] text-slate-500">橫向連結</div>
                        <div className="text-xs font-bold text-amber-600 font-mono">
                          {selectedResult.conceptMapAnalysis.structural_metrics.cross_links_count ?? 2} 個
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-indigo-100 text-center">
                        <div className="text-[10px] text-slate-500">具體實例</div>
                        <div className="text-xs font-bold text-sky-600 font-mono">
                          {selectedResult.conceptMapAnalysis.structural_metrics.examples_count ?? 3} 項
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedResult.conceptMapAnalysis.identified_errors && selectedResult.conceptMapAnalysis.identified_errors.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-rose-800">
                        核心邏輯診斷錯誤 ({selectedResult.conceptMapAnalysis.identified_errors.length} 項):
                      </div>
                      {selectedResult.conceptMapAnalysis.identified_errors.map((err, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-rose-200 text-[11px] space-y-1">
                          <div className="flex justify-between font-bold text-rose-900">
                            <span>{err.error_type}</span>
                            <span className="text-slate-500 font-normal">{err.error_location}</span>
                          </div>
                          <p className="text-slate-700">寫法："{err.student_wrote}"</p>
                          <p className="text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-100">
                            <strong>問題：</strong> {err.logic_violation}
                          </p>
                          <p className="text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-100">
                            <strong>給學生評語：</strong> {err.generic_explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>通過三大通用邏輯規則驗證（R1 範疇無混淆、R2 階層連貫、R3 連接詞有效）。</span>
                    </div>
                  )}

                  {selectedResult.conceptMapAnalysis.universal_grading_summary && (
                    <div className="p-2.5 bg-white rounded-xl border border-indigo-100 text-[11px] text-indigo-950">
                      <strong>總評：</strong> {selectedResult.conceptMapAnalysis.universal_grading_summary}
                    </div>
                  )}
                </div>
              )}

              {/* Teacher Score Override Area */}
              <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-[#10b981]" />
                  <span>教師覆核與分數修訂 (Teacher Override)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 text-[11px] font-bold mb-1">修訂評分 (滿分 100):</label>
                    <input
                      type="number"
                      value={teacherOverrideScore}
                      onChange={(e) => setTeacherOverrideScore(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10b981] font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 text-[11px] font-bold mb-1">教師個人補充評語 / 備註:</label>
                    <input
                      type="text"
                      value={teacherOverrideNotes}
                      onChange={(e) => setTeacherOverrideNotes(e.target.value)}
                      placeholder="填寫導師說明或實體教學覆核備註"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                    />
                  </div>
                </div>

                <div className="text-right pt-1">
                  <button
                    onClick={handleSaveTeacherOverride}
                    className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 ml-auto transition-colors shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    儲存人工覆核修訂
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add New Rubric Type Modal */}
      {isAddRubricTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 bg-[#f8fafc] border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#10b981]" />
                <span>新增作業規準類型</span>
              </h3>
              <button
                onClick={() => setIsAddRubricTypeModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  規準類型名稱 / 標題 (例如：規準三：探究觀察與實驗繪圖):
                </label>
                <input
                  type="text"
                  value={newTypeTitle}
                  onChange={(e) => setNewTypeTitle(e.target.value)}
                  placeholder="請輸入評分規準名稱..."
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  評分規準內文細項與百分比配分描述:
                </label>
                <textarea
                  rows={6}
                  value={newTypeText}
                  onChange={(e) => setNewTypeText(e.target.value)}
                  placeholder="請輸入評分規準細項指引與權重配分..."
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsAddRubricTypeModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateRubricType}
                  disabled={!newTypeTitle.trim()}
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  確定新增規準類型
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rubric Type Name Modal */}
      {isEditTypeNameModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 bg-[#f8fafc] border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#10b981]" />
                <span>編輯作業規準類型名稱</span>
              </h3>
              <button
                onClick={() => setIsEditTypeNameModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  作業規準類型名稱:
                </label>
                <input
                  type="text"
                  value={editTypeTitleInput}
                  onChange={(e) => setEditTypeTitleInput(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsEditTypeNameModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateTypeName}
                  disabled={!editTypeTitleInput.trim()}
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  儲存名稱
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rubric Text Modal */}
      {isEditingRubricModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 bg-[#f8fafc] border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#10b981]" />
                <span className="truncate max-w-md">
                  編輯評分規準內文（{activeRubricItem.title}）
                </span>
              </h3>
              <button
                onClick={() => setIsEditingRubricModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  【{activeRubricItem.title}】內文指引與項目配分描述:
                </label>
                <textarea
                  rows={8}
                  value={tempRubricText}
                  onChange={(e) => setTempRubricText(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsEditingRubricModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const updatedTypes = rubricTypes.map((r) =>
                      r.id === selectedAssignmentTypeId ? { ...r, text: tempRubricText } : r
                    );
                    setRubricTypes(updatedTypes);
                    handleSaveRubricSettings(updatedTypes, selectedAssignmentTypeId);
                    setIsEditingRubricModal(false);
                  }}
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  儲存規準內文
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RAG Unit Edit Modal */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 bg-[#f8fafc] border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#10b981]" />
                <span>編輯 RAG 知識庫內文與主題</span>
              </h3>
              <button
                onClick={() => setEditingUnit(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  單元名稱 / 主題:
                </label>
                <input
                  type="text"
                  value={editingUnit.title}
                  onChange={(e) => setEditingUnit({ ...editingUnit, title: e.target.value })}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  主題簡介說明:
                </label>
                <textarea
                  rows={2}
                  value={editingUnit.description}
                  onChange={(e) => setEditingUnit({ ...editingUnit, description: e.target.value })}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  課本知識庫完整內文（RAG Text / 核心概念關鍵詞 / 常見迷思概念 / 會考命題提示）:
                </label>
                <textarea
                  rows={12}
                  value={editingUnit.textbookExcerpt || ''}
                  onChange={(e) => setEditingUnit({ ...editingUnit, textbookExcerpt: e.target.value })}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl p-3.5 text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] leading-relaxed"
                  placeholder="請輸入完整課本知識庫內文與迷思概念..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    專家概念節點數量:
                  </label>
                  <input
                    type="number"
                    value={editingUnit.knowledgePointsCount}
                    onChange={(e) => setEditingUnit({ ...editingUnit, knowledgePointsCount: Number(e.target.value) })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    概念圖連結數量:
                  </label>
                  <input
                    type="number"
                    value={editingUnit.conceptMapLinks}
                    onChange={(e) => setEditingUnit({ ...editingUnit, conceptMapLinks: Number(e.target.value) })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setEditingUnit(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setKnowledgeUnits((prev) => prev.map((u) => (u.id === editingUnit.id ? editingUnit : u)));
                    setEditingUnit(null);
                  }}
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  儲存單位設定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
