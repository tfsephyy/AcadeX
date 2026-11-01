// Laravel's paginator wraps items in `data`; older endpoints return the array.
export function unpackList(value) {
  if (Array.isArray(value)) return { items: value, pagination: null }
  if (value && Array.isArray(value.data)) return { items: value.data, pagination: value }
  return { items: [], pagination: null }
}
