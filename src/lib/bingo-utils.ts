/**
 * Generate a valid bingo card (5x5 grid)
 * B:1-15, I:16-30, N:31-45, G:46-60, O:61-75, center is 0 (FREE)
 */
export function generateBingoCard(): number[][] {
  const card: number[][] = []
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ]

  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col]
    const available = Array.from({ length: max - min + 1 }, (_, i) => min + i)
    const selected: number[] = []
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        selected.push(0) // FREE space
      } else {
        const idx = Math.floor(Math.random() * available.length)
        selected.push(available.splice(idx, 1)[0])
      }
    }
    card.push(selected)
  }

  // Transpose from column-based to row-based
  const result: number[][] = []
  for (let row = 0; row < 5; row++) {
    result.push([])
    for (let col = 0; col < 5; col++) {
      result[row].push(card[col][row])
    }
  }

  return result
}

/**
 * Check if a bingo card has a valid bingo pattern given the drawn numbers.
 * A valid bingo is a complete row, column, or diagonal where all numbers are marked.
 * The center (FREE) space counts as always marked.
 */
export function checkBingo(card: number[][], drawnNumbers: number[]): boolean {
  const drawnSet = new Set(drawnNumbers)

  // A cell is "marked" if it's the FREE space (0) or its number has been drawn
  const isMarked = (num: number): boolean => num === 0 || drawnSet.has(num)

  // Check rows
  for (let row = 0; row < 5; row++) {
    if (card[row].every(isMarked)) return true
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let complete = true
    for (let row = 0; row < 5; row++) {
      if (!isMarked(card[row][col])) {
        complete = false
        break
      }
    }
    if (complete) return true
  }

  // Check main diagonal (top-left to bottom-right)
  let mainDiag = true
  for (let i = 0; i < 5; i++) {
    if (!isMarked(card[i][i])) {
      mainDiag = false
      break
    }
  }
  if (mainDiag) return true

  // Check anti-diagonal (top-right to bottom-left)
  let antiDiag = true
  for (let i = 0; i < 5; i++) {
    if (!isMarked(card[i][4 - i])) {
      antiDiag = false
      break
    }
  }
  if (antiDiag) return true

  return false
}
