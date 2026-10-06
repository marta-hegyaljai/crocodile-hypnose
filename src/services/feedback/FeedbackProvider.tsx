import React, { createContext, useContext, useEffect } from 'react';

import { useTheme } from '@/theme';

import { createFeedback, type Feedback } from './feedback';

const silent = createFeedback();
const FeedbackContext = createContext<Feedback>(silent);

/** Provides the app's feedback (haptics and UI sounds). Defaults to silence outside a provider. */
export function FeedbackProvider({
  feedback,
  children,
}: {
  feedback: Feedback;
  children: React.ReactNode;
}) {
  return <FeedbackContext.Provider value={feedback}>{children}</FeedbackContext.Provider>;
}

/** The feedback for this atmosphere: Night River mutes it. */
export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  const { feedbackEnabled } = useTheme();
  useEffect(() => {
    feedback.configure({ muted: !feedbackEnabled });
  }, [feedback, feedbackEnabled]);
  return feedback;
}
