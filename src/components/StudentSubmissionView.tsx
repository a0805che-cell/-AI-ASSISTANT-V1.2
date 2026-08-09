import React, { useState, useEffect } from 'react';
import {
  Camera,
  FolderOpen,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  RefreshCw,
  Printer,
  Image as ImageIcon,
  Lightbulb,
  X
} from 'lucide-react';
import { KnowledgeUnit, AssessmentResult, SystemConfig, RubricTypeItem } from '../types';
import { CameraModal } from './CameraModal';
import { getCombinedMisconceptions } from '../utils/misconceptionUtils';
import { compressImageBase64 } from '../utils/imageUtils';

interface StudentSubmissionViewProps {
  knowledgeUnits: KnowledgeUnit[];
  config: SystemConfig;
  onNewAssessmentCreated: (result: AssessmentResult) => void;
}

export const StudentSubmissionView: React.FC<StudentSubmissionViewProps> = ({
  knowledgeUnits,
  config,
  onNewAssessmentCreated
}) => {
  // Student Form State
  const [studentName, setStudentName] = useState('335344');
  const [selectedClass, setSelectedClass] = useState(config.classes[0] || '701');
  const [seatNo, setSeatNo] = useState('04');
  const [selectedUnitId, setSelectedUnitId] = useState(knowledgeUnits[0]?.id || 'unit-bio-01');

  // Dynamic Rubric Types State
  const [rubricTypes, setRubricTypes] = useState<RubricTypeItem[]>(() => {
    const saved = localStorage.getItem('rubricTypes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      { id: 'conceptMap', title: '概念構圖', text: '' },
      { id: 'report', title: '探究與實驗報告', text: '' }
    ];
  });

  const [selectedRubricTypeId, setSelectedRubricTypeId] = useState<string>(() => {
    return localStorage.getItem('primaryRubricTypeId') || localStorage.getItem('primaryRubricType') || 'conceptMap';
  });

  // Fetch Server Rubric Types on mount
  useEffect(() => {
    fetch('/api/rubric')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.rubricTypes) && data.rubricTypes.length > 0) {
          setRubricTypes(data.rubricTypes);
        }
        if (data.primaryTypeId) {
          setSelectedRubricTypeId(data.primaryTypeId);
        }
      })
      .catch((err) => console.error('Error syncing rubric in StudentSubmissionView:', err));
  }, []);

  // Submission Content State
  const [activeUploadTab, setActiveUploadTab] = useState<'camera' | 'file' | 'text'>('file');
  const [textContent, setTextContent] = useState('');
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileType, setUploadedFileType] = useState<string>('');

  // UI Modal & Loading State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingStep, setGradingStep] = useState<number>(0);
  const [latestResult, setLatestResult] = useState<AssessmentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const currentUnit = knowledgeUnits.find((u) => u.id === selectedUnitId) || knowledgeUnits[0];

  const handleResetSubmission = () => {
    setLatestResult(null);
    setUploadedImageBase64('');
    setUploadedFileName('');
    setUploadedFileType('');
    setTextContent('');
    setErrorMessage('');
    setStudentName('');
    setSeatNo('');
    setSelectedClass(config.classes[0] || '');
  };

  // Handle File Select / Drag & Drop
  const handleFileChange = (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadedFileType(file.type);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setUploadedImageBase64(base64);
      };
      reader.readAsDataURL(file);
    } else {
      // For Word/PDF/TXT documents
      setUploadedImageBase64('');
      setTextContent((prev) => (prev ? prev + '\n\n' : '') + `[已上傳文件檔案：${file.name} (${(file.size / 1024).toFixed(1)} KB)]`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Submit & Trigger AI Evaluation
  const handleSubmitAssignment = async () => {
    if (!studentName.trim()) {
      setErrorMessage('請輸入學生姓名！');
      return;
    }
    if (!selectedClass) {
      setErrorMessage('請選擇班級！');
      return;
    }
    if (!textContent.trim() && !uploadedImageBase64) {
      setErrorMessage('請上傳作業照片、作業檔案或填寫文字作答內容！');
      return;
    }

    setErrorMessage('');
    setIsGrading(true);
    setGradingStep(1);

    // Simulated progress step animation for OCR -> RAG -> Rubrics -> Misconception Diagnosis
    const timer1 = setTimeout(() => setGradingStep(2), 700);
    const timer2 = setTimeout(() => setGradingStep(3), 1400);
    const timer3 = setTimeout(() => setGradingStep(4), 2100);

    try {
      let activeRubricType = localStorage.getItem('primaryRubricTypeId') || localStorage.getItem('primaryRubricType') || 'conceptMap';
      let activeRubricText = '';

      const savedTypesJson = localStorage.getItem('rubricTypes');
      if (savedTypesJson) {
        try {
          const typesList = JSON.parse(savedTypesJson);
          if (Array.isArray(typesList) && typesList.length > 0) {
            const found = typesList.find((t: any) => t.id === activeRubricType) || typesList[0];
            if (found) {
              activeRubricType = found.id;
              activeRubricText = found.text;
            }
          }
        } catch (e) {
          console.error('Error parsing rubricTypes in StudentSubmissionView:', e);
        }
      }

      // Compress image base64 if needed to avoid Vercel 4.5MB Serverless limit
      let processedBase64 = uploadedImageBase64;
      if (uploadedImageBase64) {
        processedBase64 = await compressImageBase64(uploadedImageBase64, 1600, 0.85);
      }

      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          className: selectedClass,
          seatNo,
          unitId: selectedUnitId,
          textContent,
          imageBase64: processedBase64,
          fileName: uploadedFileName || (processedBase64 ? 'student_worksheet_photo.jpg' : 'typed_assignment.txt'),
          fileType: uploadedFileType || 'image/jpeg',
          rubricType: activeRubricType,
          rubricText: activeRubricText
        })
      });

      if (!response.ok) {
        let errDetail = '';
        try {
          const errJson = await response.json();
          errDetail = errJson.error || errJson.message || '';
        } catch (_) {
          errDetail = await response.text().catch(() => '');
        }

        if (response.status === 413) {
          throw new Error('作業檔案/圖片容量過大 (413)，請拍攝較清晰且較小的照片後重新上傳。');
        }
        if (response.status === 404) {
          throw new Error('無法連線至評改 API 後端服務 (404 Not Found)。若發佈至 Vercel，請確認 vercel.json 與後端 API 路由設定。');
        }
        throw new Error(`評改 API 伺服器回應異常 (${response.status}${errDetail ? ': ' + errDetail : ''})`);
      }

      const resultData: AssessmentResult = await response.json();
      setLatestResult(resultData);
      onNewAssessmentCreated(resultData);
    } catch (err: any) {
      console.error('Assessment Error:', err);
      setErrorMessage('評改處理發生錯誤：' + (err?.message || '請稍後重試'));
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsGrading(false);
      setGradingStep(0);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Main Submission Form Container */}
      <div className="bg-white shadow-xs border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6">
        {/* Row 1: 你的大名 | 班級 | 座號 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              你的大名
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="請輸入姓名"
              className="w-full bg-[#eef2f6] border border-slate-200/60 rounded-2xl px-4 py-3 text-slate-800 font-bold text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              班級
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-[#eef2f6] border border-slate-200/60 rounded-2xl px-4 py-3 text-slate-800 font-bold text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] transition-all cursor-pointer"
            >
              {config.classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              座號
            </label>
            <input
              type="text"
              value={seatNo}
              onChange={(e) => setSeatNo(e.target.value)}
              placeholder="座號"
              className="w-full bg-[#eef2f6] border border-slate-200/60 rounded-2xl px-4 py-3 text-slate-800 font-bold text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Row 2: 2 Column Layout (Left: File Upload | Right: Unit & Rubric Selection) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* LEFT COLUMN: 上傳作業圖片 / 文件 */}
          <div className="space-y-3 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                上傳作業圖片 / 文件
              </label>

              {/* Upload Dropzone Box */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-200/90 hover:border-[#10b981] bg-[#f8fafc] hover:bg-slate-100/60 transition-all rounded-3xl p-6 text-center relative group min-h-[160px] flex flex-col items-center justify-center cursor-pointer"
              >
                <input
                  type="file"
                  accept="image/*,.pdf,.docx,.txt"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Thumbnail Preview Area or Default Upload Graphic */}
                <div className="flex items-center justify-center gap-3 mb-2">
                  {uploadedFileName ? (
                    <div className="relative group/thumb">
                      <div className="w-14 h-14 bg-slate-100 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-600 font-bold text-xs p-1">
                        <FileText className="w-5 h-5 text-slate-500 mb-0.5" />
                        <span className="text-[10px] uppercase truncate max-w-[45px]">
                          {uploadedFileName.split('.').pop() || 'FILE'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedImageBase64('');
                          setUploadedFileName('');
                          setUploadedFileType('');
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-rose-600 text-white rounded-full flex items-center justify-center z-20 shadow-xs transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}

                  {uploadedImageBase64 ? (
                    <div className="relative group/thumb">
                      <img
                        src={uploadedImageBase64}
                        alt="Preview"
                        className="w-14 h-14 object-cover rounded-2xl border border-slate-200 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedImageBase64('');
                          setUploadedFileName('');
                          setUploadedFileType('');
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-rose-600 text-white rounded-full flex items-center justify-center z-20 shadow-xs transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}

                  {!uploadedFileName && !uploadedImageBase64 && (
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-xs">
                        PDF
                      </div>
                      <div className="w-10 h-10 bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center text-amber-700">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs font-bold text-slate-900 mt-1">
                  點擊或拖曳上傳
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  支援 JPG, PNG, PDF, DOCX
                </p>
              </div>
            </div>

            {/* Bottom 2 Buttons: 拍照上傳 & 選擇檔案 */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 flex items-center justify-center gap-2 shadow-2xs transition-all hover:border-slate-300 active:scale-[0.98] cursor-pointer"
              >
                <Camera className="w-4 h-4 text-slate-800" />
                <span>拍照上傳</span>
              </button>

              <label className="py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 flex items-center justify-center gap-2 shadow-2xs transition-all hover:border-slate-300 active:scale-[0.98] cursor-pointer">
                <FolderOpen className="w-4 h-4 text-amber-600" />
                <span>選擇檔案</span>
                <input
                  type="file"
                  accept="image/*,.pdf,.docx,.txt"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* RIGHT COLUMN: 單元選擇 & 作業類型 */}
          <div className="space-y-4">
            {/* 1. 單元選擇 (連動知識庫) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                單元選擇 (連動知識庫)
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 font-bold text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] transition-all cursor-pointer shadow-2xs"
              >
                {knowledgeUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>

              {/* Yellow Hint Box */}
              <div className="bg-[#fef3c7]/70 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900 font-medium flex items-center gap-2 shadow-2xs">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                <span>AI 會依據此單元的專家概念構圖來評分與偵測迷思概念。</span>
              </div>
            </div>

            {/* 2. 作業類型 (連動評分規準) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                作業類型 (連動評分規準)
              </label>
              <select
                value={selectedRubricTypeId}
                onChange={(e) => setSelectedRubricTypeId(e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 font-bold text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] transition-all cursor-pointer shadow-2xs"
              >
                {rubricTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>

              {/* Yellow Hint Box */}
              <div className="bg-[#fef3c7]/70 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900 font-medium flex items-center gap-2 shadow-2xs">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                <span>AI 會依據此作業類型的評分規準來計算配分項目。</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Bottom Action Button: 送出作業並開始評改 */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isGrading}
            onClick={handleSubmitAssignment}
            className="w-full py-4 rounded-2xl bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] disabled:opacity-50 text-white font-bold text-base shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer transform active:scale-[0.99]"
          >
            {isGrading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>AI 即時批改進行中...</span>
              </>
            ) : (
              <span>送出作業並開始評改</span>
            )}
          </button>
        </div>
      </div>

      {/* AI Grading Progress Section when loading */}
      {isGrading && (
        <div className="bg-white border border-emerald-200 rounded-3xl p-6 shadow-sm space-y-5 animate-pulse">
          <div className="flex items-center gap-3 text-[#10b981] font-bold text-base border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 animate-spin" />
            <span>AI 專家系統正進行差異化評改...</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`flex items-center gap-3 text-xs p-3.5 rounded-2xl border ${gradingStep >= 1 ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              <FileText className="w-4 h-4" />
              <span>1. 光學字符 OCR 辨識與學生手寫內容提取...</span>
            </div>

            <div className={`flex items-center gap-3 text-xs p-3.5 rounded-2xl border ${gradingStep >= 2 ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              <BookOpen className="w-4 h-4" />
              <span>2. 比對 RAG 教師專家知識庫 ({currentUnit?.title})...</span>
            </div>

            <div className={`flex items-center gap-3 text-xs p-3.5 rounded-2xl border ${gradingStep >= 3 ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              <Sparkles className="w-4 h-4" />
              <span>3. 根據【{rubricTypes.find(r => r.id === selectedRubricTypeId)?.title || '評分規準'}】進行配分評估...</span>
            </div>

            <div className={`flex items-center gap-3 text-xs p-3.5 rounded-2xl border ${gradingStep >= 4 ? 'bg-amber-50 text-amber-800 border-amber-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              <Sparkles className="w-4 h-4" />
              <span>4. 偵測迷思概念與生成個人化補救建議...</span>
            </div>
          </div>
        </div>
      )}

      {/* Latest Result View */}
      {latestResult && !isGrading && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header result badge */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#10b981] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  評改完成
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {latestResult.submittedAt}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                {latestResult.studentName} ({latestResult.className}班 {latestResult.seatNo}號)
              </h3>
              <p className="text-xs text-slate-500 font-medium">{latestResult.unitTitle}</p>
            </div>

            {/* Score Badge */}
            <div className="text-right shrink-0">
              <div className="text-3xl font-black text-[#10b981]">
                {latestResult.totalScore} <span className="text-sm text-slate-400 font-normal">分</span>
              </div>
              <div className="text-xs font-bold text-slate-700 mt-0.5">
                {latestResult.gradeLevel}
              </div>
            </div>
          </div>

          {/* Irrelevant Submission Alert Banner */}
          {!latestResult.isRelevant && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>相關性過濾器判定：無關作業（不予計分 0 分）</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetSubmission}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
                >
                  重新上傳作業
                </button>
              </div>
              <p className="text-rose-700 leading-relaxed">
                根據 RAG 知識庫比對，上傳內容與該單元（{latestResult.unitTitle}）文本無關或為塗鴉。請對照教材重寫後重新繳交。
              </p>
            </div>
          )}

          {/* OCR Extracted Student Statement */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#10b981]" />
              <span>OCR 辨識手寫 / 填答內容</span>
            </label>
            <div className="p-3 bg-[#f8fafc] rounded-2xl border border-slate-200/80 text-xs text-slate-700 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
              {latestResult.ocrExtractedText}
            </div>
          </div>

          {/* Universal Concept Map Logic Verification Card */}
          {latestResult.conceptMapAnalysis && (
            <div className="p-4 bg-indigo-50/60 border border-indigo-200/90 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>通用概念構圖自動評改與邏輯驗證</span>
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">
                        中心主題: {latestResult.conceptMapAnalysis.identified_theme || latestResult.unitTitle}
                      </span>
                    </h4>
                  </div>
                </div>
              </div>

              {/* Structural Metrics */}
              {latestResult.conceptMapAnalysis.structural_metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <div className="text-[10px] text-slate-500 font-medium">階層連貫深度</div>
                    <div className="text-xs font-bold text-indigo-700 font-mono mt-0.5">
                      {latestResult.conceptMapAnalysis.structural_metrics.hierarchical_levels ?? 4} 層 (主要→實例)
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <div className="text-[10px] text-slate-500 font-medium">有效命題(連接詞)</div>
                    <div className="text-xs font-bold text-emerald-600 font-mono mt-0.5">
                      {latestResult.conceptMapAnalysis.structural_metrics.propositions_count ?? 10} 個
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <div className="text-[10px] text-slate-500 font-medium">橫向連結 (Cross-links)</div>
                    <div className="text-xs font-bold text-amber-600 font-mono mt-0.5">
                      {latestResult.conceptMapAnalysis.structural_metrics.cross_links_count ?? 2} 個
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <div className="text-[10px] text-slate-500 font-medium">具體實例 (Examples)</div>
                    <div className="text-xs font-bold text-sky-600 font-mono mt-0.5">
                      {latestResult.conceptMapAnalysis.structural_metrics.examples_count ?? 3} 項
                    </div>
                  </div>
                </div>
              )}

              {/* Universal Logic Errors List */}
              {latestResult.conceptMapAnalysis.identified_errors && latestResult.conceptMapAnalysis.identified_errors.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>概念構圖核心邏輯診斷錯誤 ({latestResult.conceptMapAnalysis.identified_errors.length} 項)</span>
                  </div>
                  <div className="space-y-2">
                    {latestResult.conceptMapAnalysis.identified_errors.map((err, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-rose-200 text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                            {err.error_type || 'R1_LOGICAL_CATEGORY_MISMATCH'}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-600">
                            位置: {err.error_location}
                          </span>
                        </div>
                        <p className="text-slate-700 text-[11px]">
                          <strong className="text-slate-900">引述/現象：</strong> "{err.student_wrote}"
                        </p>
                        <p className="text-rose-700 text-[11px] bg-rose-50 p-2 rounded border border-rose-100">
                          <strong>邏輯問題：</strong> {err.logic_violation}
                        </p>
                        <p className="text-emerald-800 text-[11px] bg-emerald-50 p-2 rounded border border-emerald-100">
                          <strong>評語建議：</strong> {err.generic_explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>通過三大通用邏輯規則驗證（R1 邏輯範疇無混淆、R2 階層連貫正確、R3 連接詞有效成立）。</span>
                </div>
              )}

              {/* Universal Grading Summary */}
              {latestResult.conceptMapAnalysis.universal_grading_summary && (
                <div className="p-3 bg-white rounded-xl border border-indigo-100 text-xs text-indigo-950 leading-relaxed font-sans">
                  <strong>通用構圖能力總評：</strong>{latestResult.conceptMapAnalysis.universal_grading_summary}
                </div>
              )}
            </div>
          )}

          {/* 4-Column Scoring Table */}
          {latestResult.scoringTable && latestResult.scoringTable.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  <span>個人評分資料表</span>
                </span>
              </label>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] text-slate-600 border-b border-slate-200 font-bold">
                      <th className="p-2.5 w-1/4">項目</th>
                      <th className="p-2.5 w-1/4">得分細節</th>
                      <th className="p-2.5 w-1/6 text-center">得分</th>
                      <th className="p-2.5 w-1/3">說明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {latestResult.scoringTable.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-bold text-slate-800 align-top">
                          {row.item}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600 align-top leading-relaxed">
                          {row.details}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-[#10b981] text-center align-top whitespace-nowrap">
                          {row.score}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600 align-top leading-relaxed">
                          {row.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Socratic Differentiated Guidance Card */}
          {latestResult.socraticFeedback && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-2">
                <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center text-white font-bold text-xs shrink-0">
                  👨‍🏫
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    蘇格拉底式個人化評語與引導
                  </h4>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-100 text-xs text-slate-700 leading-relaxed font-sans shadow-2xs">
                {latestResult.socraticFeedback}
              </div>
            </div>
          )}

          {/* Identified Misconceptions & Concept Map Logic Errors */}
          {(() => {
            const combined = getCombinedMisconceptions(latestResult);
            if (!combined || combined.length === 0) return null;
            return (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>診斷發現之迷思概念與邏輯錯誤 ({combined.length} 項)</span>
                </label>

                <div className="space-y-2">
                  {combined.map((m, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-amber-200 text-xs space-y-1">
                      <div className="text-amber-900 font-bold flex items-center gap-1.5">
                        <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-mono">
                          {m.code}
                        </span>
                        <span>{m.conceptTitle}</span>
                      </div>
                      {m.studentStatementExcerpt && (
                        <p className="text-slate-500 text-[11px] italic">
                          作答引述："{m.studentStatementExcerpt}"
                        </p>
                      )}
                      {m.logicViolation && (
                        <p className="text-rose-700 text-[11px] bg-rose-50 p-1.5 rounded border border-rose-100">
                          邏輯核心問題：{m.logicViolation}
                        </p>
                      )}
                      <p className="text-emerald-800 text-[11px] bg-emerald-50 p-1.5 rounded border border-emerald-200 mt-1">
                        觀念引導：{m.remedialHint}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handlePrintReport}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              列印報告
            </button>

            <button
              type="button"
              onClick={handleResetSubmission}
              className="px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重新評改 / 評改下一份
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(base64) => {
          setUploadedImageBase64(base64);
          setUploadedFileName(`相機拍攝作業_${Date.now()}.jpg`);
          setUploadedFileType('image/jpeg');
        }}
      />
    </div>
  );
};
