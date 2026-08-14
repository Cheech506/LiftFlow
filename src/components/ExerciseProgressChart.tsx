import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExerciseDefinition } from '@/constants/exercises';
import { colors, radius, spacing } from '@/constants/theme';
import type { CompletedWorkout } from '@/context/ActiveWorkoutContext';
import {
  buildExerciseTrend,
  formatProgressDate,
  getExerciseTrendMetricOptions,
  getTrendChange,
  PROGRESS_RANGE_OPTIONS,
  type ExerciseTrendMetricKey,
  type ExerciseTrendPoint,
  type ProgressRangeKey,
} from '@/lib/progressAnalytics';

type ExerciseProgressChartProps = {
  exercise: ExerciseDefinition;
  completedWorkouts: CompletedWorkout[];
  range?: ProgressRangeKey;
  showRangeControls?: boolean;
};

/**
 * Shared exercise chart used by both Progress and each exercise's detail page.
 * When no range is supplied, it defaults to ALL so imported Strong history is
 * visible immediately instead of being hidden behind the dashboard's 12W view.
 */
export function ExerciseProgressChart({
  exercise,
  completedWorkouts,
  range,
  showRangeControls = false,
}: ExerciseProgressChartProps) {
  const [localRange, setLocalRange] = useState<ProgressRangeKey>('all');
  const [metricKey, setMetricKey] = useState<ExerciseTrendMetricKey | null>(null);
  const activeRange = range ?? localRange;
  const metricOptions = useMemo(
    () => getExerciseTrendMetricOptions(exercise.exerciseType),
    [exercise.exerciseType],
  );
  const activeMetric = metricOptions.find((option) => option.key === metricKey)
    ?? metricOptions[0]
    ?? null;

  useEffect(() => {
    setMetricKey(metricOptions[0]?.key ?? null);
  }, [exercise.id, metricOptions]);

  const points = useMemo(
    () => activeMetric
      ? buildExerciseTrend(
          exercise,
          completedWorkouts,
          activeMetric.key,
          activeRange,
        )
      : [],
    [activeMetric, activeRange, completedWorkouts, exercise],
  );

  return (
    <View style={styles.container}>
      {showRangeControls ? (
        <View style={styles.rangeRow}>
          {PROGRESS_RANGE_OPTIONS.map((option) => (
            <ChartChip
              key={option.key}
              label={option.label}
              selected={activeRange === option.key}
              onPress={() => setLocalRange(option.key)}
            />
          ))}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricRow}
      >
        {metricOptions.map((option) => (
          <ChartChip
            key={option.key}
            label={option.label}
            selected={activeMetric?.key === option.key}
            onPress={() => setMetricKey(option.key)}
          />
        ))}
      </ScrollView>

      {activeMetric && points.length > 0 ? (
        <>
          <TrendSummary points={points} higherIsBetter={activeMetric.higherIsBetter} />
          <ExerciseBarChart points={points} lowerIsBetter={!activeMetric.higherIsBetter} />
          <Text style={styles.footnote}>
            {points.length} recorded session{points.length === 1 ? '' : 's'} shown
            {activeRange === 'all' ? ' · Complete Strong and LiftFlow history' : ''}
          </Text>
        </>
      ) : (
        <Text style={styles.emptyText}>
          No qualifying working sets for this metric in the selected range.
        </Text>
      )}
    </View>
  );
}

function ChartChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function TrendSummary({
  points,
  higherIsBetter,
}: {
  points: ExerciseTrendPoint[];
  higherIsBetter: boolean;
}) {
  const latest = points[points.length - 1];
  const best = [...points].sort((left, right) =>
    higherIsBetter ? right.value - left.value : left.value - right.value,
  )[0];
  const change = getTrendChange(points, higherIsBetter);

  return (
    <View style={styles.summary}>
      <TrendStat label="Latest" value={latest.displayValue} />
      <TrendStat label="Best" value={best.displayValue} />
      <TrendStat label="Change" value={change?.label ?? '—'} improved={change?.improved} />
    </View>
  );
}

function TrendStat({
  label,
  value,
  improved,
}: {
  label: string;
  value: string;
  improved?: boolean;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, improved && styles.improved]}>{value}</Text>
    </View>
  );
}

function ExerciseBarChart({
  points,
  lowerIsBetter,
}: {
  points: ExerciseTrendPoint[];
  lowerIsBetter: boolean;
}) {
  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = max - min;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={styles.chartContent}
    >
      {points.map((point, index) => {
        const normalized = lowerIsBetter && spread > 0
          ? (max - point.value) / spread
          : max > 0
            ? point.value / max
            : 0;
        const height = Math.max(10, Math.round(normalized * 92));

        return (
          <View key={`${point.workoutId}-${index}`} style={styles.chartColumn}>
            <Text numberOfLines={1} style={styles.chartValue}>{point.displayValue}</Text>
            <View style={styles.chartSlot}>
              <View style={[styles.chartBar, { height }]} />
            </View>
            <Text numberOfLines={1} style={styles.chartLabel}>
              {formatProgressDate(point.completedAt)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    minHeight: 36,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  chipTextSelected: { color: colors.background },
  pressed: { opacity: 0.72 },
  summary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingHorizontal: 3 },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 3 },
  improved: { color: colors.primary },
  chartContent: {
    minWidth: '100%',
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
    paddingBottom: 4,
    gap: spacing.sm,
  },
  chartColumn: { width: 48, alignItems: 'center' },
  chartValue: {
    width: 54,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 5,
  },
  chartSlot: {
    height: 96,
    width: 24,
    justifyContent: 'flex-end',
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    minHeight: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  chartLabel: {
    width: 54,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  footnote: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
