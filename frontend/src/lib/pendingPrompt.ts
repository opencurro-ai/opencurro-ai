let pendingPrompt: string | null = null

export function setPendingPrompt(prompt: string): void {
  pendingPrompt = prompt
}

export function consumePendingPrompt(): string | null {
  const prompt = pendingPrompt
  pendingPrompt = null
  return prompt
}
