import { useSearchParams } from 'react-router-dom'
import { useDebounce } from './useDebounce'

export type QuickFilter = 'semua' | 'fast' | 'slow' | 'habis' | 'menumpuk'
type FilterKey = 'produk' | 'varian' | 'ukuran' | 'kondisi' | 'label'
export const productFilterKeys: FilterKey[] = ['produk', 'varian', 'ukuran', 'kondisi', 'label']

export function useProductFilters() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const requestedSearch = query.trim().toLocaleLowerCase('id-ID')
  const appliedQuery = useDebounce(query, 200).trim()
  const search = appliedQuery.toLocaleLowerCase('id-ID')
  const tab = params.get('tab')
  const quick: QuickFilter = tab === 'fast' || tab === 'slow' || tab === 'habis' || tab === 'menumpuk' ? tab : 'semua'
  const requestedPage = Number(params.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  function update(changes: Record<string, string>, replace = false) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (!('page' in changes)) next.delete('page')
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    }, { replace })
  }

  function clear() {
    update({ q: '', tab: '', ...Object.fromEntries(productFilterKeys.map((key) => [key, ''])) })
  }

  return {
    get: (key: FilterKey) => params.get(key) ?? '',
    query,
    appliedQuery,
    search,
    searchPending: search !== requestedSearch,
    quick,
    page,
    view: params.get('view') === 'produk' ? 'produk' as const : 'sku' as const,
    sortParam: params.get('sort') ?? '',
    update,
    clear,
  }
}
