# Project architecture

- Agenda submenu visibility and page access share the URL-to-menu-slug catalog; the Agenda parent gates its Outlet to prevent mounting unauthorized pages. These UI checks do not replace server authentication or data access policies.
- Sector group menu choices derive from the shared catalog, with Agenda entries grouped separately, so new submenus can be configured consistently.- Email polling links replies to existing tickets (protocol in subject/body → Office 365 conversation → normalized subject) and stores them as `email_reply` comments with a pending flag instead of opening new tickets; matching rules live in `src/lib/email-thread.ts` with tests, so threading stays testable without the mailbox.
- Ticket auto-assignment RPCs must join `profiles.user_id` (auth id), not `profiles.id`, because `service_tickets.assigned_to` and `user_sector_assignments.user_id` store auth user ids.

- Assistente IA attachments live in the shared `ai_assistant_files` catalog (private bucket `ai-attachments`); messages reference files via `attachment_ids`, and catalog matching rules live in `src/lib/ai-file-match.ts` with tests, so file lookup stays testable.
