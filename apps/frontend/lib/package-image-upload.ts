/** Synchronous ownership for upload callbacks that can outlive their form. */
export function createPackageImageUploadScope() {
  let generation = 0;
  let busy = false;
  let active = true;
  return {
    blocked: () => busy,
    accepts: (owner: number) => active && owner === generation,
    setBusy(owner: number, value: boolean) {
      if (!active || owner !== generation) return false;
      busy = value;
      return true;
    },
    reset() { busy = false; return ++generation; },
    activate() { active = true; },
    dispose() { active = false; },
  };
}
