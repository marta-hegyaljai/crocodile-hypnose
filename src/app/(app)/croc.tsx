import React from 'react';

import { HabitatScreen } from '@/features/habitat/HabitatScreen';
import { InactiveGuard } from '@/features/layout/InactiveGuard';

/** The croc's habitat: the lagoon to decorate, its growth, the weekly goal and the scales. */
export default function CrocTab() {
  return (
    <InactiveGuard>
      <HabitatScreen />
    </InactiveGuard>
  );
}
