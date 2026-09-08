import {
  MagnifyingGlass,
  CalendarCheck,
  WarningCircle,
  Umbrella,
  FirstAid,
  MoonStars,
  Star,
  HandsPraying,
  ShieldStar,
  User,
  UploadSimple,
  DownloadSimple,
  SignOut,
  Plus,
  PencilSimple,
  Trash,
  CaretRight,
  X,
  ArrowLeft,
  Users,
  ClipboardText,
  Lock,
  CheckCircle,
  XCircle,
  IdentificationCard,
  Briefcase,
  ListChecks,
  Info,
  type IconProps,
} from "phosphor-react-native";
import React from "react";

const MAP: Record<string, React.ComponentType<IconProps>> = {
  MagnifyingGlass,
  CalendarCheck,
  WarningCircle,
  Umbrella,
  FirstAid,
  MoonStars,
  Star,
  HandsPraying,
  ShieldStar,
  User,
  UploadSimple,
  DownloadSimple,
  SignOut,
  Plus,
  PencilSimple,
  Trash,
  CaretRight,
  X,
  ArrowLeft,
  Users,
  ClipboardText,
  Lock,
  CheckCircle,
  XCircle,
  IdentificationCard,
  Briefcase,
  ListChecks,
  Info,
};

export function Icon({
  name,
  size = 22,
  color,
  weight = "regular",
}: {
  name: string;
  size?: number;
  color: string;
  weight?: IconProps["weight"];
}) {
  const Cmp = MAP[name] ?? Info;
  return <Cmp size={size} color={color} weight={weight} />;
}
