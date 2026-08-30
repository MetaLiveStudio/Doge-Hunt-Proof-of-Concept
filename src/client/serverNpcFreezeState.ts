let serverNpcsFrozen = false

export function areServerNpcsFrozen(): boolean {
  return serverNpcsFrozen
}

export function setServerNpcsFrozen(isFrozen: boolean): void {
  serverNpcsFrozen = isFrozen
}
