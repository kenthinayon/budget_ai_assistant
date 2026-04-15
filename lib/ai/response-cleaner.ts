function cleanTableLine(line: string) {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)

  if (cells.length < 2) return line

  const [first, ...rest] = cells
  return `${first}: ${rest.join(", ")}`
}

export function sanitizeAiText(input: string) {
  const lines = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((rawLine) => {
      let line = rawLine

      if (/^\s*\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(line)) {
        return ""
      }

      if (line.includes("|") && line.split("|").length >= 3) {
        line = cleanTableLine(line)
      }

      line = line
        .replace(/^\s{0,3}#{1,6}\s*/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^\s*[-*]\s+/g, "- ")
        .replace(/^\s*\d+\.\s+/g, "")
        .replace(/\*/g, "")
        .trimEnd()

      return line
    })

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
