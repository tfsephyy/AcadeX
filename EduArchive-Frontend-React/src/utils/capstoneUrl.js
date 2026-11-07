/** Prefer the stable, server-generated slug; retain legacy records and bookmarks. */
export function capstoneKey(capstone) {
  return encodeURIComponent(capstone?.slug || capstone?.id || '')
}

export function capstoneUrl(role, capstone) {
  return `/${role}/capstones/${capstoneKey(capstone)}`
}
