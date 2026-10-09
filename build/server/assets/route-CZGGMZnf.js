import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureBranchProjectsSchema, s as listProjects, n as parseProjectInput, t as createProjectWithTemplate, i as loadProject, l as logProjectAudit, u as REQUIRE_BRANCH_PROJECTS_READ, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-CcA6x5SF.js';
import { s as serverError, f as fail } from './_lib-D2U1lqMJ.js';
import 'crypto';
import './sql-CSDV1lSC.js';
import '@neondatabase/serverless';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseAudit-DZMMDeLJ.js';
import './dateUtils-Bvji1KrH.js';

// مشاريع تأسيس الفروع — القائمة والإنشاء.
// GET  /api/accounting/branch-projects            → { projects }
//      (READ gate: يشمل حامل «قسم المشتريات» لاختيار المشروع في الفاتورة)
// POST /api/accounting/branch-projects            → 201 { project }
//      body: حقول ProjectModal + template: 'default' | 'empty'

async function GET(request) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS_READ);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureBranchProjectsSchema();
    const projects = await listProjects();
    return Response.json({
      projects
    });
  } catch (error) {
    return serverError("list", error, "فشل تحميل مشاريع التأسيس");
  }
}
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureBranchProjectsSchema();
    const body = await request.json().catch(() => ({}));
    const {
      value,
      error
    } = parseProjectInput(body);
    if (error) return fail(400, error);
    const template = body.template === "empty" ? "empty" : "default";
    const id = await createProjectWithTemplate(value, {
      template,
      actor: auth.user
    });
    const project = await loadProject(id);
    await logProjectAudit({
      projectId: id,
      action: "created",
      summary: `إنشاء مشروع تأسيس ${project?.code || `#${id}`} — ${value.name} (${value.city || "بلا مدينة"})${template === "empty" ? " — بلا أقسام" : " — بالقالب الافتراضي"}`,
      actor: auth.user
    });
    return Response.json({
      project
    }, {
      status: 201
    });
  } catch (error) {
    return serverError("create", error, "فشل إنشاء المشروع");
  }
}

export { GET, POST };
