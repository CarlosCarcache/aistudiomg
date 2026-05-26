# Models (capa M)

Tipos, esquemas y formas de datos del dominio. No contienen lógica de UI ni de red directa: solo describen las entidades del sistema (Projects, Chats, Profiles, Roles…).

Los controllers (`src/controllers/`) usan estos tipos para hablar con Supabase, y las views (`src/views/`, `src/routes/`) los consumen ya tipados.
