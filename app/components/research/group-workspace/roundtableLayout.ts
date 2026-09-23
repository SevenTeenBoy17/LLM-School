import type { GroupMember } from "@/lib/research-groups";

export function tablePage(members: GroupMember[], requestedPage: number, compact: boolean) {
  const ordered = [...members].sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));
  const owner = ordered.find(member => member.isOwner);
  const others = ordered.filter(member => member !== owner);
  const capacity = compact ? 4 : 8;
  const perPage = capacity - (owner ? 1 : 0);
  const pages = Math.max(1, Math.ceil(others.length / perPage));
  const page = Math.max(0, Math.min(requestedPage, pages - 1));
  return { page, pages, capacity, displayed: [...(owner ? [owner] : []), ...others.slice(page * perPage, (page + 1) * perPage)] };
}

export function tableDimensions(width: number, compact: boolean) {
  const radius = Math.min(148, Math.max(76, (width - 88) / 2));
  return compact
    ? { height: 460, diameter: (radius - 46) * 2 / 1.24, radius, portrait: 64 }
    : { height: 680, diameter: 296, radius: 234, portrait: 72 };
}

export function seatPosition(index: number, count: number, width: number, compact: boolean) {
  const { height, radius } = tableDimensions(width, compact);
  const angle = -Math.PI / 2 + index * 2 * Math.PI / Math.max(count, 1);
  return { left: width / 2 + Math.cos(angle) * radius, top: height / 2 + Math.sin(angle) * radius,
    above: Math.sin(angle) < -0.25 };
}
