import { DocumentRole } from "@prisma/client";

const roleRank: Record<DocumentRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function hasMinimumRole(
  currentRole: DocumentRole,
  requiredRole: DocumentRole,
) {
  return roleRank[currentRole] >= roleRank[requiredRole];
}

export function canEditDocument(role: DocumentRole) {
  return hasMinimumRole(role, DocumentRole.EDITOR);
}

export function canManageMembers(role: DocumentRole) {
  return role === DocumentRole.OWNER;
}

export function formatRole(role: DocumentRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
