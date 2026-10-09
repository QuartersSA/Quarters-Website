# عقود المقاولين والموردين داخل تبويب المصاريف — المواصفة

طلب المالك: داخل «المصاريف» في تأسيس الفروع قسم «العقود»: عقد مع مقاول (مثال: الصبغ) بمبلغ الاتفاق وعدد الدفعات، وتسجيل ما سُدّد، ليعرف عقوده مع المقاولين أو المواد.

## القرارات
- العقد = التزام (اتفاق) مقسّم إلى دفعات. **السداد الفعلي يبقى عبر فواتير المشتريات فقط** (قاعدة المالك): «تسجيل دفعة» يفتح نافذة فاتورة المشتريات معبّأة (المورد، المبلغ، القسم، الحساب، المشروع) وتُربط الفاتورة بالدفعة؛ أو «ربط فاتورة موجودة» بالدفعة. لا سداد يدوي بلا فاتورة.
- حالة الدفعة **محسوبة** لا مخزّنة: `paid` إن فاتورتها مسددة بالكامل (paid ≥ total − 0.005)، `invoiced` إن لها فاتورة غير مسددة، `overdue` إن بلا فاتورة واستحقاقها قبل اليوم، وإلا `pending`.
- حذف فاتورة مشتريات (من أي مسار) يفك ربطها من الدفعة تلقائيًا.
- حذف العقد مرفوض إن كانت له فواتير مرتبطة (409 `has_invoices`).

## الأشكال (تُضاف إلى Project المعاد من loadProject؛ `listProjects` يعيد `contracts: []`)
```
Contract {
  id, project_id, phase_id:null|number, kind:'contractor'|'supplier'|'service'|'other',
  title, party_name, party_contact_id:null|number, agreed_amount:number, vat_included:boolean,
  start_date:null|date, end_date:null|date, status:'active'|'completed'|'cancelled',
  attachment_url:null|string, attachment_name:null|string, notes:string,
  installments: Installment[], invoiced:number, paid:number, created_at, updated_at
}
Installment {
  id, contract_id, seq, label, due_date:null|date, amount:number, notes:string,
  invoice_id:null|number, invoice_number:null|string, invoice_total:number, invoice_paid:number,
  status:'pending'|'invoiced'|'overdue'|'paid'   // محسوبة في الخادم بنفس قاعدة installmentStatus
}
ProjectInvoice += { contract_id:null|number, contract_title:null|string, installment_id:null|number, installment_seq:null|number }
```

## الملكية
| الوكيل | يملك |
|---|---|
| D2 (الخلفية) | `src/app/api/utils/branchProjects.js` (تعديل)، `src/app/api/accounting/branch-projects/[id]/contracts/**` (جديد)، `src/app/api/accounting/purchase-invoices/route.js` (تعديل: قراءة/كتابة الربط + حذف)، `src/app/api/utils/purchaseInvoiceDelete.js` (فك ربط الدفعة)، `src/app/api/accounting/branch-projects/[id]/invoices/[invoiceId]/route.js` (DELETE يفك ربط الدفعة — عبر الدالة المشتركة)، `.claude/architecture.md` قسم 15 |
| F2 (الواجهة) | `src/utils/branchProjectMath.js` (+ `test/branchProjectMath.test.js`)، `src/hooks/useBranchProjects.js`، `src/components/Accounting/BranchProjects/ExpensesTab.jsx`، `ContractModal.jsx` (جديد)، `ContractsSection.jsx` (جديد)، `OverviewTab.jsx` (تنبيهات الدفعات)، `src/components/Accounting/PurchaseInvoiceModal.jsx` (prefill موسّع) |

## D2 — الخلفية
### الجداول (داخل `ensureBranchProjectsSchemaImpl`)
- `branch_project_contracts`: `id SERIAL PK, project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE, phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE SET NULL, kind TEXT NOT NULL DEFAULT 'contractor', title TEXT NOT NULL, party_name TEXT NOT NULL, party_contact_id INTEGER, agreed_amount NUMERIC(14,2) NOT NULL DEFAULT 0, vat_included BOOLEAN NOT NULL DEFAULT TRUE, start_date DATE, end_date DATE, status TEXT NOT NULL DEFAULT 'active', attachment_url TEXT, attachment_name TEXT, notes TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at, updated_at, created_by_employee_id INTEGER, created_by_employee_name TEXT` + index (project_id).
- `branch_project_contract_installments`: `id SERIAL PK, contract_id INTEGER NOT NULL REFERENCES branch_project_contracts(id) ON DELETE CASCADE, seq INTEGER NOT NULL DEFAULT 1, label TEXT, due_date DATE, amount NUMERIC(14,2) NOT NULL DEFAULT 0, invoice_id INTEGER, notes TEXT, created_at, updated_at` + index (contract_id, seq).
- على `accounting_purchase_invoices` (في `ensureProjectInvoiceLinkColumns`): `+ project_contract_id INTEGER, project_installment_id INTEGER` + index (project_contract_id).
### المحمّلات
- `INVOICE_SELECT` يضيف `inv.project_contract_id, inv.project_installment_id` + `LEFT JOIN branch_project_contracts pc ON pc.id = inv.project_contract_id` → `pc.title AS contract_title` + `LEFT JOIN branch_project_contract_installments pci ON pci.id = inv.project_installment_id` → `pci.seq AS installment_seq`؛ `mapInvoiceRow` يعيد الحقول الأربعة.
- `loadContracts(projectIds)`: عقود `is_active = TRUE` مرتبة `created_at, id` + دفعاتها مرتبة `seq, id` مع `LEFT JOIN accounting_purchase_invoices inv ON inv.id = pci.invoice_id AND inv.is_active` لجلب `invoice_number, total_amount, paid_amount`؛ `invoiced/paid` للعقد = مجموع فواتير `project_contract_id = pc.id AND is_active` (استعلام تجميعي واحد)؛ الحالة المحسوبة بـ `installmentStatus` (طبّق نفس القاعدة محليًا في الخادم).
- `loadProject` يعيد `contracts`؛ `listProjects` يعيد `contracts: []`.
- `parseContractInput(body, existing)` → `{value, error}`: title مطلوب، party_name مطلوب، kind من القائمة (افتراضي contractor)، agreed_amount ≥ 0، vat_included boolean (افتراضي true)، phase_id رقم/null، party_contact_id رقم/null، التواريخ `YYYY-MM-DD` أو null و end ≥ start، status من القائمة (افتراضي active)، attachment_url/name/notes نصوص؛ `installments`: مصفوفة `{id?, seq?, label, due_date, amount, notes}`، amount ≥ 0، ≤ 60 دفعة، تُرقَّم seq حسب الترتيب.
### المسارات (كل handler: `requireAuth(request, REQUIRE_BRANCH_PROJECTS)` ثم `ensureBranchProjectsSchema()`؛ `fail/serverError/loadProjectHeader/resolvePhaseId/touchProject` من `_lib.js`)
- `[id]/contracts/route.js` POST → 201 `{ok:true, contract}` (إدراج الرأس ثم الدفعات؛ عند فشل الدفعات يُحذف الرأس).
- `[id]/contracts/[contractId]/route.js` PUT: تحديث الرأس؛ الدفعات: **التي لها `invoice_id` لا تُحذف** (تُحدَّث label/due_date/amount/notes إن أُرسلت بنفس `id`)، الباقي يُستبدل بالمرسل (بلا id = جديد؛ id موجود بلا فاتورة = تحديث؛ غير مُرسل وبلا فاتورة = حذف)؛ يعيد `{ok:true, contract}`. DELETE: 409 `has_invoices` إن وُجدت فاتورة نشطة بـ `project_contract_id` أو دفعة بـ `invoice_id`؛ وإلا حذف فعلي (CASCADE) → `{ok:true}`.
- `[id]/contracts/[contractId]/installments/[installmentId]/route.js` PUT `{invoice_id}`: إن رقم → تحقق أن الفاتورة نشطة وغير مرتبطة بدفعة أخرى (409 `linked_elsewhere`) وغير مرتبطة بمشروع آخر؛ اضبط على الفاتورة `project_id = id, project_phase_id = COALESCE(contract.phase_id, inv.project_phase_id), project_contract_id, project_installment_id` وعلى الدفعة `invoice_id`؛ إن `null` → فك الربط من الطرفين. يعيد `{ok:true, installment, invoice}`.
- كل كتابة: `logProjectAudit` + `touchProject`.
### فواتير المشتريات
- `parsePayload`/`createPurchaseInvoice`: يقرأ `project_contract_id`, `project_installment_id` (رقم أو null)؛ تحقق: العقد يخص `project_id` المرسل وإلا 400، الدفعة تخص العقد وبلا `invoice_id` وإلا 400 («الدفعة مرتبطة بفاتورة أخرى»)؛ يكتبهما في INSERT؛ بعد الإدراج `UPDATE branch_project_contract_installments SET invoice_id = <new id> WHERE id = <installment> AND invoice_id IS NULL` (try/catch). PUT الفاتورة لا يغيّرهما.
- `hardDeletePurchaseInvoices` (و`DELETE` القسري في مسار الفواتير): قبل الحذف `UPDATE branch_project_contract_installments SET invoice_id = NULL WHERE invoice_id = ANY(ids)` مع `to_regclass` + try/catch. صدّر دالة `unlinkInvoicesFromInstallments(ids)` من `purchaseInvoiceDelete.js` واستخدمها في المسارين.
- قائمة فواتير المشتريات (GET): أضف `inv.project_contract_id, pc.title AS project_contract_title` (LEFT JOIN).

## F2 — الواجهة
### `branchProjectMath.js` (+ اختبارات ≥ 8)
`CONTRACT_KINDS = ['contractor','supplier','service','other']`, `CONTRACT_KIND_LABELS` {مقاول، مورد مواد، خدمة، أخرى}, `CONTRACT_STATUSES/LABELS` {نشط، مكتمل، ملغى}, `INSTALLMENT_STATUS_LABELS` {pending:'لم تُسدَّد', invoiced:'فاتورة بانتظار السداد', overdue:'متأخرة', paid:'مسددة'}, `installmentStatus(inst, today)`, `contractTotals(contract, today)` → `{agreed, invoiced, paid, remaining(agreed−paid), pct, installments_total, installments_paid, installments_sum, next_due:{seq,due_date,amount}|null, overdue_count}`, `buildInstallments({count, total, firstDue, every:'month'|'days', days})` → توزيع متساوٍ (الأخيرة تحمل الفرق) بتواريخ متتابعة، `summarizeContracts(contracts, today)` → `{active_count, agreed_total, paid_total, remaining_total, overdue_installments, due_soon:[{contract, installment}] خلال 7 أيام}`, `phaseContracted(phaseId, contracts)` (مجموع agreed للعقود النشطة/المكتملة في القسم).
### الهوكس (`useBranchProjects.js`)
`useSaveBranchProjectContract()` `{project_id, id?, ...fields, installments}` → POST/PUT؛ `useDeleteBranchProjectContract()` `{project_id, id}`؛ `useLinkContractInstallmentInvoice()` `{project_id, contract_id, installment_id, invoice_id|null}` → PUT. كلها تبطل استعلامات المشروع + `queryKeys.accountingPurchaseInvoices()` (استورد `queryKeys`) وتعرض toast عربي. (الوضع mock غير مطلوب — عند `BRANCH_PROJECTS_MOCK` ارمِ خطأ «غير متاح في الوضع التجريبي».)
### `ExpensesTab.jsx`
- بعد بطاقات الملخص: مبدّل `ws.segWrap/segBtn` «الفواتير» | «العقود» (حالة `view`، افتراضي invoices؛ يُحفظ في `?exp=contracts` عبر `useSearchParams` إن سهل، وإلا حالة محلية).
- جدول «الميزانية مقابل الفعلي»: عمود جديد «تعاقدات» (`phaseContracted`).
- في جدول/بطاقات الفواتير: chip «عقد: {contract_title} · د{installment_seq}» إن `contract_id`.
- عرض العقود = `ContractsSection` (جديد) `{project, phases, employeeId, isAdmin, onNewInvoice(prefill)}`: KPIs (عقود نشطة، إجمالي التعاقدات، المسدد، المتبقي، دفعات متأخرة)، فلتر قسم/حالة + بحث، بطاقة لكل عقد: عنوان + chip النوع + الطرف + القسم + chip الحالة، المتفق عليه، شريط المسدد/المتفق، صف الدفعات (chips: «د1 · 15/11 · 5,000» بلون الحالة؛ النقر يفتح قائمة: «تسجيل دفعة (فاتورة جديدة)» / «ربط فاتورة موجودة» / «فتح الفاتورة» إن مرتبطة / «فك الربط»)، الدفعة التالية، أزرار: تعديل، إكمال/إعادة تفعيل، حذف (confirm؛ خطأ `has_invoices` يُعرض كتوست)، رابط المرفق. حالة فارغة + زر «+ عقد».
- «تسجيل دفعة» → `onNewInvoice({ project_id, project_phase_id: contract.phase_id, expense_account_code: inferAccountForPhase(...), supplier_name: contract.party_name, contact_id: contract.party_contact_id, due_date: inst.due_date, line_description: \`${contract.title} — الدفعة ${inst.seq}\`, line_amount: inst.amount, project_contract_id: contract.id, project_installment_id: inst.id })` → يفتح `PurchaseInvoiceModal` بالـ prefill؛ `handleCreate` يمرر `project_contract_id`/`project_installment_id` من الحمولة.
- «ربط فاتورة موجودة» بالدفعة: أعد استخدام `LinkInvoiceModal` بوضع يُمرَّر له `{contract, installment}` فيستدعي `useLinkContractInstallmentInvoice` بدل ربط المشروع (أو نافذة مشابهة صغيرة).
### `ContractModal.jsx` `{open, project, phases, contract|null, contacts, onClose}`
الحقول: العنوان*، النوع (segmented)، الطرف: GlassSelect من `contacts` (searchable) + حقل نص حر (إن اختير جهة يُملأ الاسم ويُحفظ `party_contact_id`)، القسم، المبلغ المتفق عليه*، «شامل الضريبة» toggle، تاريخ البداية/النهاية، الحالة (في التعديل فقط)، المرفق (رفع عبر `useUpload`، PDF/صورة)، ملاحظات. مولّد الدفعات: العدد (1–60) + تاريخ أول استحقاق + التكرار (شهري / كل N يوم) + زر «توليد» → جدول دفعات قابل للتحرير (التسلسل، الوصف، الاستحقاق `GlassDatePicker`، المبلغ، حذف — الدفعات المرتبطة بفاتورة تُعرض بقفل ولا تُحذف) + سطر مجموع الدفعات مقابل المتفق عليه (تحذير أصفر إن اختلف، لا منع). الحفظ عبر `useSaveBranchProjectContract`.
### `PurchaseInvoiceModal.jsx`
prefill موسّع (إنشاء فقط): `supplier_name` → `setSupplierName`، `contact_id` → `setContactId`، `due_date`، `line_amount`/`line_description` → البند الأول (كمية 1، سعر = المبلغ، includes-tax = true)، `project_contract_id`/`project_installment_id` تُحفظ في state وتُمرَّر في الحمولة؛ شريط معلومات صغير أعلى النموذج «دفعة عقد: {title} — الدفعة {seq}» إن وُجد `prefill.contract_label`.
### `OverviewTab.jsx`
تنبيهات إضافية من `summarizeContracts`: دفعات عقود متأخرة ودفعات تستحق خلال 7 أيام (نص: «دفعة {seq} من عقد {title} — {amount} — تستحق {date}») مع زر يفتح تبويب المصاريف بعرض العقود (`onSelectPhase` غير مناسب — استخدم `navigate`/`setSearchParams` إلى `?tab=expenses&exp=contracts`).

## قواعد
- ثيم `uiPurchases`، ألوان صريحة للوضعين، `grid-cols-1` للجوال، أرقام لاتينية، عربي.
- لا `queryKey: [` مضمّن؛ كل handler `requireAuth(`؛ `bun run test` و`bun run typecheck` يمران؛ لا `bun run build`؛ لا commit.
