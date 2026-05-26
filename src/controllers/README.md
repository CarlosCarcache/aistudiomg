# Controllers (capa C)

Toda la lógica de negocio y acceso a datos vive aquí. Los controllers son los únicos que importan el cliente de Supabase y exponen funciones tipadas (`listProjects`, `signInWithOtp`, …) que las views consumen.

Esto permite cambiar mañana SQL Server externo o un server function sin tocar la UI.
