import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type RecurrenceType = "daily" | "weekly" | "biweekly" | "monthly" | "yearly" | null;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  category_id: string | null;
  created_by: string;
  assigned_to: string | null;
  is_group_task: boolean;
  recurrence_type: RecurrenceType;
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  recurrence_day_of_week: number | null;
  recurrence_day_of_month: number | null;
  admin_only_complete: boolean;
  parent_task_id: string | null;
  ticket_id: string | null;
  completed_at: string | null;
  reminder_at: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  creator_name?: string;
  assignee_name?: string;
  category_name?: string;
  category_color?: string;
  participants?: { user_id: string; name: string }[];
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
}

export interface ProfileLite {
  user_id: string;
  name: string;
}

export function useTaskCategories() {
  return useQuery({
    queryKey: ["task-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_categories" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as TaskCategory[];
    },
  });
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ["all-profiles-tasks"],
    queryFn: async () => {
      try {
        const { listAllProfiles } = await import("@/lib/user-admin.functions");
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { headers: { authorization: `Bearer ${session?.access_token}` } };
        const list = (await listAllProfiles(headers)) || [];
        return list.map((p: any) => ({ user_id: p.user_id, name: p.name || "Sem nome" })) as ProfileLite[];
      } catch {
        const { data } = await supabase.from("profiles").select("user_id, name");
        return (data || []).map((p: any) => ({ user_id: p.user_id, name: p.name || "Sem nome" })) as ProfileLite[];
      }
    },
  });
}

export function useTasks(filterTicketId?: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: categories = [] } = useTaskCategories();
  const { data: profiles = [] } = useAllProfiles();

  const query = useQuery({
    queryKey: ["tasks", filterTicketId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("tasks" as any).select("*").order("created_at", { ascending: false });
      if (filterTicketId) q = q.eq("ticket_id", filterTicketId);
      const { data: tasks, error } = await q;
      if (error) throw error;

      const list = (tasks || []) as any[];
      const ids = list.map((t) => t.id);

      let participantsMap: Record<string, ProfileLite[]> = {};
      if (ids.length > 0) {
        const { data: parts } = await supabase
          .from("task_participants" as any)
          .select("task_id, user_id")
          .in("task_id", ids);
        for (const p of (parts as any[]) || []) {
          if (!participantsMap[p.task_id]) participantsMap[p.task_id] = [];
          const prof = profiles.find((pr) => pr.user_id === p.user_id);
          participantsMap[p.task_id].push({ user_id: p.user_id, name: prof?.name || "Usuário" });
        }
      }

      return list.map((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const creator = profiles.find((p) => p.user_id === t.created_by);
        const assignee = t.assigned_to ? profiles.find((p) => p.user_id === t.assigned_to) : null;
        return {
          ...t,
          creator_name: creator?.name,
          assignee_name: assignee?.name,
          category_name: cat?.name,
          category_color: cat?.color,
          participants: participantsMap[t.id] || [],
        } as Task;
      });
    },
    enabled: profiles.length >= 0,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, () => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["task-comments"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const createTask = useMutation({
    mutationFn: async (payload: {
      task: Partial<Task>;
      participantIds?: string[];
    }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const insertData = { ...payload.task, created_by: user.id };
      const { data, error } = await supabase
        .from("tasks" as any)
        .insert(insertData as any)
        .select()
        .single();
      if (error) throw error;
      const taskId = (data as any).id as string;
      if (payload.participantIds?.length) {
        const rows = payload.participantIds.map((uid) => ({ task_id: taskId, user_id: uid }));
        await supabase.from("task_participants" as any).insert(rows as any);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Tarefa criada");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => toast.error(`Erro ao criar tarefa: ${err.message}`),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const patch: any = { ...updates };
      if (updates.status === "completed" && !updates.completed_at) {
        patch.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("tasks" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa removida");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => toast.error(`Erro ao remover: ${err.message}`),
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, content, currentStatus }: { taskId: string; content: string; currentStatus?: TaskStatus }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("task_comments" as any)
        .insert({ task_id: taskId, user_id: user.id, content } as any);
      if (error) throw error;
      // Move pending → in_progress automaticamente
      if (currentStatus === "pending") {
        await supabase.from("tasks" as any).update({ status: "in_progress" }).eq("id", taskId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-comments"] });
    },
  });

  return {
    tasks: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    categories,
    profiles,
  };
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments" as any)
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
