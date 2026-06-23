import { useQuery } from "@tanstack/react-query";
import { workspaceFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useTasksData(myId, scope, statusFilter, spaceFilter, q) {
  return useQuery({
    queryKey: queryKeys.workspaceTasks(myId,scope,statusFilter,spaceFilter,q),
    enabled: !!myId,
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("employeeId", String(myId));
      sp.set("scope", scope);
      sp.set("status", statusFilter);
      if (spaceFilter) sp.set("spaceId", spaceFilter);
      if (q.trim()) sp.set("q", q.trim());

      const res = await workspaceFetch(`/api/workspace/tasks?${sp.toString()}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/workspace/tasks, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });
}

export function useUsersData(myId) {
  return useQuery({
    queryKey: queryKeys.workspaceUsers(myId),
    enabled: !!myId,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/workspace/users?employeeId=${myId}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/workspace/users, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });
}

export function useSpacesData(myId) {
  return useQuery({
    queryKey: queryKeys.workspaceSpaces(myId),
    enabled: !!myId,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/workspace/spaces?employeeId=${myId}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/workspace/spaces, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });
}
