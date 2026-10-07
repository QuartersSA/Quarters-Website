# عقد الخلفية — تأسيس الفروع (المرحلة 2)

الواجهة جاهزة ومدموجة (PR #188). الخلفية يجب أن تعيد نفس أشكال البيانات في
`.claude/plans/branch-projects-frontend-contract.md` حرفياً، وتطابق مسارات الهوكس في
`src/hooks/useBranchProjects.js` (real mode). بعد الربط يُقلب `BRANCH_PROJECTS_MOCK = false`.

قرارات المالك: الفرع يُنشأ لاحقاً من صفحة الفروع (الافتتاح لا ينشئ فرعاً)؛ التكاليف عبر فواتير
المشتريات فقط؛ ميزانية لكل قسم + إجمالي للمشروع؛ المعدات مصروف تأسيس (مجموعة 53)؛ إيجار ما قبل
الافتتاح ضمن المشروع. الصلاحية: Admin مع can_manage_accounting أو can_manage_purchases.

## الملكية
| الوكيل | يملك |
|---|---|
| D (المخطط والمحمّلات) | `src/app/api/utils/branchProjects.js` (جديد) |
| E (المسارات) | كل الملفات تحت `src/app/api/accounting/branch-projects/` (جديد) |
| F (الدمج) | `src/app/api/accounting/purchase-invoices/route.js`, `src/app/api/utils/leaseContracts.js` (parseContractInput + أعمدة), `src/app/api/accounting/lease-contracts/route.js` و`[id]/route.js` (كتابة project_id), `src/app/api/utils/leaseSetAsideInvoices.js`, `src/components/Accounting/PurchaseInvoiceModal.jsx`, `PurchasesInvoicesPanel.jsx`, `LeaseContractModal.jsx`, `src/hooks/useBranchProjects.js` (قلب المفتاح فقط), `src/components/Accounting/BranchProjects/ExpensesTab.jsx` و`ExpenseModal.jsx`, `.claude/architecture.md` |

## D — `src/app/api/utils/branchProjects.js` صادرات ثابتة
```js
export const REQUIRE_BRANCH_PROJECTS = { anyOf: [
  { role: "Admin", permission: "can_manage_accounting" },
  { role: "Admin", permission: "can_manage_purchases" } ] };
export const ensureBranchProjectsSchema = ensureOnce(impl);   // من "@/app/api/utils/ensureOnce"
export async function ensureProjectInvoiceLinkColumns();       // يضيف project_id/project_phase_id لفواتير المشتريات إن وُجد الجدول (+فهرس)؛ يعيد boolean
export async function ensureEstablishmentAccounts();           // مجموعة 53 + الأبناء؛ يعيد Map(code → id)
export async function getEstablishmentAccountId(code);         // id الحساب (ينشئه إن غاب)؛ code غير معروف → 5399
export async function listProjects();                          // Project[] (مع phases, tasks, invoices؛ updates=[] attachments=[] للخفة)
export async function loadProject(id);                         // Project كامل أو null
export async function nextProjectCode();                       // "BP-00N" من أعلى رقم موجود
export function parseProjectInput(body, existing = null);      // يعيد {value, error}
export function parsePhaseInput(body, existing = null);        // {value, error}
export function parseTaskInput(body, existing = null);         // {value, error} (done → done_at اليوم، غير ذلك null)
export async function createProjectWithTemplate(value, { template, actor }); // معاملة واحدة؛ يعيد id
export async function pendingMilestones(projectId);            // [titles] لمعالم غير مكتملة
export async function logProjectAudit({ projectId, action, summary, actor }); // logPurchaseAudit(entityType "branch_project")
export function mapInvoiceRow(row, today);                     // صف SQL → ProjectInvoice
```
### الجداول (CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS، توقيت Riyadh مثل بقية النظام)
- `branch_projects`: `id SERIAL PK, code TEXT, name TEXT NOT NULL, city TEXT, district TEXT, address TEXT, area_sqm NUMERIC(10,2), status TEXT NOT NULL DEFAULT 'planning', contract_signed_date DATE, target_opening_date DATE, actual_opening_date DATE, budget_total NUMERIC(14,2) NOT NULL DEFAULT 0, manager_employee_id INTEGER, manager_name TEXT, lease_contract_id INTEGER, lease_contract_number TEXT, branch_id INTEGER, notes TEXT, cover_url TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at, updated_at, created_by_employee_id INTEGER, created_by_employee_name TEXT`
- `branch_project_phases`: `id SERIAL PK, project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, planned_start DATE, planned_end DATE, actual_start DATE, actual_end DATE, status TEXT NOT NULL DEFAULT 'not_started', budget NUMERIC(14,2) NOT NULL DEFAULT 0, weight NUMERIC(6,2) NOT NULL DEFAULT 1, progress_override NUMERIC(5,2), owner_employee_id INTEGER, owner_name TEXT, contractor_contact_id INTEGER, contractor_name TEXT, color TEXT, template_key TEXT, default_account_code TEXT, notes TEXT, created_at, updated_at` + index (project_id, sort_order)
- `branch_project_tasks`: `id SERIAL PK, project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE, phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'todo', is_milestone BOOLEAN NOT NULL DEFAULT FALSE, due_date DATE, done_at DATE, done_by_employee_name TEXT, assignee_employee_id INTEGER, assignee_name TEXT, sort_order INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at, updated_at` + index (project_id, phase_id)
- `branch_project_updates`: `id SERIAL PK, project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE, phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE SET NULL, body TEXT NOT NULL, photos JSONB NOT NULL DEFAULT '[]'::jsonb, created_by_employee_id INTEGER, created_by_name TEXT, created_at`
- `branch_project_attachments`: `id SERIAL PK, project_id … CASCADE, phase_id … SET NULL, url TEXT NOT NULL, label TEXT, kind TEXT NOT NULL DEFAULT 'other', created_by_employee_id INTEGER, created_by_name TEXT, created_at`
- على `accounting_purchase_invoices` (إن وُجد الجدول): `project_id INTEGER, project_phase_id INTEGER` + `CREATE INDEX IF NOT EXISTS idx_purchase_invoices_project ON accounting_purchase_invoices (project_id)`.
- على `accounting_lease_contracts` (إن وُجد): `project_id INTEGER`.
- الحسابات: أب `53 تكاليف تأسيس الفروع` (`Branch Establishment Costs`, expense, parent = الحساب code '5', is_postable FALSE, is_system TRUE) وأبناء من `ESTABLISHMENT_ACCOUNTS` في `@/utils/branchProjectMath` (5301…5399، expense، postable، is_system TRUE). البحث بالكود النشط أولاً ثم بالاسم تحت الأب.

### شكل Project المعاد من loadProject/listProjects
نفس عقد الواجهة. التواريخ `TO_CHAR(..., 'YYYY-MM-DD')`، الأرقام `Number(...)`، `updated_at/created_at` ISO. `phases` مرتبة بـ sort_order ثم id؛ `tasks` بـ phase_id, sort_order, id؛ `updates` الأحدث أولاً؛ `attachments` الأحدث أولاً.
`invoices`: من `accounting_purchase_invoices inv LEFT JOIN accounting_accounts acc ON acc.id = inv.expense_account_id LEFT JOIN accounting_contacts c ON c.id = inv.contact_id` حيث `inv.project_id = $id AND inv.is_active = TRUE`، مرتبة invoice_date DESC, id DESC، `mapInvoiceRow` →
`{ id, invoice_number, invoice_date, due_date, supplier_name: COALESCE(c.name, inv.supplier_name), phase_id: inv.project_phase_id, expense_account_code: acc.code, expense_account_name: acc.name, total_amount, paid_amount, status: paid>=total→'paid' | paid>0→'partial_paid' | due_date<today→'overdue' | 'pending_payment', source: lease_contract_id IS NOT NULL ? 'lease' : 'manual', lease_contract_id, lease_month }`.

### parseProjectInput قواعد
name مطلوب، city مطلوب، contract_signed_date و target_opening_date مطلوبان وصالحان و target ≥ contract، budget_total ≥ 0، status من PROJECT_STATUSES (الافتراضي planning عند الإنشاء؛ لا يُقبل 'opened' عبر PUT — يُتجاهل)، area_sqm رقم أو null، manager_name/lease_contract_number/notes نصوص، lease_contract_id رقم أو null. parsePhaseInput/parseTaskInput تطابق `normalizePhaseInput`/`normalizeTaskInput` في `src/utils/branchProjectsMock.js` (انسخ الدلالات حرفياً: weight افتراضي 1، color افتراضي '#64748b'، done_at…).

## E — المسارات تحت `src/app/api/accounting/branch-projects/`
كل handler: `const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS); if (!auth.ok) return Response.json({error: auth.error}, {status: auth.status});` ثم `await ensureBranchProjectsSchema();` (اختبار `apiAuthAudit` يفرض وجود `requireAuth(` في كل handler مُصدَّر). المعرفات من `params` (`parseId`). الأخطاء: 400 مع `{error}` عربي، 404 `{error:"المشروع غير موجود"}`, 409 مع `code`. كل كتابة تُسجَّل بـ `logProjectAudit`.
| ملف | handlers | يعيد |
|---|---|---|
| `route.js` | GET → `{projects: listProjects()}`; POST (body = ProjectModal + `template: 'default'|'empty'`) → 201 `{project}` (createProjectWithTemplate ثم loadProject) | |
| `[id]/route.js` | GET `{project}`; PUT (حقول جزئية؛ parseProjectInput مع existing) `{project}`; DELETE: `UPDATE accounting_purchase_invoices SET project_id=NULL, project_phase_id=NULL WHERE project_id=$id` (إن وُجدت الأعمدة) ثم `UPDATE accounting_lease_contracts SET project_id=NULL …` ثم `DELETE FROM branch_projects` → `{ok:true}` | |
| `[id]/open/route.js` | POST `{actual_opening_date, force}`: 400 إن التاريخ غير صالح؛ إن `pendingMilestones` غير فارغ و!force → 409 `{error:"توجد معالم غير مكتملة", code:"milestones_pending", pending:[...]}`؛ وإلا `status='opened', actual_opening_date` → `{project}` | |
| `[id]/phases/route.js` | POST (parsePhaseInput؛ sort_order = max+1) → 201 `{ok:true, phase}` | |
| `[id]/phases/reorder/route.js` | POST `{ids:number[]}` → يكتب sort_order = index (فقط لأقسام هذا المشروع) → `{ok:true}` | |
| `[id]/phases/[phaseId]/route.js` | PUT → `{ok:true, phase}`; DELETE: 409 `code:"has_invoices"` إن `accounting_purchase_invoices.project_phase_id = phaseId` موجودة؛ وإلا يحذف (المهام CASCADE، updates/attachments SET NULL) → `{ok:true}` | |
| `[id]/tasks/route.js` | POST (parseTaskInput؛ phase_id يجب أن يخص المشروع؛ sort_order max+1) → 201 `{ok:true, task}` | |
| `[id]/tasks/[taskId]/route.js` | PUT → `{ok:true, task}` (عند done يسجّل done_by_employee_name = auth.user.name); DELETE → `{ok:true}` | |
| `[id]/updates/route.js` | POST `{phase_id, body, photos[]}` (body مطلوب؛ photos مصفوفة روابط نصية ≤ 20) → 201 `{ok:true, update}` | |
| `[id]/updates/[updateId]/route.js` | DELETE → `{ok:true}` | |
| `[id]/attachments/route.js` | POST `{phase_id, url, label, kind}` (url مطلوب؛ kind من ATTACHMENT_KINDS وإلا 'other') → 201 `{ok:true, attachment}` | |
| `[id]/attachments/[attachmentId]/route.js` | DELETE → `{ok:true}` | |
| `[id]/invoices/route.js` | POST **ربط فاتورة موجودة** `{invoice_id, phase_id}`: 404 إن الفاتورة غير موجودة/غير نشطة؛ 409 `code:"linked_elsewhere"` إن مرتبطة بمشروع آخر؛ يكتب project_id/project_phase_id + audit على الفاتورة (`logPurchaseAudit` entityType "invoice") → `{ok:true, invoice: mapInvoiceRow}` | |
| `[id]/invoices/[invoiceId]/route.js` | PUT `{phase_id?, expense_account_code?}`: يحدّث project_phase_id؛ وإن أُعطي code → `getEstablishmentAccountId(code)` ويحدّث `expense_account_id` على الرأس و`account_id` على كل بنودها → `{ok:true, invoice}`; DELETE: إن `source==='lease'` → 409 `code:"lease_invoice"` («فاتورة استقطاع إيجار — تُدار من العقد»)؛ وإلا `hardDeletePurchaseInvoices([invoiceId], {actor, reason})` من `@/app/api/utils/purchaseInvoiceDelete` → `{ok:true}` | |
ملاحظة بناء المسارات: المجلد الثابت `phases/reorder` يجب أن يُسجَّل قبل `phases/[phaseId]` — المولّد يرتب المسارات الأطول/الثابتة أولاً (راجع `src/app/routes.ts`)؛ تحقق بعد البناء أن `reorder` لا يُلتقط كـ `:phaseId`.

## F — الدمج
1. **فواتير المشتريات** (`purchase-invoices/route.js`): داخل `ensureSchemaImpl` استدعِ `ensureProjectInvoiceLinkColumns()` (استيراد من `@/app/api/utils/branchProjects`) بنفس أسلوب أعمدة الإيجار؛ في SELECT القائمة أضف `inv.project_id, inv.project_phase_id, bp.name AS project_name, bp.code AS project_code, bpp.name AS project_phase_name` مع `LEFT JOIN branch_projects bp ON bp.id = inv.project_id LEFT JOIN branch_project_phases bpp ON bpp.id = inv.project_phase_id`؛ `createPurchaseInvoice` يقرأ `project_id`/`project_phase_id` من body (رقم أو null؛ تحقق أن المشروع موجود وأن القسم يخصه؛ وإلا 400) ويكتبهما في INSERT؛ مسار PUT للفاتورة يحدّثهما أيضاً.
2. **نافذة الفاتورة** `PurchaseInvoiceModal.jsx`: حقلا «مشروع تأسيس» (GlassSelect من `useBranchProjects` — المشاريع غير opened/cancelled) و«القسم» (أقسام المشروع المختار)؛ عند اختيار قسم له `default_account_code` اضبط حساب البند الأول تلقائياً إن كان فارغاً؛ تمرير `project_id`/`project_phase_id` في الحمولة؛ دعم prop `prefill = {project_id, project_phase_id, expense_account_code}`؛ عرض الحقلين في وضع التعديل بقيم الفاتورة. الحقلان يظهران فقط إن وُجد مشروع نشط.
3. **قائمة الفواتير** `PurchasesInvoicesPanel.jsx`: `ProjectBadge` (أيقونة Building2، نص «مشروع {code} · {phase}») يفتح `/accounting/branch-projects/{project_id}?tab=expenses`؛ فلتر «المشروع» (كل/بلا مشروع/كل مشروع) بجانب فلتر الفرع.
4. **عقود الإيجار**: `parseContractInput` يقرأ `project_id`؛ POST/PUT في مسارات العقود يكتبان `project_id`؛ `listContracts/loadContract` يعيدان `project_id`؛ `LeaseContractModal` حقل «مشروع تأسيس» (اختياري). في `generateSetAsideInvoices`: إن للعقد `project_id` ومشروعه `status <> 'opened'` (أو `lease_month <= TO_CHAR(actual_opening_date,'YYYYMM')`) → بعد الإنشاء `UPDATE … SET project_id, project_phase_id` حيث القسم = القسم الذي `template_key = 'lease'` وإلا أول قسم بـ sort_order (وإلا NULL).
5. **الواجهة**: `BRANCH_PROJECTS_MOCK = false`. في `ExpensesTab.jsx`: زر «+ فاتورة» يفتح `PurchaseInvoiceModal` بـ `prefill` (يحتاج contacts/accounts/bankAccounts/branches — استخدم الهوكس `useAccountingContacts`, `useAccountingAccounts`, `useAccountingBankAccounts`, وفرع عبر `queryKeys.branches()` بنفس أسلوب `PurchasesInvoicesPanel`) و`onSubmit` عبر `useCreateAccountingPurchaseInvoice` ثم `invalidateBranchProjectQueries`؛ زر «ربط فاتورة موجودة» يفتح نافذة بسيطة تبحث في فواتير المشتريات غير المرتبطة (`useAccountingPurchaseInvoices`) وتختار قسماً ثم `useSaveBranchProjectInvoice` بلا id مع `{invoice_id, phase_id}` — عدّل hook `useSaveBranchProjectInvoice` ليدعم ذلك (real: POST مع `{invoice_id, phase_id}`)؛ تعديل الفاتورة في التبويب = نافذة صغيرة (القسم + الحساب) تستدعي PUT؛ حذف = DELETE مع confirm «حذف نهائي من فواتير المشتريات»؛ فاتورة `source==='lease'` بلا حذف (شارة «إيجار»). أزل ملاحظة «مؤقتاً تُسجَّل الفواتير هنا». `ExpenseModal.jsx` يصبح نافذة «القسم والحساب» فقط.
6. `.claude/architecture.md` قسم 15: حدّثه (الخلفية موجودة، المفتاح مقلوب، المسارات، الجداول، الحسابات 53).

## قواعد عامة
- `sql` من `@/app/api/utils/sql` (tagged templates؛ `sql.transaction([...])` بلا تداخل)؛ لا ORM؛ لا ملفات migrations.
- التوقيت `(NOW() AT TIME ZONE 'Asia/Riyadh')`؛ اليوم عبر `todayRiyadh()` من `@/app/api/utils/leaseContracts` أو `@/utils/branchProjectMath`.
- لا `queryKey: [` مضمّن في src.
- بعد الانتهاء: `bun run test` و`bun run typecheck` يمران. لا `bun run build` (أشغّله أنا)، لا commit.
