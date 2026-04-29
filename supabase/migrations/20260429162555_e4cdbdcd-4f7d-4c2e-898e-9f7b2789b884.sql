-- ============================================
-- task_categories
-- ============================================
CREATE TABLE public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories viewable by authenticated"
  ON public.task_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.task_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- tasks
-- ============================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  due_date timestamptz,
  category_id uuid REFERENCES public.task_categories(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  is_group_task boolean NOT NULL DEFAULT false,
  recurrence_type text,
  recurrence_interval integer,
  recurrence_end_date timestamptz,
  parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  completed_at timestamptz,
  reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_ticket_id ON public.tasks(ticket_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- ============================================
-- task_participants
-- ============================================
CREATE TABLE public.task_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);
ALTER TABLE public.task_participants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- task_comments
-- ============================================
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper functions (SECURITY DEFINER, evita recursão de RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_task_creator(_user_id uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tasks WHERE id=_task_id AND created_by=_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_task_assigned(_user_id uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tasks WHERE id=_task_id AND assigned_to=_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_task_participant(_user_id uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.task_participants WHERE task_id=_task_id AND user_id=_user_id);
$$;

-- ============================================
-- RLS Policies — tasks
-- ============================================
CREATE POLICY "Users can create tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Task members can view tasks" ON public.tasks
  FOR SELECT TO authenticated USING (
    auth.uid() = created_by OR auth.uid() = assigned_to
    OR public.is_task_participant(auth.uid(), id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Task members can update tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (
    auth.uid() = created_by OR auth.uid() = assigned_to
    OR public.is_task_participant(auth.uid(), id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Creator or admin can delete tasks" ON public.tasks
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================
-- RLS Policies — task_participants
-- ============================================
CREATE POLICY "Participants viewable by task members" ON public.task_participants
  FOR SELECT TO authenticated USING (
    public.is_task_creator(auth.uid(), task_id)
    OR public.is_task_assigned(auth.uid(), task_id)
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Task creator can manage participants" ON public.task_participants
  FOR INSERT TO authenticated WITH CHECK (
    public.is_task_creator(auth.uid(), task_id) OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Task creator can delete participants" ON public.task_participants
  FOR DELETE TO authenticated USING (
    public.is_task_creator(auth.uid(), task_id) OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================
-- RLS Policies — task_comments
-- ============================================
CREATE POLICY "Comments viewable by task members" ON public.task_comments
  FOR SELECT TO authenticated USING (
    public.is_task_creator(auth.uid(), task_id)
    OR public.is_task_assigned(auth.uid(), task_id)
    OR auth.uid() = user_id
    OR public.is_task_participant(auth.uid(), task_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can create comments" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.task_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- updated_at trigger
-- ============================================
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Trigger de Recorrência Automática
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_advance_recurring_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_next_due timestamptz;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status <> 'completed')
     AND NEW.recurrence_type IS NOT NULL
     AND NEW.recurrence_type <> 'none' THEN

    v_next_due := COALESCE(NEW.due_date, now());

    CASE NEW.recurrence_type
      WHEN 'daily'    THEN v_next_due := v_next_due + interval '1 day';
      WHEN 'weekly'   THEN v_next_due := v_next_due + interval '7 days';
      WHEN 'biweekly' THEN v_next_due := v_next_due + interval '14 days';
      WHEN 'monthly'  THEN v_next_due := v_next_due + interval '1 month';
      WHEN 'yearly'   THEN v_next_due := v_next_due + interval '1 year';
      ELSE v_next_due := NULL;
    END CASE;

    IF v_next_due IS NOT NULL
       AND (NEW.recurrence_end_date IS NULL OR v_next_due <= NEW.recurrence_end_date) THEN
      NEW.status := 'pending';
      NEW.completed_at := NULL;
      NEW.due_date := v_next_due;
      NEW.updated_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_advance_recurring_task
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.auto_advance_recurring_task();

-- ============================================
-- Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;