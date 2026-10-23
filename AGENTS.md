# Project architecture

- Agenda submenu visibility and page access share the URL-to-menu-slug catalog; the Agenda parent gates its Outlet to prevent mounting unauthorized pages. These UI checks do not replace server authentication or data access policies.
- Sector group menu choices derive from the shared catalog, with Agenda entries grouped separately, so new submenus can be configured consistently.