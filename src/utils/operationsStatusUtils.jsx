import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

export function getStatusIcon(status) {
  switch (status) {
    case "Completed":
      return <CheckCircle className="w-4 h-4" />;
    case "Pending":
      return <Clock className="w-4 h-4" />;
    case "In Progress":
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return null;
  }
}

export function getStatusColor(status) {
  switch (status) {
    case "Completed":
      return "text-emerald-400 bg-emerald-500/20";
    case "Pending":
      return "text-amber-400 bg-amber-500/20";
    case "In Progress":
      return "text-blue-400 bg-blue-500/20";
    default:
      return "text-gray-400 bg-gray-500/20";
  }
}

export function getStatusText(status) {
  switch (status) {
    case "Completed":
      return "مكتمل";
    case "Pending":
      return "قيد الانتظار";
    case "In Progress":
      return "قيد التنفيذ";
    default:
      return status;
  }
}
