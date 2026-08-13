export function getNextLink(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/iu);
  return match?.[1] || null;
}
