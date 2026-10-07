import { ph } from './placeholder';

/**
 * English copy. Every user-facing string lives here.
 * Strings wrapped in `ph()` are PLACEHOLDERS for MHP's own copy (see PLAN.md copy rules).
 * `{name}` tokens are interpolated by `t()`.
 */
export const en = {
  app: {
    name: 'MHP Hypnose',
    tagline: ph('[Tagline]'), // PLACEHOLDER
  },
  common: {
    continue: 'Continue',
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    done: 'Done',
    retry: 'Retry',
    loading: 'Loading',
    play: 'Play',
    pause: 'Pause',
    locked: 'Locked',
    comingSoon: 'Coming soon',
    signIn: 'Sign in',
    createAccount: 'Create account',
    getStarted: 'Get started',
  },
  tabs: {
    home: 'Home',
    croc: ph('Croc'), // PLACEHOLDER
    games: 'Games',
    profile: 'Profile',
  },
  points: {
    name: ph('Points'), // PLACEHOLDER
    amount: ph('{n} Points'), // PLACEHOLDER
    gain: ph('+{n} Points'), // PLACEHOLDER
  },
  goal: {
    weekly: 'Weekly goal',
    progress: '{done}/{total} goal',
  },
  croc: {
    defaultName: ph('Croc'), // PLACEHOLDER
    stages: {
      egg: ph('Stage 1'), // PLACEHOLDER
      hatchling: ph('Stage 2'), // PLACEHOLDER
      juvenile: ph('Stage 3'), // PLACEHOLDER
      adult: ph('Stage 4'), // PLACEHOLDER
      grand: ph('Stage 5'), // PLACEHOLDER
    },
  },
  zones: {
    intro: ph('Intro'), // PLACEHOLDER
    sleep: ph('Sleep'), // PLACEHOLDER
    stress: ph('Stress'), // PLACEHOLDER
    confidence: ph('Confidence'), // PLACEHOLDER
    focus: ph('Focus'), // PLACEHOLDER
    habits: ph('Habits'), // PLACEHOLDER
  },
  games: {
    titles: {
      stillness: ph('Stillness'), // PLACEHOLDER
      firefly: ph('Firefly'), // PLACEHOLDER
      breathing: ph('Breathing'), // PLACEHOLDER
    },
    howTo: {
      stillness: ph(
        '[Stillness how-to: hold still; the stiller you are, the lower the croc sinks]',
      ), // PLACEHOLDER
      firefly: ph('[Firefly how-to: follow the firefly with your eyes, three slow rounds]'), // PLACEHOLDER
      breathing: ph('[Breathing how-to: hold the water to breathe in, let go to breathe out]'), // PLACEHOLDER
    },
    skill: {
      stillness: ph('[Skill taught: stillness]'), // PLACEHOLDER
      firefly: ph('[Skill taught: eye fixation]'), // PLACEHOLDER
      breathing: ph('[Skill taught: slow breathing]'), // PLACEHOLDER
    },
    clearing: {
      title: 'Games',
      body: ph('[Games clearing intro]'), // PLACEHOLDER
      best: 'Best: {result}',
      plays: 'Played {n} times',
      playsOne: 'Played once',
      neverPlayed: 'Not played yet',
      a11yCard: '{title}, {duration}, {plays}',
    },
    shell: {
      start: 'Start',
      pause: 'Pause',
      paused: 'Paused',
      resume: 'Keep going',
      quit: 'Leave the game',
      quitNote: 'You can leave any time. Nothing is lost.',
      back: 'Back',
      endTitle: ph('[Game finished]'), // PLACEHOLDER
      eyesClosed: ph('[Invitation: now try it once more with your eyes closed]'), // PLACEHOLDER
      playAgain: 'Play again',
      done: 'Done',
      notFound: 'This game is not available.',
      a11yStage: '{title} game',
    },
    result: {
      stillness: '{n}/100 still',
      firefly: '{n} of {total} rounds',
      breathing: '{n} breaths',
      breathingOne: '1 breath',
    },
    stillness: {
      restFinger: ph('[Rest a finger on the lily pad and keep it still]'), // PLACEHOLDER
      holdPhone: ph('[Hold your phone still]'), // PLACEHOLDER
      a11yPad: 'Lily pad. Rest a finger here and keep it still.',
    },
    firefly: {
      round: 'Round {n} of {total}',
      follow: ph('[Follow the firefly with your eyes]'), // PLACEHOLDER
      closeEyes: ph('[Now close your eyes for a moment]'), // PLACEHOLDER
    },
    breathing: {
      holdIn: ph('Hold: breathe in'), // PLACEHOLDER
      releaseOut: ph('Let go: breathe out'), // PLACEHOLDER
      a11yWater: 'The water. Press and hold to breathe in, release to breathe out.',
    },
  },
  mood: {
    question: ph('[Mood question]'), // PLACEHOLDER
    labels: {
      1: ph('Mood 1'), // PLACEHOLDER
      2: ph('Mood 2'), // PLACEHOLDER
      3: ph('Mood 3'), // PLACEHOLDER
      4: ph('Mood 4'), // PLACEHOLDER
      5: ph('Mood 5'), // PLACEHOLDER
    },
  },
  auth: {
    mhpAccount: 'MHP account',
    // Explains that MHP Hypnose and MHP Coaching share one account.
    sharedAccountNote: ph(
      'Same account as MHP Coaching: sign in with the email and password you use there.',
    ), // PLACEHOLDER
    welcome: {
      title: 'Welcome',
      signIn: 'Sign in with MHP account',
      createAccount: 'Create account',
    },
    fields: {
      name: 'Name (optional)',
      email: 'Email',
      password: 'Password',
      newPassword: 'Password',
      passwordHint: 'At least {n} characters',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
    },
    validation: {
      emailRequired: 'Enter your email address.',
      emailInvalid: 'Enter a valid email address.',
      passwordRequired: 'Enter your password.',
      passwordShort: 'Use at least {n} characters.',
      passwordLong: 'Use at most {n} characters.',
      nameLong: 'Use at most {n} characters.',
    },
    errors: {
      invalidCredentials: 'Email or password is incorrect.',
      emailTaken: 'An account with this email already exists.',
      offline: 'You are offline. Check your connection and try again.',
      unreachable: 'The server cannot be reached right now. Try again in a moment.',
      serverError: 'Something went wrong on our side. Try again in a moment.',
      rateLimited: 'Too many attempts. Wait a minute, then try again.',
      unknown: 'Something went wrong. Try again.',
    },
    signIn: {
      title: 'Sign in',
      subtitle: 'Use your MHP account.',
      submit: 'Sign in',
      forgot: 'Forgot password?',
      noAccount: 'No account yet?',
      createAccount: 'Create account',
    },
    signUp: {
      title: 'Create account',
      submit: 'Create account',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
      signInInstead: 'Sign in instead',
    },
    forgot: {
      title: 'Reset password',
      body: 'Enter the email address of your MHP account. We will send you a link to set a new password.',
      submit: 'Send link',
      sentTitle: 'Check your email',
      sentBody: 'If an MHP account exists for {email}, a link to set a new password is on its way.',
      backToSignIn: 'Back to sign in',
    },
    reset: {
      title: 'Set a new password',
      body: 'Choose a new password for your MHP account. You will be signed out everywhere and can sign in with the new password.',
      submit: 'Save password',
      invalidLink: 'This reset link is not valid any more. Request a new one.',
      requestNew: 'Request a new link',
      signedInNote:
        'You are signed in on this device. To get a new link, sign out and use "Forgot password?".',
      goHome: 'Go to home',
    },
    notices: {
      sessionEnded: 'You were signed out. Sign in again to continue.',
      actionInterrupted:
        'You were signed out, so your last action did not go through. Sign in again to continue.',
      accountDeleted: 'Your account was deleted.',
      passwordChanged: 'Your password was changed. Sign in with your new password.',
    },
  },
  home: {
    greeting: ph('Hi, {name}'), // PLACEHOLDER
    signedInAs: 'Signed in as {email}',
    accountCreated: 'Account created',
    signOut: 'Sign out',
    today: {
      label: ph('[Today]'), // PLACEHOLDER
      labelResume: ph('[Continue]'), // PLACEHOLDER
      labelReplay: ph('[Play again]'), // PLACEHOLDER
      meta: '{zone} · {duration} {type}',
      play: 'Play {title}',
      empty: ph('[No session available]'), // PLACEHOLDER
    },
    syncPending: 'Saved on this device. It syncs when you are back online.',
  },
  stops: {
    intro: {
      s1: ph('Intro · Stop 1'), // PLACEHOLDER
      s2: ph('Intro · Stop 2'), // PLACEHOLDER
      s3: ph('Intro · Stop 3'), // PLACEHOLDER
      s4: ph('Intro · Stop 4'), // PLACEHOLDER
      s5: ph('Intro · Stop 5'), // PLACEHOLDER
      s6: ph('Intro · Stop 6'), // PLACEHOLDER
      s7: ph('Intro · Stop 7'), // PLACEHOLDER
      s8: ph('Intro · Stop 8'), // PLACEHOLDER
      s9: ph('Intro · Stop 9'), // PLACEHOLDER
    },
    sleep: {
      s1: ph('Sleep · Stop 1'), // PLACEHOLDER
      s2: ph('Sleep · Stop 2'), // PLACEHOLDER
      s3: ph('Sleep · Stop 3'), // PLACEHOLDER
      s4: ph('Sleep · Stop 4'), // PLACEHOLDER
      s5: ph('Sleep · Stop 5'), // PLACEHOLDER
      s6: ph('Sleep · Stop 6'), // PLACEHOLDER
      s7: ph('Sleep · Stop 7'), // PLACEHOLDER
      s8: ph('Sleep · Stop 8'), // PLACEHOLDER
      s9: ph('Sleep · Stop 9'), // PLACEHOLDER
      s10: ph('Sleep · Stop 10'), // PLACEHOLDER
    },
  },
  stopTypes: {
    video: 'Video',
    audio: 'Audio',
    visual: 'Visual',
    game: 'Game',
    longTrance: ph('Long trance'), // PLACEHOLDER
  },
  duration: {
    minutes: '{n} min',
  },
  map: {
    a11y: 'River map',
    zoneProgress: '{done}/{total}',
    zoneProgressA11y: '{zone}: {done} of {total} done',
    zoneComingSoon: '{zone}: coming soon',
    zoneLocked: '{zone}: locked',
    status: {
      locked: 'Locked',
      available: 'Ready',
      inProgress: 'Started',
      done: 'Done',
      caution: 'Not suggested for you',
    },
    stopA11y: '{title}, {type}, {duration}, {status}',
    current: 'You are here',
    sheet: {
      start: 'Start',
      resume: 'Continue',
      replay: 'Play again',
      lockedPrevious: 'Finish {title} first to unlock this stop.',
      lockedZone: 'Finish {zone} first to open this part of the river.',
      lockedComingSoon: 'This part of the river is coming soon.',
      caution: ph('[Caution mode: why this stop is not suggested]'), // PLACEHOLDER
      done: 'You finished this stop. You can play it again any time.',
    },
  },
  session: {
    back: 'Back to the river',
    completeDev: 'Complete (dev)',
    notFound: 'This session is not available.',
    meta: '{type} · {duration}',
    intro: ph('[Session intro]'), // PLACEHOLDER
    longTranceIntro: ph('[Long trance intro]'), // PLACEHOLDER
    drivingNote: ph('[Do not listen while driving]'), // PLACEHOLDER
    cautionNote: ph('[Not suggested in caution mode]'), // PLACEHOLDER
    start: 'Start',
    resume: 'Resume at {time}',
    restart: 'Start over',
    playAgain: 'Play again',
    moodTitle: 'Mood check',
    moodAfterTitle: 'Mood check',
    moodSkip: 'Skip',
    moodContinue: 'Continue',
    moodChange: 'Before: {from} · After: {to}',
    endedTitle: 'Session ended',
    endedBody: ph('[Session ended early text]'), // PLACEHOLDER
    notFinished: ph('[Listen to most of the session to finish it]'), // PLACEHOLDER
    rewardTitle: ph('[Reward title]'), // PLACEHOLDER
    rewardFirstTime: ph('[First time bonus] +{n}'), // PLACEHOLDER
    rewardContinue: 'Back to the river',
    gameSoon: ph('[Games: coming in step 6]'), // PLACEHOLDER
  },
  player: {
    a11y: 'Session player',
    back15: 'Back 15 seconds',
    sound: 'Background sound',
    soundscapes: {
      none: 'Off',
      river: ph('River'), // PLACEHOLDER
      rain: ph('Rain'), // PLACEHOLDER
      night: ph('Night'), // PLACEHOLDER
    },
    remaining: '{time} left',
    captions: 'Captions',
    captionsOn: 'Hide captions',
    captionsOff: 'Show captions',
    end: 'End session',
    endTitle: 'End the session?',
    endBody: ph('[End session early text]'), // PLACEHOLDER
    endConfirm: 'End session',
    endCancel: 'Keep going',
    audioUnavailable: 'The audio could not be loaded. The session continues in silence.',
    videoUnavailable: 'The video could not be loaded. The lesson continues without it.',
    revealHint: 'Tap anywhere to show the controls',
    visual: {
      fixation: ph('[Rest your eyes on the glow]'), // PLACEHOLDER
      breathing: ph('[Breathe with the ring]'), // PLACEHOLDER
      imagery: ph('[Imagery {n}]'), // PLACEHOLDER
    },
    a11yVisual: 'Visual exercise',
    a11yVideo: 'Video lesson',
  },
  tabsPlaceholder: {
    croc: ph('[Croc habitat: coming in step 7]'), // PLACEHOLDER
    games: ph('[Games: coming in step 6]'), // PLACEHOLDER
    profile: ph('[Profile and settings: coming in step 8]'), // PLACEHOLDER
  },
  account: {
    delete: 'Delete account',
    deleteTitle: 'Delete account?',
    // Scope still to be decided by MHP (whole MHP account vs. Hypnose data only); see the concept.
    deleteBody: ph(
      'This deletes your MHP account, which MHP Coaching uses too, and all your MHP Hypnose data. This cannot be undone.',
    ), // PLACEHOLDER
    deleteConfirm: 'Delete my account',
    deleteCancel: 'Keep my account',
  },
  onboarding: {
    stepLabel: 'Step {index} of {total}',
    loading: 'Loading your river',
    loadingProblem: 'The server cannot be reached right now. Your progress is safe.',
    syncProblem: 'Your answers could not be saved to the server yet. They are kept on this device.',
    menu: {
      open: 'Account',
      signedInAs: 'Signed in as {email}',
      note: 'Your progress is saved to your account. You can carry on later.',
      signOut: 'Sign out',
      cancel: 'Cancel',
    },
    goals: {
      title: 'Your goals',
      body: ph('[Goals question: pick one or two]'), // PLACEHOLDER
      picked: '{n} of {max} picked',
      limit: 'Pick at most {max}. Unpick one to change it.',
    },
    experience: {
      title: 'Experience and timing',
      experienceQuestion: ph('[Experience question]'), // PLACEHOLDER
      new: ph('New to hypnosis'), // PLACEHOLDER
      experienced: ph('Experienced'), // PLACEHOLDER
      timeQuestion: ph('[Time of day question]'), // PLACEHOLDER
      morning: 'Morning',
      evening: 'Evening',
      lengthQuestion: ph('[Session length question]'), // PLACEHOLDER
      short: 'Short',
      medium: 'Medium',
      long: 'Long',
      shortDetail: ph('about 5 min'), // PLACEHOLDER
      mediumDetail: ph('about 10 min'), // PLACEHOLDER
      longDetail: ph('about 20 min'), // PLACEHOLDER
    },
    safety: {
      title: 'Quick safety check',
      body: ph('[Safety check intro]'), // PLACEHOLDER
      questions: {
        1: ph('[Safety question 1]'), // PLACEHOLDER
        2: ph('[Safety question 2]'), // PLACEHOLDER
        3: ph('[Safety question 3]'), // PLACEHOLDER
      },
      yes: 'Yes',
      no: 'No',
      privacy: ph('[Privacy note: answers are never shared]'), // PLACEHOLDER
      infoTitle: ph('[Safety information title]'), // PLACEHOLDER
      infoBody: ph('[Safety information: calm, non-alarming text]'), // PLACEHOLDER
      infoAcknowledge: 'I understand',
      a11yQuestion: 'Question {n} of {total}',
    },
    consent: {
      title: 'Mood check-ins',
      body: ph('[Mood data consent text]'), // PLACEHOLDER
      allow: 'Allow mood check-ins',
      allowDetail: ph('[Consent option: store mood check-ins]'), // PLACEHOLDER
      decline: 'Skip mood check-ins',
      declineDetail: ph('[Consent option: the app works without them]'), // PLACEHOLDER
      note: ph('[Consent note: change this any time in settings]'), // PLACEHOLDER
    },
    hatch: {
      title: 'Hatch your croc',
      tapHint: 'Tap the egg {n} times',
      tapHintMore: '{n} more taps',
      tapHintOne: 'One more tap',
      a11yEggOne: 'Crocodile egg. Tap to hatch, one tap to go.',
      hatched: ph('[Hatched]'), // PLACEHOLDER
      nameTitle: 'Name your croc',
      nameLabel: 'Name',
      nameHint: '1 to {n} characters',
      nameBlank: 'Enter a name.',
      nameLong: 'Use at most {n} characters.',
      a11yEgg: 'Crocodile egg. Tap to hatch, {n} taps to go.',
      a11yHatched: 'Your crocodile has hatched.',
    },
    firstSession: {
      title: 'Your first session',
      body: ph('[First session intro]'), // PLACEHOLDER
      start: 'Start',
      playAgain: 'Play again',
      moodTitle: 'Mood check',
      skipMood: 'Skip',
      breatheIn: ph('Breathe in'), // PLACEHOLDER
      breatheOut: ph('Breathe out'), // PLACEHOLDER
      completeTitle: 'Session complete',
      completeBody: ph('[First session complete text]'), // PLACEHOLDER
      endedTitle: 'Session ended',
      endedBody: ph('[Session ended early text]'), // PLACEHOLDER
      a11yBreathing: 'Breathing guide',
    },
    reminder: {
      title: 'Daily reminder',
      body: ph('[Reminder opt-in text]'), // PLACEHOLDER
      time: 'Every day at {time}',
      enable: 'Turn on reminders',
      skip: 'Not now',
      webUnavailable:
        'Reminders are not available in the browser. You can turn them on in the app later.',
      denied:
        'Notifications are turned off for this app. You can allow them in your device settings and turn reminders on later.',
      enabled: 'Reminders are on.',
      notificationTitle: ph('[Reminder notification title]'), // PLACEHOLDER
      notificationBody: ph('[Reminder notification body]'), // PLACEHOLDER
    },
    done: {
      title: 'All set',
      body: ph('[Onboarding done text]'), // PLACEHOLDER
      points: ph('+{n} Points'), // PLACEHOLDER
      crocReady: ph('{name} is with you'), // PLACEHOLDER
      goHome: 'Go to home',
    },
  },
  gamification: {
    pointsWithPending: ph('{n} +{pending}'), // PLACEHOLDER
    a11yPointsPending: '{n} points, {pending} more waiting to sync',
    pendingSync: ph('+{n} Points waiting to sync'), // PLACEHOLDER
    growth: {
      title: ph('[Growth title]'), // PLACEHOLDER
      message: ph('{name} reached {stage}.'), // PLACEHOLDER
      continue: 'Continue',
    },
    weekly: {
      reachedTitle: ph('[Weekly goal reached]'), // PLACEHOLDER
      reachedMessage: ph('{done} of {total} days this week.'), // PLACEHOLDER
      dismiss: 'Close',
      title: 'Weekly goal',
      days: ph('{n} days a week'), // PLACEHOLDER
      less: 'Fewer days',
      more: 'More days',
      progress: ph('{done} of {total} days this week'), // PLACEHOLDER
    },
    habitat: {
      title: ph('[Habitat title]'), // PLACEHOLDER
      stage: ph('{stage}'), // PLACEHOLDER
      calm: ph('{n} calm minutes'), // PLACEHOLDER
      nextStage: ph('{n} more minutes to {stage}'), // PLACEHOLDER
      fullGrown: ph('[Fully grown]'), // PLACEHOLDER
      decorations: ph('[Decorations]'), // PLACEHOLDER
      badges: ph('[Scales]'), // PLACEHOLDER
      buy: ph('{n} Points'), // PLACEHOLDER
      place: 'Place',
      remove: 'Take out',
      owned: 'Owned',
      locked: 'Locked',
      unlockBy: ph('Unlocked by: {badge}'), // PLACEHOLDER
      unlockFree: 'Claim',
      insufficient: ph('Not enough points yet.'), // PLACEHOLDER
      morePoints: ph('{n} more points'), // PLACEHOLDER
      willSwap: ph('Takes the place of {item}'), // PLACEHOLDER
      lockedError: ph('Not unlocked yet.'), // PLACEHOLDER
      offline: 'Buying needs a connection. Try again when you are online.',
      error: 'That did not work. Try again.',
      a11yItem: '{name}, {state}',
      a11yBadge: '{name}, {state}',
      earned: 'Earned',
      notEarned: 'Not earned yet',
      a11yScene: '{name} in the lagoon with {count} decorations',
    },
    items: {
      lilyPads: ph('Lily pads'), // PLACEHOLDER
      reeds: ph('Reeds'), // PLACEHOLDER
      stones: ph('Stones'), // PLACEHOLDER
      driftwood: ph('Driftwood'), // PLACEHOLDER
      dragonflies: ph('Dragonflies'), // PLACEHOLDER
      lotus: ph('Lotus'), // PLACEHOLDER
      fireflies: ph('Fireflies'), // PLACEHOLDER
      mangrove: ph('Mangrove'), // PLACEHOLDER
      heron: ph('Heron'), // PLACEHOLDER
      waterfall: ph('Waterfall'), // PLACEHOLDER
      glowLotus: ph('Glowing lotus'), // PLACEHOLDER
      turtle: ph('Turtle'), // PLACEHOLDER
    },
    newScale: ph('New scale: {name}'), // PLACEHOLDER
    a11yNewScale: '{name} scale earned, {n} points',
    badges: {
      firstSession: ph('First session'), // PLACEHOLDER
      firstLongTrance: ph('First long trance'), // PLACEHOLDER
      firstStillness: ph('First stillness game'), // PLACEHOLDER
      firstFirefly: ph('First firefly game'), // PLACEHOLDER
      firstBreathing: ph('First breathing game'), // PLACEHOLDER
      days3: ph('3 days'), // PLACEHOLDER
      days7: ph('7 days'), // PLACEHOLDER
      days30: ph('30 days'), // PLACEHOLDER
      zoneCompleted: ph('Zone completed'), // PLACEHOLDER
      firstDecoration: ph('First decoration'), // PLACEHOLDER
    },
  },
  notFound: {
    title: 'Page not found',
    home: 'Go home',
  },
  dev: {
    gallery: 'Component gallery',
    skipSession: 'Skip (dev)',
  },
  a11y: {
    crocMascot: '{name}, your crocodile',
    crocStage: '{name}, {stage}',
    egg: 'Crocodile egg',
    points: '{n} points',
    goalProgress: '{done} of {total} days this week',
    progress: '{percent} percent',
    loading: 'Loading',
    tabBar: 'Main navigation',
    back: 'Back',
    selected: 'Selected',
    onboardingProgress: 'Onboarding progress: step {index} of {total}',
    weeklyGoal: 'Weekly goal: {done} of {total}',
  },
} as const;

export type Copy = typeof en;
