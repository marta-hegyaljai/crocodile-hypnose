import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { devMode } from '@/config/env';
import { t } from '@/copy';
import {
  CROC_EXPRESSIONS,
  CROC_STAGES,
  Croc,
  FarJungle,
  Fireflies,
  JungleLeaves,
  Lagoon,
  LilyPad,
  Reeds,
  RiverPath,
  WaterSurface,
  type CrocExpression,
  type CrocPose,
  type CrocStage,
} from '@/illustration';
import { useMotionSettings } from '@/motion/MotionProvider';
import {
  palette,
  radius,
  space,
  typeScale,
  useTheme,
  type Atmosphere,
  type TextVariant,
} from '@/theme';
import {
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Notice,
  ProgressBar,
  Screen,
  TabBar,
  Text,
  TextField,
  type IconName,
} from '@/ui';

/*
 * Dev-only component gallery. Labels in this file are developer-facing and intentionally not in the
 * copy module (the lint rule is relaxed for src/app/dev/**). Nothing here ships when devMode is off.
 */

const ICONS: IconName[] = [
  'home',
  'croc',
  'games',
  'profile',
  'play',
  'pause',
  'lock',
  'check',
  'close',
  'back',
  'drop',
  'leaf',
  'sparkle',
  'eye',
  'eyeOff',
  'info',
  'alert',
  'mail',
];
const TEXT_VARIANTS = Object.keys(typeScale) as TextVariant[];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} testID={`gallery-section-${id}`}>
      <Text variant="heading" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="muted" style={styles.label}>
      {children}
    </Text>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchColor, { backgroundColor: value, borderColor: colors.border }]} />
      <Text variant="caption">{name}</Text>
      <Text variant="caption" tone="muted">
        {value}
      </Text>
    </View>
  );
}

function GalleryContent({
  atmosphere,
  setAtmosphere,
}: {
  atmosphere: Atmosphere;
  setAtmosphere: (a: Atmosphere) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const { width } = useWindowDimensions();
  const motionSettings = useMotionSettings();
  const [tab, setTab] = useState('home');
  const [progress, setProgress] = useState(0.35);
  const [pose, setPose] = useState<CrocPose>('peek');
  const [viewerStage, setViewerStage] = useState<CrocStage>('juvenile');
  const [viewerExpression, setViewerExpression] = useState<CrocExpression>('happy');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  const [fieldText, setFieldText] = useState('');
  const [secretText, setSecretText] = useState('river walk');

  const night = atmosphere === 'night';
  const crocCols = pose === 'full' ? 3 : 6;
  const crocCell = Math.floor(
    (Math.min(width, 520) - space.lg * 2 - space.sm * (crocCols - 1)) / crocCols,
  );
  const expressionRows = Array.from(
    { length: Math.ceil(CROC_EXPRESSIONS.length / crocCols) },
    (_, r) => CROC_EXPRESSIONS.slice(r * crocCols, (r + 1) * crocCols),
  );
  const sceneWidth = Math.min(width, 520) - space.lg * 2;

  return (
    <View style={styles.page}>
      <View style={styles.toolbar}>
        <IconButton
          icon="back"
          accessibilityLabel={t('common.back')}
          onPress={() => router.replace('/')}
          testID="gallery-back"
        />
        <Text variant="title" style={styles.grow}>
          {t('dev.gallery')}
        </Text>
      </View>
      <View style={styles.row}>
        <Button
          label="Daylight"
          size="sm"
          variant={night ? 'ghost' : 'secondary'}
          onPress={() => setAtmosphere('daylight')}
          testID="gallery-toggle-daylight"
        />
        <Button
          label="Night"
          size="sm"
          variant={night ? 'secondary' : 'ghost'}
          onPress={() => setAtmosphere('night')}
          testID="gallery-toggle-night"
        />
        <Button
          label={motionSettings.reducedMotion ? 'Motion: reduced' : 'Motion: full'}
          size="sm"
          variant="ghost"
          onPress={() => motionSettings.setOverride(motionSettings.reducedMotion ? false : true)}
          testID="gallery-toggle-motion"
        />
      </View>
      <Label>{`System reduce-motion: ${motionSettings.systemReducedMotion ? 'on' : 'off'} · override: ${String(motionSettings.override)}`}</Label>

      <Section id="colors" title="Colours">
        <Label>Palette</Label>
        <View style={styles.wrap}>
          {Object.entries(palette).map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
        </View>
        <Label>{`Theme colours (${atmosphere})`}</Label>
        <View style={styles.wrap}>
          {Object.entries(colors).map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
        </View>
      </Section>

      <Section id="type" title="Type">
        {TEXT_VARIANTS.map((variant) => (
          <View key={variant} style={styles.typeRow}>
            <Text
              variant={variant}
            >{`${variant} · ${typeScale[variant].fontSize}/${typeScale[variant].lineHeight}`}</Text>
          </View>
        ))}
        <Label>Tones</Label>
        <View style={styles.wrap}>
          {(['primary', 'secondary', 'muted', 'accent', 'water'] as const).map((tone) => (
            <Text key={tone} tone={tone}>
              {tone}
            </Text>
          ))}
        </View>
        <Label>Placeholder copy is marked in dev mode</Label>
        <Text>{t('app.tagline')}</Text>
      </Section>

      <Section id="spacing" title="Spacing and radii">
        <View style={styles.wrap}>
          {Object.entries(space).map(([name, value]) => (
            <View key={name} style={styles.center}>
              <View
                style={{
                  width: value,
                  height: value,
                  backgroundColor: colors.water,
                  borderRadius: 2,
                }}
              />
              <Text variant="caption" tone="muted">{`${name} ${value}`}</Text>
            </View>
          ))}
        </View>
        <View style={styles.wrap}>
          {Object.entries(radius).map(([name, value]) => (
            <View key={name} style={styles.center}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: colors.primary,
                  borderRadius: value,
                }}
              />
              <Text variant="caption" tone="muted">{`${name} ${value}`}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section id="buttons" title="Buttons">
        <Label>Variants (press to animate)</Label>
        <View style={styles.wrap}>
          <Button
            label="Primary"
            onPress={() => setPressCount((c) => c + 1)}
            testID="btn-primary"
          />
          <Button
            label="Secondary"
            variant="secondary"
            onPress={() => setPressCount((c) => c + 1)}
            testID="btn-secondary"
          />
          <Button
            label="Ghost"
            variant="ghost"
            onPress={() => setPressCount((c) => c + 1)}
            testID="btn-ghost"
          />
          <Button
            label="Danger"
            variant="danger"
            onPress={() => setPressCount((c) => c + 1)}
            testID="btn-danger"
          />
        </View>
        <Label>{`Presses: ${pressCount}`}</Label>
        <Label>Sizes</Label>
        <View style={styles.wrap}>
          <Button label="Small" size="sm" onPress={() => undefined} />
          <Button label="Medium" size="md" onPress={() => undefined} />
          <Button label="Large" size="lg" onPress={() => undefined} />
        </View>
        <Label>States</Label>
        <View style={styles.wrap}>
          <Button label="Disabled" disabled onPress={() => undefined} testID="btn-disabled" />
          <Button label="Loading" loading onPress={() => undefined} testID="btn-loading" />
          <Button label="With icon" icon="play" variant="secondary" onPress={() => undefined} />
          <Button
            label={loadingDemo ? 'Loading' : 'Tap to load'}
            loading={loadingDemo}
            variant="secondary"
            onPress={() => {
              setLoadingDemo(true);
              setTimeout(() => setLoadingDemo(false), 1500);
            }}
            testID="btn-load-demo"
          />
        </View>
        <Label>Full width</Label>
        <Button
          label={t('common.continue')}
          fullWidth
          size="lg"
          icon="play"
          onPress={() => undefined}
          testID="btn-full"
        />
        <Label>Long label</Label>
        <Button
          label="A very long label that should truncate instead of breaking the layout"
          fullWidth
          onPress={() => undefined}
          testID="btn-long-label"
        />
        <Label>Long label, hug width in a centred parent</Label>
        <View style={styles.center}>
          <Button
            label="A very long label on a hug-width button inside a centred parent"
            onPress={() => undefined}
            testID="btn-long-label-hug"
          />
        </View>
      </Section>

      <Section id="icon-buttons" title="Icon buttons and icons">
        <View style={styles.wrap}>
          <IconButton icon="close" accessibilityLabel="Close" onPress={() => undefined} />
          <IconButton
            icon="back"
            accessibilityLabel="Back"
            variant="filled"
            onPress={() => undefined}
          />
          <IconButton
            icon="play"
            accessibilityLabel="Play"
            variant="accent"
            size={60}
            onPress={() => undefined}
          />
          <IconButton
            icon="pause"
            accessibilityLabel="Pause"
            variant="accent"
            size={60}
            disabled
            onPress={() => undefined}
          />
        </View>
        <View style={styles.wrap}>
          {ICONS.map((name) => (
            <View key={name} style={styles.center}>
              <Icon name={name} size={28} />
              <Text variant="caption" tone="muted">
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section id="fields" title="Text fields and notices">
        <TextField
          label="Email"
          value={fieldText}
          onChangeText={setFieldText}
          hint="Hint text under the field"
          autoCapitalize="none"
          testID="gallery-field"
        />
        <TextField
          label="Password"
          value={secretText}
          onChangeText={setSecretText}
          secure
          testID="gallery-field-secure"
        />
        <TextField
          label="With an error"
          value="not-an-email"
          error="Enter a valid email address."
        />
        <TextField label="Disabled" value="ann@example.com" disabled />
        <Notice
          tone="error"
          message="Error notice with an action"
          action={{ label: 'Retry', onPress: () => undefined }}
        />
        <Notice tone="info" message="Info notice" />
        <Notice tone="success" message="Success notice" />
      </Section>

      <Section id="chips" title="Chips">
        <View style={styles.wrap}>
          <Chip
            tone="points"
            label={t('points.amount', { n: 240 })}
            placeholder
            accessibilityLabel={t('a11y.points', { n: 240 })}
          />
          <Chip
            tone="goal"
            label={t('goal.progress', { done: 3, total: 5 })}
            accessibilityLabel={t('a11y.goalProgress', { done: 3, total: 5 })}
          />
          <Chip tone="neutral" label={t('common.comingSoon')} />
          <Chip tone="neutral" icon="lock" label={t('common.locked')} />
          <Chip tone="celebrate" label={t('croc.stages.adult')} />
        </View>
      </Section>

      <Section id="progress" title="Progress bars">
        <Label>Tones</Label>
        <View style={styles.stack}>
          <ProgressBar progress={0.35} />
          <ProgressBar progress={0.7} tone="water" />
          <ProgressBar progress={1} tone="accent" />
          <ProgressBar progress={0} />
        </View>
        <Label>Textured, animated</Label>
        <ProgressBar progress={progress} textured height={16} testID="progress-demo" />
        <View style={styles.wrap}>
          <Button
            label="Random"
            size="sm"
            variant="ghost"
            onPress={() => setProgress(Math.random())}
            testID="progress-random"
          />
          <Button label="Full" size="sm" variant="ghost" onPress={() => setProgress(1)} />
        </View>
      </Section>

      <Section id="cards" title="Cards">
        <View style={styles.stack}>
          <Card>
            <Text variant="subheading">Surface</Text>
            <Text tone="secondary">A plain card with the default padding.</Text>
          </Card>
          <Card tone="raised" textured>
            <Text variant="subheading">Raised, textured</Text>
            <Text tone="secondary">Croc-scale pattern at low opacity.</Text>
          </Card>
          <Card
            tone="jungle"
            textured
            onPress={() => setPressCount((c) => c + 1)}
            accessibilityLabel="Jungle card"
          >
            <Text variant="subheading" tone="inverse">
              Jungle, pressable
            </Text>
            <Text tone="inverse">Taps count above.</Text>
          </Card>
          <Card tone="water" textured>
            <View style={styles.rowBetween}>
              <View>
                <Text variant="subheading" tone="inverse">
                  Water
                </Text>
                <Text tone="inverse">With a play button.</Text>
              </View>
              <IconButton
                icon="play"
                accessibilityLabel="Play"
                variant="accent"
                size={56}
                onPress={() => undefined}
              />
            </View>
          </Card>
        </View>
      </Section>

      <Section id="tabbar" title="Tab bar">
        <View style={[styles.tabBarFrame, { backgroundColor: colors.surfaceSunken }]}>
          <TabBar
            safeArea={false}
            activeKey={tab}
            onChange={setTab}
            testID="gallery-tabbar"
            items={[
              { key: 'home', label: t('tabs.home'), icon: 'home' },
              { key: 'croc', label: t('tabs.croc'), icon: 'croc' },
              { key: 'games', label: t('tabs.games'), icon: 'games' },
              { key: 'profile', label: t('tabs.profile'), icon: 'profile' },
            ]}
          />
        </View>
      </Section>

      <Section id="croc" title="Croc">
        <Label>
          Viewer (idle animation: bob and blink). Pick a stage, an expression and a pose.
        </Label>
        <Card tone="raised" padding="md" testID="croc-viewer">
          <View style={styles.center}>
            <Croc
              stage={viewerStage}
              expression={viewerExpression}
              pose={pose}
              water={pose === 'peek' ? 'inline' : 'none'}
              width={Math.min(sceneWidth - space.md * 2 - 8, 460)}
              testID="croc-hero"
            />
          </View>
        </Card>
        <View style={styles.row}>
          {CROC_STAGES.map((stage) => (
            <Button
              key={stage}
              label={t(`croc.stages.${stage}`)}
              size="sm"
              variant={viewerStage === stage ? 'secondary' : 'ghost'}
              onPress={() => setViewerStage(stage)}
              testID={`croc-viewer-stage-${stage}`}
            />
          ))}
        </View>
        <View style={styles.row}>
          {CROC_EXPRESSIONS.map((expression) => (
            <Button
              key={expression}
              label={expression}
              size="sm"
              variant={viewerExpression === expression ? 'secondary' : 'ghost'}
              onPress={() => setViewerExpression(expression)}
              testID={`croc-viewer-expression-${expression}`}
            />
          ))}
        </View>
        <View style={styles.wrap}>
          <Button
            label="Peek"
            size="sm"
            variant={pose === 'peek' ? 'secondary' : 'ghost'}
            onPress={() => setPose('peek')}
            testID="croc-pose-peek"
          />
          <Button
            label="Full body"
            size="sm"
            variant={pose === 'full' ? 'secondary' : 'ghost'}
            onPress={() => setPose('full')}
            testID="croc-pose-full"
          />
        </View>
        <Label>
          Stages (rows) × expressions (columns): calm, happy, sleepy, excited, proud, eyes closed
        </Label>
        <View style={styles.stack}>
          {CROC_STAGES.map((stage) =>
            expressionRows.map((row, r) => (
              <View key={`${stage}-${r}`} style={styles.crocRow}>
                {row.map((expression) => (
                  <Croc
                    key={expression}
                    stage={stage}
                    expression={expression}
                    pose={pose}
                    water="inline"
                    width={crocCell}
                    animated={false}
                    relativeSize={false}
                    testID={`croc-${stage}-${expression}`}
                  />
                ))}
              </View>
            )),
          )}
        </View>
        <Label>Growth at relative size</Label>
        <View style={styles.stack}>
          {CROC_STAGES.map((stage) => (
            <View key={stage} style={styles.rowBetween}>
              <Croc
                stage={stage}
                expression="calm"
                width={Math.min(sceneWidth - 100, 300)}
                animated={false}
              />
              <Text variant="caption" tone="muted">
                {t(`croc.stages.${stage}`)}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section id="scene" title="Scene pieces">
        <Label>Lagoon composition (croc aligned to the water)</Label>
        <View style={[styles.sceneFrame, { borderColor: colors.border }]}>
          <Lagoon
            width={sceneWidth}
            height={300}
            stage="adult"
            expression="calm"
            testID="gallery-lagoon"
          />
        </View>
        <Label>Water surface with ripples</Label>
        <View style={[styles.sceneFrame, styles.waterFrame, { borderColor: colors.border }]}>
          <WaterSurface
            ripples={[
              { x: 0.3, y: 0.4, size: 120 },
              { x: 0.75, y: 0.6, size: 90 },
            ]}
            testID="gallery-water"
          />
        </View>
        <Label>Far jungle (horizon)</Label>
        <View style={[styles.sceneFrame, { borderColor: colors.border }]}>
          <FarJungle width={sceneWidth} height={110} />
        </View>
        <Label>Reeds, lily pads</Label>
        <View style={styles.wrap}>
          <Reeds count={5} />
          <Reeds count={3} tone="light" flip />
          <LilyPad size={90} flower />
          <LilyPad size={70} rotation={40} />
        </View>
        <Label>Jungle leaves (four corners)</Label>
        <View style={[styles.cornersFrame, { backgroundColor: colors.surfaceSunken }]}>
          <JungleLeaves corner="top-left" size={120} style={styles.cornerTL} />
          <JungleLeaves corner="top-right" size={120} style={styles.cornerTR} />
          <JungleLeaves corner="bottom-left" size={120} style={styles.cornerBL} />
          <JungleLeaves corner="bottom-right" size={120} style={styles.cornerBR} />
        </View>
        <Label>Fireflies (Night River)</Label>
        <View style={[styles.sceneFrame, { height: 160, backgroundColor: palette.nightRiver }]}>
          <Fireflies count={9} testID="gallery-fireflies" />
        </View>
        <Label>River path</Label>
        <RiverPath
          width={sceneWidth}
          height={220}
          points={[
            { x: 40, y: 200 },
            { x: sceneWidth * 0.3, y: 150 },
            { x: sceneWidth * 0.7, y: 130 },
            { x: sceneWidth * 0.55, y: 60 },
            { x: sceneWidth - 40, y: 20 },
          ]}
        />
      </Section>
    </View>
  );
}

export default function GalleryScreen() {
  const [atmosphere, setAtmosphere] = useState<Atmosphere>('daylight');

  if (!devMode) return <Redirect href="/" />;

  return (
    <Screen atmosphere={atmosphere} scroll={false} padded={false} testID="gallery-screen">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <GalleryContent atmosphere={atmosphere} setAtmosphere={setAtmosphere} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  grow: { flex: 1 },
  section: { gap: space.md, paddingTop: space.lg },
  sectionTitle: { marginBottom: space.xs },
  label: { marginTop: space.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'flex-end' },
  stack: { gap: space.md },
  center: { alignItems: 'center', gap: space.xs },
  typeRow: { paddingVertical: space.xxs },
  swatch: { width: 92, gap: 2 },
  swatchColor: { height: 40, borderRadius: radius.sm, borderWidth: 1 },
  tabBarFrame: { borderRadius: radius.lg, paddingTop: space.xl, overflow: 'hidden' },
  crocRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'space-between' },
  sceneFrame: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1 },
  waterFrame: { height: 160 },
  cornersFrame: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  cornerTL: { position: 'absolute', left: 0, top: 0 },
  cornerTR: { position: 'absolute', right: 0, top: 0 },
  cornerBL: { position: 'absolute', left: 0, bottom: 0 },
  cornerBR: { position: 'absolute', right: 0, bottom: 0 },
});
