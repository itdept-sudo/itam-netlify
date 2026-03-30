import {
  Laptop, Monitor, Printer, Server, Smartphone, Keyboard, Mouse,
  Headphones, HardDrive, Package, CheckCircle2, UserCheck, Wrench,
  XCircle, AlertCircle, Clock
} from "lucide-react";

export const ASSET_ICONS = {
  Laptop, Monitor, Impresora: Printer, Servidor: Server,
  "Teléfono": Smartphone, Teclado: Keyboard, Mouse,
  "Audífonos": Headphones, "Disco Duro": HardDrive, Otro: Package
};

export const STATUSES = ["Disponible", "Asignado", "Mantenimiento", "Baja"];

export const STATUS_COLORS = {
  Disponible: { bg: "rgba(16,185,129,0.12)", text: "#10B981", icon: CheckCircle2 },
  Asignado: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6", icon: UserCheck },
  Mantenimiento: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B", icon: Wrench },
  Baja: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", icon: XCircle },
};

export const TICKET_STATUSES = ["Abierto", "Proceso", "Cerrado"];

export const TICKET_COLORS = {
  Abierto: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", icon: AlertCircle },
  Proceso: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B", icon: Clock },
  Cerrado: { bg: "rgba(16,185,129,0.12)", text: "#10B981", icon: CheckCircle2 },
};
