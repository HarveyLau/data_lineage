export const deriveSystemKey = (entity: any): string => {
  if (!entity) return '';

  if (entity.system) {
    return String(entity.system);
  }
  if (entity.database) {
    return String(entity.database);
  }
  if (entity.host) {
    return String(entity.host);
  }

  const rawLocation = entity.location || entity.path;
  if (!rawLocation || typeof rawLocation !== 'string') {
    return '';
  }

  const location = rawLocation.trim();
  if (!location) {
    return '';
  }

  const protocolMatch = location.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
  if (protocolMatch?.[1]) {
    return protocolMatch[1];
  }

  if (location.startsWith('/')) {
    return 'filesystem';
  }

  const firstSegment = location.split(/[/:]/).find(Boolean);
  return firstSegment || 'filesystem';
};

