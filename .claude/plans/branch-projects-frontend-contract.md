# عقد الواجهة — تأسيس الفروع (المرحلة 1، واجهة فقط)

قرارات المالك: الفرع يُنشأ لاحقاً من صفحة الفروع (المشروع لا ينشئ فرعاً)؛ التكاليف عبر فواتير المشتريات؛ ميزانية لكل قسم + ميزانية إجمالية للمشروع؛ المعدات مصروف تأسيس؛ إيجار ما قبل الافتتاح ضمن المشروع.
**لا تعديل في الخلفية في هذه المرحلة.** الهوكس تستهدف `/api/accounting/branch-projects` لكنها تعمل الآن على مخزن محلي (mock في localStorage) عبر ثابت `BRANCH_PROJECTS_MOCK = true` داخل الهوكس.

## أشكال البيانات (JS objects، التواريخ `YYYY-MM-DD`، المبالغ أرقام)
```
Project {
  id:number, code:"BP-001", name, city, district, address, area_sqm:number|null,
  status:'planning'|'in_progress'|'on_hold'|'opened'|'cancelled',
  contract_signed_date, target_opening_date, actual_opening_date:null|date,
  budget_total:number, manager_employee_id:null|number, manager_name:string,
  lease_contract_id:null|number, lease_contract_number:string, notes, cover_url:null|string,
  created_at, updated_at,
  phases:Phase[], tasks:Task[], invoices:ProjectInvoice[], updates:Update[], attachments:Attachment[]
}
Phase { id, project_id, name, sort_order, planned_start, planned_end, actual_start:null|date, actual_end:null|date,
  status:'not_started'|'in_progress'|'done'|'blocked', budget:number, weight:number(1 افتراضي),
  progress_override:null|number(0-100), owner_employee_id:null, owner_name:string,
  contractor_contact_id:null, contractor_name:string, color:string(hex), notes }
Task { id, project_id, phase_id, title, status:'todo'|'in_progress'|'done'|'blocked', is_milestone:boolean,
  due_date:null|date, done_at:null|date, assignee_employee_id:null, assignee_name:string, sort_order, notes }
ProjectInvoice { id, invoice_number, invoice_date, due_date, supplier_name, phase_id:null|number,
  expense_account_code:'5306', expense_account_name, total_amount, paid_amount,
  status:'pending_payment'|'partial_paid'|'paid'|'overdue', source:'manual'|'lease' }
Update { id, project_id, phase_id:null|number, body, photos:string[], created_by_name, created_at }
Attachment { id, project_id, phase_id:null|number, url, label, kind:'contract'|'permit'|'design'|'quote'|'photo'|'other', created_by_name, created_at }
```

## الملفات والملكية
| الوكيل | يملك |
|---|---|
| A (البيانات) | `src/utils/branchProjectMath.js`, `test/branchProjectMath.test.js`, `src/utils/branchProjectsMock.js`, `src/hooks/useBranchProjects.js`, إضافة مفاتيح في `src/utils/queryKeys.js` |
| B (الصفحات) | `src/app/accounting/branch-projects/page.jsx`, `src/app/accounting/branch-projects/[id]/page.jsx`, `src/components/Accounting/BranchProjects/ProjectsListPanel.jsx`, `ProjectHeader.jsx`, `ProjectTimeline.jsx`, `OverviewTab.jsx`, تعديل `src/components/Accounting/Sidebar.jsx` (عنصر «تأسيس الفروع») |
| C (التبويبات والنوافذ) | `src/components/Accounting/BranchProjects/PhasesTab.jsx`, `ExpensesTab.jsx`, `UpdatesTab.jsx`, `AttachmentsTab.jsx`, `SettingsTab.jsx`, `ProjectModal.jsx`, `PhaseModal.jsx`, `TaskModal.jsx`, `ExpenseModal.jsx`, `UpdateComposer.jsx` |
| مشترك (جاهز) | `src/components/Accounting/BranchProjects/shared.jsx` — لا يعدّله أحد |

## `src/utils/branchProjectMath.js` (A) — صادرات ثابتة
- ثوابت: `PROJECT_STATUSES`, `PROJECT_STATUS_LABELS`, `PHASE_STATUSES`, `PHASE_STATUS_LABELS`, `TASK_STATUSES`, `TASK_STATUS_LABELS`, `ATTACHMENT_KINDS`, `ATTACHMENT_KIND_LABELS`, `HEALTH_LABELS` ({done:'مكتمل',on_track:'في المسار',at_risk:'في خطر',late:'متأخر',not_started:'لم يبدأ'}), `INVOICE_STATUS_LABELS`.
- `ESTABLISHMENT_ACCOUNTS`: `[{code:'5301',name:'إيجار ما قبل الافتتاح'},{5302:'تراخيص ورسوم حكومية'},{5303:'تصميم واستشارات'},{5304:'ديكور وتشطيب'},{5305:'كهرباء وسباكة وتكييف'},{5306:'معدات'},{5307:'أثاث ولوحات'},{5308:'أنظمة وتقنية'},{5309:'رواتب وتدريب ما قبل الافتتاح'},{5310:'تسويق الافتتاح'},{5399:'أخرى'}]`.
- `DEFAULT_PHASE_TEMPLATE`: 11 قسماً `{key,name,color,default_account_code,tasks:[{title,is_milestone}]}` بالترتيب: العقد والإيجار، التراخيص والتصاريح، التصميم والمخططات، الديكور والتشطيب، الكهرباء والسباكة والتكييف، المعدات، الأثاث واللوحات، الأنظمة (POS وكاميرات وإنترنت)، التوظيف والتدريب، المخزون الافتتاحي، التسويق والافتتاح. مع معالم: تسليم الموقع، اكتمال التشطيب، تركيب المعدات، الافتتاح التجريبي، الافتتاح.
- `phaseTasks(project, phaseId)` → Task[]
- `phaseProgress(phase, tasks)` → 0..100 (override أولاً؛ وإلا done/total؛ لا مهام → status done=100 / in_progress=50 / غير ذلك 0)
- `projectProgress(project)` → مرجّح بـ weight
- `phaseHealth(phase, tasks, today)` → 'done'|'not_started'|'on_track'|'at_risk'|'late' (late: planned_end < today وغير مكتمل؛ at_risk: المتبقي < 20% من المدة والتقدم < 60%)
- `projectHealth(project, today)` → أسوأ صحة بين الأقسام غير المكتملة، أو 'done' إن افتُتح
- `daysToOpening(project, today)` → عدد (سالب = تجاوز)
- `phaseBudget(phase, invoices)` → `{budget, committed, paid, remaining, over, pct}`
- `projectBudget(project)` → `{budget_total, phases_budget, unallocated, committed, paid, remaining, over, pct}`
- `invoiceStatus(inv, today)` → مشتق من paid/total/due
- `timelineRange(project, today)` → `{start, end, months:[{key,label,left_pct,width_pct}], today_pct|null}`
- `barPosition(start, end, rangeStart, rangeEnd)` → `{left_pct, width_pct}`
- `buildPhasesFromTemplate(template, contractDate, targetOpening)` → Phase[] بلا id، مواعيد موزعة بالتساوي (آخر قسم ينتهي يوم الافتتاح)
- `nextProjectCode(projects)` → 'BP-00N'
- `summarizeProjects(projects, today)` → `{active_count, budget_total, committed_total, paid_total, nearest_opening:{project_id,name,days}|null, late_phases}`
- مساعدات التاريخ: `todayRiyadh()`, `addDays(key, n)`, `daysBetween(a,b)`, `formatDateKey`.

## `src/hooks/useBranchProjects.js` (A)
`const BASE = "/api/accounting/branch-projects"; export const BRANCH_PROJECTS_MOCK = true;`
- `useBranchProjects({employeeId, isAdmin})` → `{data: Project[]}`
- `useBranchProject(id)` → `{data: Project}`
- `useCreateBranchProject()` body `{name, city, district, address, area_sqm, contract_signed_date, target_opening_date, budget_total, manager_name, lease_contract_id, lease_contract_number, notes, template:'default'|'empty'}` → يعيد Project
- `useUpdateBranchProject()` `{id, ...fields}`
- `useDeleteBranchProject()` `{id}`
- `useOpenBranchProject()` `{id, actual_opening_date, force?}` (يرفض بـ error.code='milestones_pending' إن بقيت معالم غير مكتملة و!force)
- `useSaveBranchProjectPhase()` `{project_id, id?, ...Phase}`; `useDeleteBranchProjectPhase()` `{project_id, id}`; `useReorderBranchProjectPhases()` `{project_id, ids:number[]}`
- `useSaveBranchProjectTask()` `{project_id, id?, ...Task}`; `useDeleteBranchProjectTask()` `{project_id, id}`
- `useAddBranchProjectUpdate()` `{project_id, phase_id, body, photos}`; `useDeleteBranchProjectUpdate()` `{project_id, id}`
- `useAddBranchProjectAttachment()` `{project_id, phase_id, url, label, kind}`; `useDeleteBranchProjectAttachment()` `{project_id, id}`
- `useSaveBranchProjectInvoice()` `{project_id, id?, invoice_number, invoice_date, due_date, supplier_name, phase_id, expense_account_code, total_amount, paid_amount}` (mock فقط — لاحقاً يُستبدل بنافذة فاتورة المشتريات)؛ `useDeleteBranchProjectInvoice()` `{project_id, id}`
- كل الطفرات: `onSuccess` تبطل `queryKeys.branchProjects()` و`queryKeys.branchProject(id)` وتعرض `toast.success` بالعربية؛ `onError` → `toast.error`.
- mock: `src/utils/branchProjectsMock.js` يخزّن في `localStorage['branchProjects.mock.v1']`، يبدأ بمشروعين عيّنة (فرع الواحة — الدمام، افتتاح 2026-11-11، قيد التنفيذ بتقدم جزئي وفواتير؛ فرع الملقا — الرياض، تخطيط). واجهة: `mockApi.list()`, `get(id)`, `create(body)`, `update(id, body)`, `remove(id)`, `open(id, body)`, `savePhase`, `deletePhase`, `reorderPhases`, `saveTask`, `deleteTask`, `addUpdate`, `deleteUpdate`, `addAttachment`, `deleteAttachment`, `saveInvoice`, `deleteInvoice` — كلها async وتعيد نسخاً جديدة.
- queryKeys: `branchProjects: createKey("branchProjects")`, `branchProject: createKey("branchProject")` (الاستخدام `queryKeys.branchProject(id)`).

## `shared.jsx` (جاهز) صادرات
`formatMoney(v, withCurrency=true)`, `formatDate(key)`, `moneyValue(v)`, `SummaryCard({label,value,icon,tone,suffix})`, `EmptyState({icon,title,hint,action})`, `StatusPill({status})` (حالات المشروع), `PhaseStatusPill({status})`, `HealthPill({health})`, `ProgressBar({pct,tone,className})`, `ProgressRing({pct,size})`, `SectionCard({title,icon,description,action,children,className})`, `ModalShell({open,title,onClose,children,footer,width})` (createPortal, RTL, dark/light), `ConfirmButton`؟ لا — استخدم `window.confirm`.

## الصفحات (B)
- `/accounting/branch-projects/page.jsx`: shell مثل `src/app/accounting/purchases/page.jsx` (AccountingSidebar active="branch-projects"، هيدر جوال/سطح مكتب، `useWorkspaceUser`، حارس: Admin و`can_manage_accounting !== false`). يعرض `ProjectsListPanel`.
- `/accounting/branch-projects/[id]/page.jsx`: نفس shell؛ `useParams()` من react-router؛ تبويبات عبر `?tab=overview|phases|expenses|updates|attachments|settings`؛ `ProjectHeader` + التبويب. يستورد تبويبات C بالأسماء أدناه.
- `ProjectsListPanel({employeeId, isAdmin})`: KPIs (`summarizeProjects`)، فلتر حالة، بطاقات المشاريع (رابط `/accounting/branch-projects/{id}`)، زر «مشروع جديد» يفتح `ProjectModal` (من C).
- `ProjectHeader({project, onOpen, onEdit})`: الاسم/الكود/المدينة، StatusPill، HealthPill، عد تنازلي، ProgressRing، ميزانية/ملتزم/مسدد، زر «تأكيد الافتتاح» (يفتح نافذة تاريخ + تحذير معالم).
- `ProjectTimeline({project, onSelectPhase})`: Gantt بـ CSS grid: أعمدة أشهر من `timelineRange`، صف لكل قسم: شريط مخطط فاتح وشريط فعلي غامق بلون القسم، خط اليوم، معالم كمعينات على تاريخ استحقاقها، نقرة = onSelectPhase. على الجوال (< md) قائمة أقسام بشريط تقدم.
- `OverviewTab({project, onSelectPhase})`: Timeline + بطاقة تنبيهات (أقسام متأخرة، تجاوز ميزانية، مهام مستحقة خلال 7 أيام، معالم قادمة) + آخر 5 تطورات.
- Sidebar: صف `{ key:"branch-projects", href:"/accounting/branch-projects", icon: Building2 (lucide), label:"تأسيس الفروع" }` بعد «المشتريات» + PAGE_TITLES.
- شريط «وضع تجريبي: البيانات محفوظة في هذا المتصفح فقط حتى ربط الخلفية» يظهر إذا `BRANCH_PROJECTS_MOCK`.

## التبويبات والنوافذ (C) — واجهات الخصائص
- `PhasesTab({project, selectedPhaseId, onSelectPhase})`: بطاقة لكل قسم (اسم، تواريخ مخطط/فعلي، مسؤول، مقاول، ميزانية مقابل فعلي بشريط، HealthPill، تقدم)، قائمة مهام داخلها (checkbox يبدّل todo/done، معلم بأيقونة Flag، مهلة، مسؤول، تعديل/حذف)، أزرار: «+ مهمة»، «تعديل القسم»، «حذف»، أسهم إعادة ترتيب. «+ قسم».
- `ExpensesTab({project})`: ملخص الميزانية (projectBudget)، جدول «الميزانية مقابل الفعلي» لكل قسم، جدول الفواتير (رقم، تاريخ، مورد، قسم، حساب، إجمالي، مسدد، حالة) مع فلاتر قسم/حساب/حالة، زر «+ فاتورة» → `ExpenseModal`، تصدير Excel/PDF عبر `src/utils/exportUtils` (`exportToExcelHTML(rows, filename, columns, title)` و`exportToPDF`)، رسم دائري حسب الحساب بـ recharts (استورد من `recharts`؛ انظر `src/components/Accounting/ExpensesCharts.jsx` للنمط والألوان).
- `UpdatesTab({project})`: `UpdateComposer` (نص + قسم اختياري + رفع صور عبر `useUpload` من `src/utils/useUpload.js`: `const [upload,{loading}] = useUpload(); const {url,error} = await upload({file, unoptimized:true})`) + خط زمني للتطورات (تاريخ، كاتب، قسم، نص، صور مصغرة) + حذف.
- `AttachmentsTab({project})`: مجموعات حسب kind، إضافة (رفع ملف + تسمية + نوع + قسم)، فتح، حذف.
- `SettingsTab({project})`: نموذج تعديل بيانات المشروع (يفتح `ProjectModal` بوضع تعديل أو نموذج مضمّن)، تغيير الحالة (تخطيط/تنفيذ/متوقف/ملغى)، حذف المشروع (confirm) ثم `navigate('/accounting/branch-projects')`.
- `ProjectModal({open, project|null, onClose})`: اسم، مدينة، حي، عنوان، مساحة، تاريخ توقيع العقد، موعد الافتتاح المستهدف، الميزانية الإجمالية، مدير المشروع (نص)، رقم عقد الإيجار (نص)، ملاحظات، قالب الأقسام (افتراضي/فارغ) عند الإنشاء فقط. يستدعي الهوكس بنفسه.
- `PhaseModal({open, project, phase|null, onClose})`، `TaskModal({open, project, phaseId, task|null, onClose})`، `ExpenseModal({open, project, invoice|null, defaultPhaseId, onClose})` (الحساب من `ESTABLISHMENT_ACCOUNTS`).
- التواريخ: `GlassDatePicker` من `@/components/Workspace/GlassDatePicker` (`{value,onChange,placeholder,allowClear}`)؛ القوائم: `GlassSelect` (`{value,onChange,options:[{value,label}],placeholder}`).

## قواعد عامة
- ثيم: `import { ws } from "@/components/Workspace/uiPurchases"`؛ RTL؛ ألوان نص صريحة للوضعين (`text-slate-900 dark:text-white`)؛ شبكات الجوال `grid-cols-1`.
- أيقونات lucide-react؛ toasts من `sonner`.
- ممنوع `queryKey: [` مضمّن (اختبار يمنعه) — استخدم `queryKeys.*`.
- لا تعديل لأي ملف تحت `src/app/api`.
- بعد الانتهاء: `bun run typecheck` يجب أن يمر؛ لا تشغّل `bun run build` (أشغّله أنا).
