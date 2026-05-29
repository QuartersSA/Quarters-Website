"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Admin/Sidebar";
import { ws } from "@/components/Workspace/ui";
import { formatDateTime } from "@/utils/exportUtils";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";
import {
  Building2,
  ClipboardList,
  Plus,
  Edit,
  Trash2,
  MapPin,
  X,
  Search,
} from "lucide-react";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";

export default function BranchesPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
  });

  const queryClient = useQueryClient();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await adminFetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await adminFetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create branch");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await adminFetch("/api/branches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update branch");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await adminFetch("/api/branches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete branch");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setDeleteConfirm(null);
    },
  });

  const handleLogout = () => {
    logout();
  };

  const resetForm = () => {
    setFormData({ name: "", location: "" });
    setEditingBranch(null);
  };

  const handleOpenModal = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        location: branch.location || "",
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    // Extra guard alongside the button's `disabled` — keystroke + click
    // can race the disabled flip between mutate-start and re-render.
    if (deleteMutation.isPending) return;
    deleteMutation.mutate(id);
  };

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.location &&
        branch.location.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  if (!isAuthenticated) {
    return null;
  }

  const statCard = `${ws.glass} ${ws.card} p-6`;
  const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar onLogout={handleLogout} activePage="branches" />

      {/* Main Content */}
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="branches" />
        {/* Header */}
        <div className="mb-8 mt-6 lg:mt-0">
          <h1 className={`text-3xl sm:text-4xl ${ws.title} mb-2`}>
            إدارة الفروع
          </h1>
          <p className={ws.muted}>
            إضافة وتعديل وحذف فروع الشركة ومتابعة بياناتها
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className={statCard}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${ws.iconBox} text-white/80`}>
                <Building2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-slate-600 dark:text-white/55 text-sm mb-1">إجمالي الفروع</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {branches.length}
            </p>
          </div>

          <div className={statCard}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${ws.iconBox} text-emerald-200`}>
                <MapPin className="w-6 h-6" />
              </div>
            </div>
            <p className="text-slate-600 dark:text-white/55 text-sm mb-1">فروع مع موقع</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {branches.filter((b) => b.location).length}
            </p>
          </div>

          <div className={statCard}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${ws.iconBox} text-sky-200`}>
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>
            <p className="text-slate-600 dark:text-white/55 text-sm mb-1">إجمالي السجلات</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {branches.length}
            </p>
          </div>
        </div>

        {/* Search and Add Button */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/35" />
            <input
              type="text"
              placeholder="البحث عن فرع…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${ws.input} pr-12 pl-4 py-3`}
            />
          </div>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className={`${ws.btnPrimary} px-6 py-3 justify-center`}
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">إضافة فرع جديد</span>
          </button>
        </div>

        {/* Branches Table */}
        <div className={sectionCard}>
          <div className={`p-5 sm:p-6 border-b ${ws.divider}`}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
              <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
                <Building2 className="w-5 h-5" />
              </div>
              قائمة الفروع
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100 dark:bg-white/[0.04]">
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-white/55">
                    #
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-white/55">
                    اسم الفرع
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-white/55">
                    الموقع
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-white/55">
                    تاريخ الإضافة
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600 dark:text-white/55">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-slate-600 dark:text-white/55"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
                        <span>جاري التحميل…</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredBranches.length > 0 ? (
                  filteredBranches.map((branch, index) => (
                    <tr
                      key={branch.id}
                      className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <td className="px-6 py-4 text-slate-500 dark:text-white/45">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`${ws.iconBox} w-10 h-10 text-slate-700 dark:text-white/75`}
                          >
                            <Building2 className="w-5 h-5" />
                          </div>
                          <span className="text-slate-900 dark:text-white font-medium">
                            {branch.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {branch.location ? (
                          <div className="flex items-center gap-2 text-slate-700 dark:text-white/75">
                            <MapPin className="w-4 h-4 text-emerald-200" />
                            <span>{branch.location}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 dark:text-white/45 text-sm">
                            غير محدد
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-white/45 text-sm whitespace-nowrap">
                        {formatDateTime(branch.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(branch)}
                            className={`${ws.iconButton} text-sky-200`}
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(branch)}
                            className={`${ws.iconButton} text-red-200`}
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-slate-500 dark:text-white/45"
                    >
                      <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p>
                        {searchTerm
                          ? "لا توجد نتائج للبحث"
                          : "لا توجد فروع حتى الآن"}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${ws.glass} ${ws.card} w-full max-w-md shadow-2xl`}>
            <div
              className={`p-6 border-b ${ws.divider} flex items-center justify-between`}
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
                  <Building2 className="w-5 h-5" />
                </div>
                {editingBranch ? "تعديل الفرع" : "إضافة فرع جديد"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className={ws.iconButton}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-white/70 text-sm font-semibold mb-2">
                  اسم الفرع <span className="text-red-300">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مثال: الفرع الرئيسي"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-white/70 text-sm font-semibold mb-2">
                  الموقع
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مثال: الرياض، شارع الملك فهد"
                />
              </div>

              {createMutation.error || updateMutation.error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                  <p className="text-red-200 text-sm">
                    {createMutation.error?.message ||
                      updateMutation.error?.message}
                  </p>
                </div>
              ) : null}

              <div className={`flex gap-3 pt-4 border-t ${ws.divider}`}>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className={`${ws.btnPrimary} flex-1 px-6 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "جاري الحفظ…"
                    : editingBranch
                      ? "حفظ التعديلات"
                      : "إضافة الفرع"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className={`${ws.btnNeutral} px-6 py-3 justify-center`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {deleteConfirm ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className={`${ws.glass} ${ws.card} w-full max-w-md shadow-2xl border border-red-500/25`}
          >
            <div className={`p-6 border-b ${ws.divider}`}>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                <div className={`${ws.iconBox} w-10 h-10 text-red-200`}>
                  <Trash2 className="w-5 h-5" />
                </div>
                تأكيد الحذف
              </h3>
            </div>

            <div className="p-6">
              <p className="text-white/80 mb-4">
                هل أنت متأكد من حذف الفرع{" "}
                <span className="font-bold text-slate-900 dark:text-white">
                  "{deleteConfirm.name}"
                </span>
                ؟
              </p>
              <p className="text-amber-200/90 text-sm flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                <span className="text-lg">⚠️</span>
                <span>
                  لا يمكن حذف الفرع إذا كان لديه موظفين أو عمليات جرد مرتبطة به
                </span>
              </p>

              {deleteMutation.error ? (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
                  <p className="text-red-200 text-sm">
                    {deleteMutation.error.message}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirm.id)}
                  disabled={deleteMutation.isPending}
                  className={`${ws.btnDanger} flex-1 px-6 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {deleteMutation.isPending ? "جاري الحذف…" : "نعم، احذف"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className={`${ws.btnNeutral} px-6 py-3 justify-center`}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
