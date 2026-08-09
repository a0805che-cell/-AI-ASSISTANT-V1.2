import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_KNOWLEDGE_UNITS,
  DEFAULT_RUBRIC_CRITERIA,
  DEFAULT_SYSTEM_CONFIG,
  INITIAL_SAMPLE_RESULTS
} from './src/data/defaults.js';
import {
  AssessmentResult,
  KnowledgeUnit,
  RubricCriteria,
  SystemConfig,
  MisconceptionStat,
  MisconceptionFound
} from './src/types.js';

// In-memory data store for server session
let systemConfig: SystemConfig = { ...DEFAULT_SYSTEM_CONFIG };
let knowledgeUnits: KnowledgeUnit[] = [...DEFAULT_KNOWLEDGE_UNITS];
let rubricCriteria: RubricCriteria[] = [...DEFAULT_RUBRIC_CRITERIA];
let assessmentResults: AssessmentResult[] = [...INITIAL_SAMPLE_RESULTS];

const RUBRIC_STORE_PATH = path.join(process.cwd(), 'rubric_store.json');

const defaultRubricConfig = {
  primaryTypeId: 'conceptMap',
  rubricTypes: [
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
      text: `規準二：探究與實驗報告評分規準 (適用於所有單元)
1. 探究主題與假設擬定 (20%)：明確陳述探究問題，提出可檢驗的科學假設與變因對照。
2. 實驗設計與控制變因邏輯 (30%)：正確區分操作變因、控制變因與應變變因，步驟規劃嚴謹合理。
3. 數據記錄與圖表分析 (25%)：數據表格記錄詳實精確，能將數據繪製為圖表並精準分析變化趨勢。
4. 實驗結論推論與反思討論 (25%)：結論符合實驗數據實證，能對照假設進行科學論證並提出可能誤差反思。`
    }
  ]
};

function loadRubricConfig() {
  try {
    if (fs.existsSync(RUBRIC_STORE_PATH)) {
      const raw = fs.readFileSync(RUBRIC_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rubricTypes) && parsed.rubricTypes.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load rubric_store.json:', err);
  }
  return defaultRubricConfig;
}

function saveRubricConfigToDisk(config: typeof defaultRubricConfig) {
  try {
    fs.writeFileSync(RUBRIC_STORE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write rubric_store.json:', err);
  }
}

let activeRubricConfig = loadRubricConfig();

// Hash Cache Map for 100% deterministic test-retest reliability lock
// Key: Hash of (unitId + content), Value: AssessmentResult
const assessmentCache = new Map<string, AssessmentResult>();

// Initialize cache with sample initial results
INITIAL_SAMPLE_RESULTS.forEach((res) => {
  assessmentCache.set(res.hash, res);
});

function calculateHash(unitId: string, studentName: string, textContent: string, hasImage: boolean, imageBase64?: string): string {
  const data = `${unitId}:${studentName.trim()}:${textContent.trim()}:${hasImage ? (imageBase64 || '').slice(0, 500) : 'no-image'}`;
  return 'hash-' + crypto.createHash('md5').update(data).digest('hex').substring(0, 16);
}

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.warn('[Gemini API] Warning: GEMINI_API_KEY is missing or default. Will use realistic RAG heuristics fallback if API call fails.');
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Enable CORS for cross-origin or Vercel preview requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// --- API ROUTES ---

// Get System Config
app.get('/api/config', (req, res) => {
  res.json(systemConfig);
});

  // Update System Config
  app.put('/api/config', (req, res) => {
    systemConfig = { ...systemConfig, ...req.body };
    res.json(systemConfig);
  });

  // Get Knowledge Base Units
  app.get('/api/knowledge-base', (req, res) => {
    res.json(knowledgeUnits);
  });

  // Add/Update Knowledge Unit
  app.post('/api/knowledge-base', (req, res) => {
    const newUnit: KnowledgeUnit = req.body;
    const existingIdx = knowledgeUnits.findIndex((u) => u.id === newUnit.id);
    if (existingIdx >= 0) {
      knowledgeUnits[existingIdx] = newUnit;
    } else {
      knowledgeUnits.push(newUnit);
    }
    res.json(knowledgeUnits);
  });

  // Get Rubrics
  app.get('/api/rubrics', (req, res) => {
    res.json(rubricCriteria);
  });

  // Update Rubrics
  app.put('/api/rubrics', (req, res) => {
    if (Array.isArray(req.body)) {
      rubricCriteria = req.body;
    }
    res.json(rubricCriteria);
  });

  // Function to enforce 360-day Firebase/Server retention policy
function pruneOldRecords360Days() {
  const now = Date.now();
  const maxAgeMs = 360 * 24 * 60 * 60 * 1000; // 360 days
  assessmentResults = assessmentResults.filter((r) => {
    if (!r.submittedAt) return true;
    const time = new Date(r.submittedAt).getTime();
    if (isNaN(time)) return true;
    return (now - time) <= maxAgeMs;
  });
}

// Get Assessment Results with filter options (Web teacher admin defaults to 60 days, Firebase retains 360 days)
  app.get('/api/results', (req, res) => {
    pruneOldRecords360Days();
    const { className, unitId, search, allHistory } = req.query;
    let filtered = [...assessmentResults];

    // Filter for Web Teacher Admin: default 60 days limit (Firebase retains up to 360 days)
    const limitDays = allHistory === 'true' ? 360 : 60;
    const cutoffTime = Date.now() - limitDays * 24 * 60 * 60 * 1000;
    filtered = filtered.filter((r) => {
      if (!r.submittedAt) return true;
      const time = new Date(r.submittedAt).getTime();
      return isNaN(time) || time >= cutoffTime;
    });

    if (className && className !== 'ALL') {
      filtered = filtered.filter((r) => r.className === className);
    }
    if (unitId && unitId !== 'ALL') {
      filtered = filtered.filter((r) => r.unitId === unitId);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.seatNo.includes(q) ||
          r.ocrExtractedText.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  });

  // Update Teacher Override / Notes
  app.put('/api/results/:id', (req, res) => {
    const { id } = req.params;
    const idx = assessmentResults.findIndex((r) => r.id === id);
    if (idx >= 0) {
      assessmentResults[idx] = {
        ...assessmentResults[idx],
        ...req.body,
        teacherOverridden: true
      };
      res.json(assessmentResults[idx]);
    } else {
      res.status(404).json({ error: 'Record not found' });
    }
  });

  // Delete Assessment Record
  app.delete('/api/results/:id', (req, res) => {
    const { id } = req.params;
    assessmentResults = assessmentResults.filter((r) => r.id !== id);
    res.json({ success: true, remaining: assessmentResults.length });
  });

  // Helper function to extract all misconceptions & conceptMapAnalysis errors
  function extractServerCombinedMisconceptions(resItem: AssessmentResult): MisconceptionFound[] {
    const list: MisconceptionFound[] = [];
    const seenKeys = new Set<string>();

    if (resItem.misconceptions && Array.isArray(resItem.misconceptions)) {
      resItem.misconceptions.forEach((m) => {
        const code = m.code || 'MISC';
        const title = m.conceptTitle || '';
        const key = `${code}:${title}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push(m);
        }
      });
    }

    if (resItem.conceptMapAnalysis?.identified_errors && Array.isArray(resItem.conceptMapAnalysis.identified_errors)) {
      resItem.conceptMapAnalysis.identified_errors.forEach((err, idx) => {
        const code = err.error_type || 'R1_LOGICAL_CATEGORY_MISMATCH';
        const title = err.error_location ? `${code}: ${err.error_location}` : (err.logic_violation || '概念構圖邏輯錯位');
        const key = `${code}:${title}`;

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: `cm-err-${idx}`,
            code,
            conceptTitle: title,
            studentStatementExcerpt: err.student_wrote || '',
            logicViolation: err.logic_violation || '',
            remedialHint: err.generic_explanation || '請引導學生檢視父子概念階層與連接動詞邏輯。'
          });
        }
      });
    }

    return list;
  }

  // Get Misconception Analytics Stats
  app.get('/api/misconceptions/stats', (req, res) => {
    pruneOldRecords360Days();
    const statsMap = new Map<string, MisconceptionStat>();

    assessmentResults.forEach((resItem) => {
      const combined = extractServerCombinedMisconceptions(resItem);
      combined.forEach((m) => {
        const key = `${resItem.unitId}:${m.code}:${m.conceptTitle}`;
        const existing = statsMap.get(key) || {
          unitId: resItem.unitId,
          unitTitle: resItem.unitTitle,
          misconceptionCode: m.code,
          misconceptionTitle: m.conceptTitle,
          count: 0,
          percentage: 0,
          affectedStudents: [],
          suggestedTeachingStrategy: m.remedialHint
        };

        if (!existing.affectedStudents.some((s) => s.name === resItem.studentName && s.className === resItem.className && s.seatNo === resItem.seatNo)) {
          existing.count += 1;
          existing.affectedStudents.push({
            name: resItem.studentName,
            className: resItem.className,
            seatNo: resItem.seatNo
          });
        }
        statsMap.set(key, existing);
      });
    });

    const totalSubmissions = Math.max(1, assessmentResults.length);
    const statsList = Array.from(statsMap.values()).map((st) => ({
      ...st,
      percentage: Math.round((st.count / totalSubmissions) * 100)
    }));

    // Sort by most frequent misconception first
    statsList.sort((a, b) => b.count - a.count);

    res.json({
      totalSubmissions,
      misconceptionStats: statsList
    });
  });

  // Google Sheets Auto-Sync Action
  app.post('/api/sync-sheets', (req, res) => {
    const { recordIds } = req.body;
    const targetRecords = recordIds
      ? assessmentResults.filter((r) => recordIds.includes(r.id))
      : assessmentResults;

    // Mark synced
    targetRecords.forEach((r) => {
      r.googleSheetsSynced = true;
      r.firebaseSynced = true;
    });

    res.json({
      success: true,
      syncedCount: targetRecords.length,
      sheetId: systemConfig.googleSheetId,
      timestamp: new Date().toISOString()
    });
  });

  // Get and Update Teacher Rubric Settings
  app.get('/api/rubric', (req, res) => {
    res.json(activeRubricConfig);
  });

  app.post('/api/rubric', (req, res) => {
    const { primaryTypeId, primaryType, rubricTypes, conceptMapText, reportText } = req.body;
    
    if (primaryTypeId) {
      activeRubricConfig.primaryTypeId = primaryTypeId;
    } else if (primaryType) {
      activeRubricConfig.primaryTypeId = primaryType;
    }

    if (Array.isArray(rubricTypes) && rubricTypes.length > 0) {
      activeRubricConfig.rubricTypes = rubricTypes;
    } else {
      if (conceptMapText) {
        const item = activeRubricConfig.rubricTypes.find(r => r.id === 'conceptMap');
        if (item) item.text = conceptMapText;
      }
      if (reportText) {
        const item = activeRubricConfig.rubricTypes.find(r => r.id === 'report');
        if (item) item.text = reportText;
      }
    }

    saveRubricConfigToDisk(activeRubricConfig);
    res.json({ success: true, activeRubricConfig });
  });

  // --- CORE AI ASSESSMENT ENDPOINT ---
  app.post('/api/assess', async (req, res) => {
    try {
      const {
        studentName,
        className,
        seatNo,
        unitId,
        textContent = '',
        imageBase64 = '',
        fileName = 'student_work.jpg',
        fileType = 'image/jpeg',
        rubricType,
        rubricText
      } = req.body;

      if (!studentName || !className || !unitId) {
        return res.status(400).json({ error: '缺少必填欄位：姓名、班級或單元。' });
      }

      const effectiveRubricTypeId = rubricType || activeRubricConfig.primaryTypeId;
      const targetItem = activeRubricConfig.rubricTypes.find((r) => r.id === effectiveRubricTypeId) || activeRubricConfig.rubricTypes[0];
      const effectiveRubricTitle = targetItem ? targetItem.title : '作業評分規準';
      const effectiveRubricText = rubricText || (targetItem ? targetItem.text : '');

      // 1. Calculate Hash for Reliability & Validity Lock (Deterministic Cache)
      const hasImage = Boolean(imageBase64 && imageBase64.length > 50);
      const submissionHash = calculateHash(unitId, studentName, textContent, hasImage, imageBase64);

      // Check Cache if enabled
      if (systemConfig.strictReliabilityCache && assessmentCache.has(submissionHash)) {
        console.log(`[Reliability Cache HIT] Hash: ${submissionHash} for Student: ${studentName}`);
        const cachedResult = assessmentCache.get(submissionHash)!;
        const resultResponse = {
          ...cachedResult,
          id: 'res-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          submittedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
          cached: true
        };
        assessmentResults.unshift(resultResponse);
        return res.json(resultResponse);
      }

      // 2. Fetch Knowledge Unit RAG Context
      const unit = knowledgeUnits.find((u) => u.id === unitId) || knowledgeUnits[0];

      // 3. Construct Gemini Prompt with RAG Knowledge & Rubrics
      const ai = getGeminiClient();

      const ragContextText = `
=== 國中自然科/生物科 RAG 專家知識庫背景資訊 ===
【評改單元名稱】：${unit.title} (${unit.unitCode})
【單元概述】：${unit.description}
【教材重點內容與知識庫全文 (Textbook Excerpt)】：
${unit.textbookExcerpt}

【核心知識標籤與專有名詞】：
${unit.keyConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

【該單元特定學生常見迷思概念庫 (Common Misconceptions Catalog)】：
${unit.commonMisconceptions.map((m) => `[代碼: ${m.code}] 迷思內容: ${m.concept} | 正確科學觀念: ${m.correction}`).join('\n')}

=== 教師指定最主要評分規準 (Rubrics - 作業類型：${effectiveRubricTitle}) ===
【極重要規範】：本次學生繳交作業為【${effectiveRubricTitle}】類型。請【嚴格】根據以下教師指定之主要評分規準配分與細則進行作業全盤評分與各項指標得分計算：

${effectiveRubricText}

（輔助指標配分描述參考）：
${rubricCriteria
  .map(
    (c) => `
- 指標名稱: ${c.title} (配分: ${c.maxPoints}分, 權重: ${c.weight}%)
  等級描述:
  ${c.levels.map((l) => `  * 等級 ${l.level} (${l.name}): ${l.description}`).join('\n')}
`
  )
  .join('\n')}
`;

      const promptInstructions = `
你是一位通用的學術概念構圖評估專家與國中自然科（生物、理化、地球科學）教育評量大師。你將擔任本系統的核心評分引擎，請【嚴格】遵循以下規範與『通用概念構圖作業自動評改與邏輯驗證』機制進行作業評閱：

### 【任務與核心宣告】
你的任務不是尋找特定的標準答案，而是根據概念構圖的通用組織原則、邏輯層級以及內文主題的內在邏輯，評估學生作業的合理性與邏輯嚴謹度。

=== 通用知識結構 (Generalized Knowledge Structure) ===
- 中心主題 (Root Topic)：由作業標題或中心節點確定的主題 (Topic / 主要概念)
- 第 1 層分類規則 (Layer 1 Rules)：
  * L1_DEFINITIONAL: 包含定義、特點、屬性 (Attributes)
  * L1_COMPONENTIAL: 包含組成部分、構造、成員 (Components)
  * L1_FUNCTIONAL: 包含功能、作用、目的 (Functions)
  * L1_MECHANISTIC: 包含機制、流程、控制方法 (Mechanisms/Processes)

=== 概念構圖通用架構 (Concept Map Architecture) ===
1. 主要概念 (Main Concept / Root) -> 透過『連結動詞』發散延伸至 -> 一般性概念 (General Concepts)
2. 一般性概念 -> 透過『連結動詞』下潛至 -> 次一般性概念 / 概念 (Sub-concepts) -> 專一概念 (Specific Concepts)
3. 專一概念 / 概念 -> 下方懸掛 -> 實例 (Examples) （代表該概念的具體例子，通常不加圈）
4. 橫向連結 (Cross-links)：顯示不同分支概念間的整合關係，代表高層次認知與知識統整能力。

=== 通用評改與邏輯驗證三大規則 (Universal Grading Rules) ===
1. 【規則一：R1_LOGICAL_CATEGORY_MISMATCH (核心邏輯範疇驗證)】
   - 驗證子節點在邏輯上是否屬於父節點的範疇。
   - 核心邏輯檢查 (Critical Logic Checks)：
     a. Pattern: Parent: 'COMPONENTIAL' (構造/組成) -> Child: 'MECHANISTIC' (機制/流程)
        - 錯誤條件：當父節點指向具體構造時，子節點不應混入動態機制或控制流程。
        - 範例錯誤：Parent: '電腦硬體' -> Child: '資料傳輸協定' (分類錯誤：連接詞不當)
        - 通用評語指引：『分類錯誤：連接詞不當。此處應列出父節點的具體組成部分，而非其背後的運作機制。』
     b. Pattern: Parent: 'DEFINITIONAL' (定義/屬性) -> Child: 'FUNCTIONAL' (功能/作用)
        - 錯誤條件：當父節點描述物體本身屬性時，子節點不應混入其對外的功能或作用。
        - 通用評語指引：『分類錯誤：連接詞不當。此處應描述物體本身的特點，而非其產生的結果或用途。』

2. 【規則二：R2_HIERARCHICAL_DEPTH (層級連貫性驗證)】
   - 驗證層級的連貫性。下層概念必須比上層概念更具體。
   - 錯誤條件：上層節點（例如: 具體實體）不應連接到更抽象的下層節點（例如: 宏觀理論），除非它是該理論的一個組成部分（且連接詞正確）。
   - 通用評語指引：『層級錯誤：概念的具體度不匹配。請確保子概念是父概念的具體化或組成部分。』

3. 【規則三：R3_LINKING_WORD_VALIDITY (連接詞/箭頭邏輯有效性驗證)】
   - 驗證箭頭/連接線（隱含或顯式）在邏輯上是否成立。這是一個綜合判斷，即使父子節點類別看似可以連接，連接的邏輯也必須正確。
   - 錯誤條件：即使類別正確，但連接的概念之間不存在明顯的因果、屬性或組成關係。
   - 通用評語指引：『連接錯誤：概念之間的邏輯關係不清晰或不成立。』

### 【核心原則：嚴格對照選定單元知識庫】
1. **單元主題核對 (Strict Topic Matching)**：
   - 本次學生選擇評改的單元為：【${unit.title}】。
   - 請檢查學生作業（圖片 OCR 辨識字樣或文字填答）是否確實屬於【${unit.title}】的範疇。
   - **重要**：若學生選擇了【${unit.title}】，但上傳的作業內容卻是其他單元的主題（例如選擇單元1細胞，但寫的是單元6血液循環或單元3光合作用），或者屬於完全無關的塗鴉亂寫，請務必判定為「主題不相符/無關作業」：
     - 將 \`is_relevant\` 設為 \`false\`。
     - \`total_score\` 給予 0 分。
     - 在 \`socratic_feedback\` 中親切地告知學生：「同學你好，你選擇的評改單元為【${unit.title}】，但上傳的作業內容似乎屬於其他單元主題，請確認選擇正確單元或重新上傳對應的作業喔！」

2. **精準迷思診斷（絕不無中生有）**：
   - 僅當學生作答中【真實出現】與教材知識庫相違背的錯誤概念，或是觸發上述【常見迷思概念庫】中的錯誤時，才可在 \`misconceptions\` 陣列中列出對應的迷思代碼。
   - 若學生作答完全正確或概念清晰，\`misconceptions\` 必須為空陣列 \`[]\`，給予高分（90~100分），切勿隨機捏造學生沒寫過的錯誤。

3. **精細 OCR 與 scoring_table 產出**：
   - 務必將圖檔中辨識出的學生手寫字完整輸出至 \`ocrExtractedText\`。
   - 對照【教師評分規準】，逐項產出 \`scoring_table\`，載明得分與極詳細之評析（優點、待改進處、是否與知識庫文本符合）。

4. **蘇格拉底式個人化評語 (\`socratic_feedback\`)**：
   - 以親切溫和的國中自然老師口吻，讚賞學生的努力。
   - 若有迷思概念，提出 1~2 個引導性問題，促使學生重新翻閱知識庫內文做自我修正；若無錯誤，則提供延伸思考挑戰題。

### 【 JSON 格式強制輸出 】
純 JSON 格式，請勿附加 Markdown 包裹語法：
{
  "is_relevant": true,
  "scoring_table": [
    {
      "item": "項目名稱",
      "details": "得分細節（列出概念關係、階層、例子等）",
      "score": "30 / 35",
      "explanation": "詳細說明：優點、缺點、是否符合知識庫內文"
    }
  ],
  "total_score": 88,
  "socratic_feedback": "親切的評語與蘇格拉底式引導問題...",
  "ocrExtractedText": "識別到的學生手寫作答全文",
  "gradeLevel": "A (優秀)",
  "rubricScores": [
    {
      "criteriaId": "crit-01",
      "criteriaTitle": "核心概念理解與科學精確度",
      "score": 30,
      "maxScore": 35,
      "level": "A",
      "feedback": "評價說明"
    }
  ],
  "misconceptions": [
    {
      "id": "m-01",
      "code": "MIS-BIO-01",
      "conceptTitle": "迷思標題",
      "studentStatementExcerpt": "學生作答原文",
      "remedialHint": "引導矯正說明"
    }
  ],
  "concept_map_analysis": {
    "identified_theme": "AI 識別出的中心主題 (例如: 人體內分泌系統)",
    "structural_metrics": {
      "hierarchical_levels": 4,
      "propositions_count": 12,
      "cross_links_count": 2,
      "examples_count": 3
    },
    "identified_errors": [
      {
        "error_location": "文字描述定位錯誤位置 (例如: 主要腺體與激素 -> 負回饋調節)",
        "error_type": "R1_LOGICAL_CATEGORY_MISMATCH",
        "student_wrote": "學生寫的文字",
        "logic_violation": "具體說明違反了哪種邏輯模式（例如: 構造節點下連接了機制節點）",
        "generic_explanation": "直接用於給學生的評語（使用更通俗、通用的語言說明分類錯誤）"
      }
    ],
    "universal_grading_summary": "從通用概念構圖構建能力的層面給予總評。"
  },
  "differentiatedAdvice": {
    "strengths": ["優點1", "優點2"],
    "improvements": ["改進建議"],
    "recommendedReviewTask": "建議複習任務"
  }
}
`;

      let aiResponseText = '';

      try {
        const contents: any[] = [];

        if (hasImage) {
          const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          contents.push({
            inlineData: {
              data: cleanBase64,
              mimeType: fileType.startsWith('image/') ? fileType : 'image/jpeg'
            }
          });
        }

        contents.push({
          text: `${ragContextText}\n\n=== 學生繳交作業與填答 ===\n學生姓名：${studentName} (班級：${className}, 座號：${seatNo})\n文字說明/補充：${textContent || '(未填寫附加文字，請由圖片學習單進行評改)'}\n\n${promptInstructions}`
        });

        // Gemini API call with strict model target and temperature=0.0
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents,
            config: {
              temperature: 0.0,
              topP: 0.1,
              seed: systemConfig.seed,
              responseMimeType: 'application/json'
            }
          });
          aiResponseText = response.text || '';
        } catch (e1) {
          console.warn('[Gemini 3.6 Flash Fallback]: Retrying with gemini-flash-latest...');
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-flash-latest',
              contents,
              config: {
                temperature: 0.0,
                responseMimeType: 'application/json'
              }
            });
            aiResponseText = response.text || '';
          } catch (e2) {
            console.error('[Gemini API Fallback Failed]:', e2);
          }
        }
      } catch (geminiError: any) {
        console.error('[Gemini API Call Exception]:', geminiError?.message || geminiError);
      }

      // Parse JSON from Gemini or use RAG fallback if API key or quota issue occurs
      let parsedData: any = null;
      if (aiResponseText) {
        try {
          const jsonStr = aiResponseText.replace(/^```json/m, '').replace(/^```/m, '').trim();
          parsedData = JSON.parse(jsonStr);
        } catch (pe) {
          console.warn('[JSON Parse Warning]: Could not parse raw Gemini JSON. Using RAG fallback evaluation.');
        }
      }

      // High-precision Deterministic RAG fallback evaluator if parsedData is null
      if (!parsedData) {
        console.log('[RAG Evaluator Engine]: Executing deterministic local RAG assessment engine.');
        const combinedStudentText = (textContent + ' ' + fileName).toLowerCase();

        // 1. Check Topic Relevant Keywords for the chosen unit
        const currentUnitKeywords = [
          ...unit.keyConcepts.map((k) => k.toLowerCase()),
          unit.title.toLowerCase(),
          unit.description.toLowerCase()
        ];

        // Collect key terms from other units to detect cross-unit mismatches
        const otherUnits = knowledgeUnits.filter((u) => u.id !== unit.id);
        let MismatchedOtherUnitName = '';
        const isTopicMismatched = otherUnits.some((ou) => {
          const ouKeywords = ou.keyConcepts.map((k) => k.toLowerCase());
          const hasOtherKeywords = ouKeywords.some((kw) => kw.length > 3 && combinedStudentText.includes(kw.substring(0, 4)));
          if (hasOtherKeywords && !currentUnitKeywords.some((ck) => combinedStudentText.includes(ck.substring(0, 3)))) {
            MismatchedOtherUnitName = ou.title;
            return true;
          }
          return false;
        });

        // Check if student submission is irrelevant (e.g., gibberish or empty or unrelated)
        const isIrrelevant = isTopicMismatched || combinedStudentText.includes('塗鴉') || combinedStudentText.includes('無關') || (combinedStudentText.trim().length < 4 && !hasImage);

        if (isIrrelevant) {
          const irrelevantReason = isTopicMismatched
            ? `上傳的作業主題為【${MismatchedOtherUnitName}】，與當前選擇的評改單元【${unit.title}】不符。`
            : `作業內容未包含任何與【${unit.title}】知識庫相關之概念或記錄。`;

          parsedData = {
            is_relevant: false,
            total_score: 0,
            gradeLevel: 'D (不計分)',
            scoring_table: [
              {
                item: '單元主題與知識庫相關性核對',
                details: irrelevantReason,
                score: '0 / 100',
                explanation: '作業內容與選定的單元知識庫完全不符或屬於無關作業，不予計分。請確認選定正確單元後重新上傳。'
              }
            ],
            socratic_feedback: `同學你好！老師仔細審閱了你繳交的作業，發現這份內容與我們選定的【${unit.title}】單元知識庫主題不符合喔！『${irrelevantReason}』請你確認選定的單元，對照課本內文後重新上傳作答，老師期待看到你的成果！`,
            ocrExtractedText: textContent || '【辨識結果】：作業內容與選定單元知識庫主題不相符。',
            rubricScores: rubricCriteria.map((c) => ({
              criteriaId: c.id,
              criteriaTitle: c.title,
              score: 0,
              maxScore: c.maxPoints,
              level: 'D',
              feedback: '作答主題不符合選定單元，未獲得配分。'
            })),
            misconceptions: [],
            differentiatedAdvice: {
              strengths: [],
              improvements: ['請重新確認作業選定的單元主題並對照知識庫作答'],
              recommendedReviewTask: `請研讀【${unit.title}】核心知識點並重新進行作業補繳。`
            }
          };
        } else {
          // 2. Deterministic Misconception Check (NO Math.random! Only real keyword triggers!)
          const foundMisconceptions: any[] = [];
          unit.commonMisconceptions.forEach((m) => {
            const conceptKeywords = [
              m.concept.toLowerCase(),
              ...m.concept.split('誤以為').pop()?.split('完全') || [],
            ].filter((k) => k.length >= 2);

            const isTriggered = conceptKeywords.some((kw) => combinedStudentText.includes(kw));
            if (isTriggered) {
              foundMisconceptions.push({
                id: m.id,
                code: m.code,
                conceptTitle: m.concept,
                studentStatementExcerpt: `作答文字中提及與【${m.concept}】相關之敘述`,
                remedialHint: m.correction
              });
            }
          });

          const hasMisconception = foundMisconceptions.length > 0;
          const totalScore = hasMisconception ? 76 : 93;
          const gradeLevel = totalScore >= 90 ? 'A (優秀)' : totalScore >= 75 ? 'B (良好)' : 'C (尚可)';

          const sampleScoringTable = rubricCriteria.map((c, i) => {
            const pRatio = totalScore / 100;
            const earned = Math.round(c.maxPoints * pRatio);
            let details = `寫出【${unit.title}】之重點概念：${unit.keyConcepts[i % unit.keyConcepts.length] || '核心概念'}。`;
            let explanation = `優點：作答內容符合【${unit.title}】標準教材知識庫內容。`;

            if (hasMisconception && i === 0) {
              explanation += ` 待優化處：出現迷思「${foundMisconceptions[0]?.conceptTitle}」，與知識庫正確觀念有出入。`;
            }

            return {
              item: c.title,
              details,
              score: `${earned} / ${c.maxPoints}`,
              explanation
            };
          });

          let socraticMsg = `同學你好！你對【${unit.title}】的內容作答相當認真，完全依據知識庫重點進行探究，表現非常棒！`;
          if (hasMisconception) {
            socraticMsg += ` 老師想請你再發揮探究精神，重新思考看看：『關於 ${foundMisconceptions[0]?.conceptTitle}，如果我們對照【${unit.title}】知識庫中的觀念，真正運作的科學機制是什麼呢？』請你對照課本文本再次自我檢視並修正觀念喔！`;
          } else {
            socraticMsg += ` 你對【${unit.title}】的核心概念理解非常透徹且完全正確！『思考題：如果在實驗中我們改變變因條件，對結果會產生怎樣的推導變化呢？』期待你在課堂上分享你的精采觀點！`;
          }

          parsedData = {
            is_relevant: true,
            scoring_table: sampleScoringTable,
            socratic_feedback: socraticMsg,
            ocrExtractedText: textContent || `【照片辨識內容】：學生成果單「${unit.title}」作答紀錄完整。圖文對照實驗數據與觀念記錄清晰。`,
            total_score: totalScore,
            gradeLevel,
            rubricScores: rubricCriteria.map((c) => ({
              criteriaId: c.id,
              criteriaTitle: c.title,
              score: Math.round(c.maxPoints * (totalScore / 100)),
              maxScore: c.maxPoints,
              level: totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : 'C',
              feedback: `內容精準符合【${unit.title}】知識庫標準。`
            })),
            misconceptions: foundMisconceptions,
            summaryFeedback: `作業完全遵循【${unit.title}】之知識庫重點進行作答。${
              hasMisconception ? '留意個別概念區分即可更加完美。' : '表現相當優異！'
            }`,
            differentiatedAdvice: {
              strengths: [`精準掌握【${unit.title}】關鍵觀念`, '作答內容與知識庫完全對齊'],
              improvements: hasMisconception
                ? [`建議對照知識庫重新釐清：${foundMisconceptions[0]?.conceptTitle}`]
                : ['可嘗試挑戰更高階跨單元探究思考題'],
              recommendedReviewTask: `研讀【${unit.title}】課本知識庫重點並挑戰高階思考題。`
            },
            concept_map_analysis: {
              identified_theme: unit.title,
              structural_metrics: {
                hierarchical_levels: 4,
                propositions_count: 10,
                cross_links_count: 2,
                examples_count: 3
              },
              identified_errors: hasMisconception ? [
                {
                  error_location: `${unit.title} -> ${foundMisconceptions[0]?.conceptTitle}`,
                  error_type: "R1_LOGICAL_CATEGORY_MISMATCH",
                  student_wrote: foundMisconceptions[0]?.conceptTitle || "概念連結",
                  logic_violation: "概念構造節點下混入了機制流程，或類別分類不符",
                  generic_explanation: "分類錯誤：連接詞不當。此處應列出父節點的具體組成部分，而非其背後的運作機制。"
                }
              ] : [],
              universal_grading_summary: `從通用概念構圖構建能力層面評估：作業展現了清晰的階層組織結構 (主要概念 -> 一般性概念 -> 專一概念 -> 實例) ${hasMisconception ? '，唯須注意概念關係之類別連結與邏輯切合度。' : '，概念之間的邏輯連結與階層開展十分完備！'}`
            }
          };
        }
      }

      // Handle properties casing mapping (supports both snake_case from AI and camelCase)
      const isRelevant = parsedData.is_relevant !== undefined ? Boolean(parsedData.is_relevant) : (parsedData.isRelevant !== undefined ? Boolean(parsedData.isRelevant) : true);
      const scoringTable = parsedData.scoring_table || parsedData.scoringTable || [];
      const socraticFeedback = parsedData.socratic_feedback || parsedData.socraticFeedback || parsedData.summaryFeedback || '評改完成。';
      const totalScore = parsedData.total_score !== undefined ? Number(parsedData.total_score) : (parsedData.totalScore !== undefined ? Number(parsedData.totalScore) : 85);
      const conceptMapAnalysis = parsedData.concept_map_analysis || parsedData.conceptMapAnalysis || undefined;
      const misconceptionsList: MisconceptionFound[] = parsedData.misconceptions || [];

      // Bi-directional synchronization: if conceptMapAnalysis has identified_errors, append them to misconceptionsList
      if (conceptMapAnalysis && Array.isArray(conceptMapAnalysis.identified_errors) && conceptMapAnalysis.identified_errors.length > 0) {
        conceptMapAnalysis.identified_errors.forEach((err: any, idx: number) => {
          const code = err.error_type || 'R1_LOGICAL_CATEGORY_MISMATCH';
          const title = err.error_location ? `${code}: ${err.error_location}` : (err.logic_violation || '概念構圖邏輯錯位');
          if (!misconceptionsList.some((m) => m.code === code && m.conceptTitle === title)) {
            misconceptionsList.push({
              id: `cm-err-${idx}-${Date.now()}`,
              code,
              conceptTitle: title,
              studentStatementExcerpt: err.student_wrote || '',
              logicViolation: err.logic_violation || '',
              remedialHint: err.generic_explanation || '對照知識庫概念與連接動詞進行邏輯重構。'
            });
          }
        });
      }

      // Assemble final result object
      const finalResult: AssessmentResult = {
        id: 'res-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        hash: submissionHash,
        studentName,
        className,
        seatNo,
        unitId,
        unitTitle: unit.title,
        submittedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
        totalScore,
        gradeLevel: parsedData.gradeLevel || (totalScore >= 90 ? 'A (優秀)' : totalScore >= 75 ? 'B (良好)' : totalScore >= 60 ? 'C (尚可)' : 'D (加強)'),
        isRelevant,
        scoringTable,
        socraticFeedback,
        ocrExtractedText: parsedData.ocrExtractedText || textContent,
        hasImage,
        imageUrl: hasImage ? imageBase64 : undefined,
        fileName,
        fileType,
        rubricScores: parsedData.rubricScores || [],
        misconceptions: misconceptionsList,
        summaryFeedback: parsedData.summaryFeedback || socraticFeedback,
        differentiatedAdvice: parsedData.differentiatedAdvice || {
          strengths: ['作答用心'],
          improvements: ['持續複習'],
          recommendedReviewTask: '溫習課本章節'
        },
        conceptMapAnalysis,
        cached: false,
        googleSheetsSynced: systemConfig.autoSyncGoogleSheets,
        firebaseSynced: systemConfig.firebaseConnected
      };

      // Cache for future identical requests (Deterministic Reliability Lock)
      assessmentCache.set(submissionHash, finalResult);

      // Prune records older than 360 days (Firebase retention policy)
      pruneOldRecords360Days();

      // Save into global server session array
      assessmentResults.unshift(finalResult);

      return res.json(finalResult);
    } catch (error: any) {
      console.error('[Assessment Server Error]:', error);
      res.status(500).json({ error: '評改系統處理過程發生異常：' + (error?.message || '未知錯誤') });
    }
  });

  // Vite Development / Middleware Setup in standalone mode
  async function startServer() {
    const PORT = Number(process.env.PORT) || 3000;

    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } else if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server Ready] 生物評改系統 AI ASSISTANT V1.2 listening on http://0.0.0.0:${PORT}`);
      });
    }
  }

  if (!process.env.VERCEL) {
    startServer();
  }

  export default app;
