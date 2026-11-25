const numericSizes = Array.from({ length: 11 }, (_, index) => String(index + 28))

export interface Product {
  id: string
  name: string
  sizeType: 'huruf' | 'angka'
  variants: readonly string[]
  sizes: readonly string[]
  /** Kombinasi yang tidak dijual (varian dan ukuran). */
  unavailable: readonly (readonly [string, string])[]
  median: number
  stockTarget: number
  fastTarget: number
  restockTarget: number
  stackedSlowTarget: number
}

// Rentang angka tetap 28–38. Beberapa warna tidak tersedia dalam semua ukuran.
export const products: readonly Product[] = [
  {
    id: 'KMJDENIM', name: 'Kemeja Denim', sizeType: 'huruf',
    variants: ['Hitam', 'Biru Muda', 'Biru Tua', 'Navy', 'Abu', 'Putih'],
    sizes: ['M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'], unavailable: [],
    median: 610, stockTarget: 760, fastTarget: 17, restockTarget: 4, stackedSlowTarget: 5,
  },
  {
    id: 'TJB', name: 'Tony Jack Biasa', sizeType: 'angka',
    variants: ['Hitam', 'Krem', 'Navy', 'Abu', 'Cokelat'],
    sizes: numericSizes, unavailable: [['Cokelat', '28'], ['Cokelat', '38'], ['Krem', '28']],
    median: 480, stockTarget: 1100, fastTarget: 26, restockTarget: 3, stackedSlowTarget: 5,
  },
  {
    id: 'IHU', name: 'Iron Head Ultimate', sizeType: 'angka',
    variants: ['Hitam', 'Navy', 'Abu', 'Krem'],
    sizes: numericSizes, unavailable: [
      ['Krem', '28'], ['Krem', '29'], ['Krem', '37'], ['Krem', '38'], ['Navy', '28'], ['Abu', '28'],
    ],
    median: 300, stockTarget: 570, fastTarget: 18, restockTarget: 2, stackedSlowTarget: 4,
  },
]
