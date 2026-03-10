function createSocketEventThrottle({ windowMs, maxEvents }) {
  const stateByKey = new Map();

  function cleanup(now) {
    if (stateByKey.size < 500) {
      return;
    }

    for (const [key, state] of stateByKey.entries()) {
      if ((now - state.windowStart) > (windowMs * 3)) {
        stateByKey.delete(key);
      }
    }
  }

  function isAllowed(key) {
    const now = Date.now();
    cleanup(now);

    const current = stateByKey.get(key);

    if (!current || (now - current.windowStart) >= windowMs) {
      stateByKey.set(key, {
        windowStart: now,
        count: 1
      });
      return true;
    }

    if (current.count >= maxEvents) {
      return false;
    }

    current.count += 1;
    return true;
  }

  return {
    isAllowed
  };
}

module.exports = {
  createSocketEventThrottle
};
