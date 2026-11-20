ALTER POLICY "Participants can view messages" ON public.operator_chat_messages
  USING (public.is_operator_chat_participant(auth.uid(), chat_id) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
ALTER POLICY "Participants can view chat participants" ON public.operator_chat_participants
  USING (public.is_operator_chat_participant(auth.uid(), chat_id) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
ALTER POLICY "Participants and admins can view chats" ON public.operator_chats
  USING ((created_by = auth.uid()) OR (recipient_user_id = auth.uid()) OR public.is_operator_chat_participant(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));