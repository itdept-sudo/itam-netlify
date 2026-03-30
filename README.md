# 🖥️ ITAM Desk — Gestión de Activos IT & Help Desk

ITAM Desk es una plataforma integral para la gestión de inventario tecnológico, asignaciones de equipo y soporte técnico (Help Desk) diseñada para departamentos de IT modernos.

---

## ✨ Características Principales

- **Gestión de Inventario**: Control total sobre activos, modelos y marcas.
- **Buscador de Empleados (RRHH)**: Nuevo portal exclusivo para Recursos Humanos para auditar activos por empleado.
- **Help Desk Realtime**: Sistema de tickets con actualizaciones en vivo y comentarios.
- **Asignaciones Inteligentes**: Vincula equipos a usuarios con un solo clic.
- **Seguridad Robusta**: Autenticación con Google OAuth y Email, protegida por RLS (Row Level Security).
- **Control Administrativo**: Reinicio directo de contraseñas y gestión de roles.

---

## 🚀 Setup Completo (Paso a Paso)

### 1. Preparación en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto.
2. Copia tu **Project URL** y **anon key** (Settings → API).

### 2. Configuración de Base de Datos (SQL)
1. En Supabase → **SQL Editor** → **New Query**.
2. Copia y ejecuta el contenido de `supabase/migration.sql`.
3. **PASO CRÍTICO (Nuevas Funciones)**: Ejecuta también este script para habilitar las funciones de RRHH:
   ```sql
   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_number TEXT DEFAULT '';
   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
   ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'rrhh'));
   ```

### 3. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key  # Requerida para reset de contraseñas
```

### 4. Desarrollo Local
```bash
npm install
npm run dev
```

---

## 🔐 Roles y Permisos

| Función | 👔 Admin | 👤 Usuario | 📋 RRHH |
|---------|:---:|:---:|:---:|
| Dashboard & Gestión Total | ✅ | ❌ | ❌ |
| Inventario & Modelos | ✅ | ❌ | ❌ |
| **Buscador de Empleados** | ✅ | ❌ | ✅ |
| Crear/Ver mis Tickets | ✅ | ✅ | ✅ |
| Gestionar Usuarios | ✅ | ❌ | ❌ |
| Reiniciar Contraseñas | ✅ | ❌ | ❌ |

---

## 📁 Estructura del Proyecto

```
itam-netlify/
├── src/
│   ├── context/
│   │   ├── AuthContext.jsx    ← Gestión de Roles (Admin, RRHH, User)
│   │   └── AppContext.jsx     ← Estado Global & Realtime
│   ├── pages/
│   │   ├── RRHHPortal.jsx     ← [NUEVO] Buscador de activos para RRHH
│   │   ├── UsersManagement.jsx ← Gestión de usuarios y Password Reset
│   │   └── ...
├── supabase/
│   └── migration.sql          ← Esquema de base de datos
```

## 🛠️ Stack Tecnológico
- **React 18** + Vite
- **Supabase** (Auth, DB, Realtime)
- **Tailwind CSS**
- **Lucide React** (Iconos)
- **Resend** (Notificaciones por Email)

---
*Prosper Manufacturing · IT Department*
