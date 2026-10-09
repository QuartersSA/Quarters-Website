# صلاحية «تأسيس الفروع» للموظفين — المواصفة

طلب المالك: قسم تأسيس الفروع يُمنح من صلاحيات المحاسبة في بطاقة الموظف (مثل «قسم المشتريات»).

## القرار
- علم جديد على `employees`: `can_manage_branch_projects BOOLEAN DEFAULT false`. تسمية الواجهة: «تأسيس الفروع». للمدراء (role Admin) فقط؛ لدور Employee يُحفظ false دائمًا (نفس قاعدة `can_manage_purchases`).
- الوصول لصفحات `/accounting/branch-projects*`: `role === "Admin"` و(`can_manage_accounting` أو `can_manage_branch_projects`).
- المحاسبة الكاملة (`can_manage_accounting`) تشمل القسم كما هي.
- حامل `can_manage_branch_projects` فقط (بلا محاسبة): يرى قسم «المحاسبة» في مبدّل الأقسام، يهبط على `/accounting/branch-projects`، وأي صفحة محاسبة أخرى تعيده إليه — ما عدا المشتريات إن كان يحمل `can_manage_purchases` أيضًا. الشريط الجانبي يعرض فقط ما يحمله.
- حامل `can_manage_purchases` فقط: **لا** يدخل صفحات تأسيس الفروع (كان يدخل سابقًا — يُلغى)، لكن يبقى له **قراءة قائمة المشاريع** (GET القائمة) لأن نافذة الفاتورة تحتاجها لاختيار المشروع/القسم.
- الـ API: `REQUIRE_BRANCH_PROJECTS` (كل الكتابة + GET المشروع الواحد) = Admin + (`can_manage_accounting` | `can_manage_branch_projects`). `REQUIRE_BRANCH_PROJECTS_READ` (GET القائمة فقط) = السابق + `can_manage_purchases`.

## نقاط اللمس — خلفية (agent BE)
1. `src/app/api/employees/route.js`: `ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_manage_branch_projects BOOLEAN DEFAULT false` بجانب L18؛ كلا SELECT (L69، L375) `COALESCE(e.can_manage_branch_projects, false) as can_manage_branch_projects`؛ POST: destructure (بعد `can_manage_purchases` L165)، `const canManageBranchProjectsBool = isAdmin ? !!can_manage_branch_projects : false;`، عمود + قيمة في INSERT (بعد `can_manage_purchases`) — تحقق من تطابق عدد الأعمدة والقيم.
2. `src/app/api/employees/[id]/route.js`: ALTER (L17)، SELECT (L68، L551)، destructure (L159)، كتلة PUT مثل L435-438 بقيمة `isAdmin ? !!can_manage_branch_projects : false`.
3. `src/app/api/employees/login/route.js`: معامل `includeManageBranchProjects = true` في `findEmployee` + `selectManageBranchProjects` + إدراجه بعد `${selectManagePurchases}`؛ فرع 42703 جديد لـ `can_manage_branch_projects` (نفس شكل فرع `can_manage_purchases`)؛ الحمولة الموقّعة (L263-282) تضيف `can_manage_branch_projects: !!employeeData.can_manage_branch_projects`؛ تأكد أن كائن `employee` المعاد في JSON يحمل العلم (إن كان يُبنى بقائمة صريحة أضفه).
4. `src/app/api/utils/branchProjects.js`: `REQUIRE_BRANCH_PROJECTS` = `{ anyOf: [{role:"Admin", permission:"can_manage_accounting"}, {role:"Admin", permission:"can_manage_branch_projects"}] }`؛ تصدير جديد `REQUIRE_BRANCH_PROJECTS_READ` يضيف `{role:"Admin", permission:"can_manage_purchases"}`. `src/app/api/accounting/branch-projects/route.js`: GET يستخدم READ، POST يبقى على العادي.
5. `.claude/architecture.md`: أضف العلم لقائمة Permission Flags (قسم 5) وحدّث سطر Gate في قسم 15.

## نقاط اللمس — واجهة (agent FE)
1. `src/app/admin/login/page.jsx`: `can_manage_branch_projects: !!data.employee.can_manage_branch_projects` في كائن adminUser (بعد `can_manage_purchases`).
2. `src/hooks/useEmployeeForm.js`: افتراضي `can_manage_branch_projects: false` وقراءة `!!employee.can_manage_branch_projects`. تحقق كيف تُرسل الحمولة (إن كانت قائمة صريحة أضف العلم؛ إن كانت spread لا شيء).
3. `src/components/Employees/EmployeeModal/EmployeeFormFields.jsx`: متغير `adminBranchProjectsBtnClass`؛ زر تبديل بعد زر «قسم المشتريات» بأيقونة `Building2` ونص «تأسيس الفروع» و`title="وصول لقسم تأسيس الفروع داخل المحاسبة بدون بقية المحاسبة"`؛ في إعداد دور «مدير» أضف `can_manage_branch_projects: false` وفي دور «موظف» `false`.
4. `src/components/AppSectionSwitcher.jsx`: بوابة accounting: `p.can_manage_accounting || p.can_manage_purchases || p.can_manage_branch_projects`.
5. `src/app/admin/layout.jsx` `allowedModes`: accounting تضيف `|| !!adminUser.can_manage_branch_projects`.
6. `src/app/accounting/layout.jsx`: عند `Admin && can_manage_accounting === false`: `allowed = []`؛ إن `can_manage_purchases` → `"/accounting/purchases"`؛ إن `can_manage_branch_projects` → `"/accounting/branch-projects"`؛ إن فارغ → `/admin`؛ وإلا إن المسار لا يبدأ بأي مسموح → توجيه إلى `allowed[0]`. حدّث التعليق.
7. `src/components/Accounting/Sidebar.jsx`: عند `Admin && can_manage_accounting === false` رشّح `NAV_CONFIG` إلى المفاتيح المسموحة (`purchases` إن can_manage_purchases، `branch-projects` إن can_manage_branch_projects).
8. `src/app/accounting/branch-projects/page.jsx` و`[id]/page.jsx`: `const canAccess = user?.can_manage_accounting !== false || !!user?.can_manage_branch_projects;` وتستبدل `canManageAccounting` في شرط البوابة؛ رسالة عدم الصلاحية: «تحتاج صلاحية «المحاسبة» أو «تأسيس الفروع»».

## قواعد
- لا `queryKey: [` مضمّن؛ كل handler مُصدَّر يحتوي `requireAuth(`؛ `bun run test` و`bun run typecheck` يمران؛ لا `bun run build`؛ لا commit.
