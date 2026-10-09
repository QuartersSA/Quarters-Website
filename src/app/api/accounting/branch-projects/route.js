import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  REQUIRE_BRANCH_PROJECTS_READ,
  ensureBranchProjectsSchema,
  listProjects,
  loadProject,
  parseProjectInput,
  createProjectWithTemplate,
  logProjectAudit,
} from "@/app/api/utils/branchProjects";
import { fail, serverError } from "./_lib";

// مشاريع تأسيس الفروع — القائمة والإنشاء.
// GET  /api/accounting/branch-projects            → { projects }
//      (READ gate: يشمل حامل «قسم المشتريات» لاختيار المشروع في الفاتورة)
// POST /api/accounting/branch-projects            → 201 { project }
//      body: حقول ProjectModal + template: 'default' | 'empty'

export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS_READ);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const projects = await listProjects();
    return Response.json({ projects });
  } catch (error) {
    return serverError("list", error, "فشل تحميل مشاريع التأسيس");
  }
}

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const body = await request.json().catch(() => ({}));
    const { value, error } = parseProjectInput(body);
    if (error) return fail(400, error);
    const template = body.template === "empty" ? "empty" : "default";
    const id = await createProjectWithTemplate(value, { template, actor: auth.user });
    const project = await loadProject(id);
    await logProjectAudit({
      projectId: id,
      action: "created",
      summary: `إنشاء مشروع تأسيس ${project?.code || `#${id}`} — ${value.name} (${value.city || "بلا مدينة"})${template === "empty" ? " — بلا أقسام" : " — بالقالب الافتراضي"}`,
      actor: auth.user,
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return serverError("create", error, "فشل إنشاء المشروع");
  }
}
