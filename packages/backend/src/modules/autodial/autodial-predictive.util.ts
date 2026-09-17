import type { AutodialDisposition, IAutodialPredictiveConfig } from '@krasterisk/shared';

/** Answered calls kept in the sliding window before older ones are forgotten. */
export const PREDICTIVE_WINDOW = 100;
/** Multiplier the controller starts from and never goes below. */
export const PREDICTIVE_MIN_OVER_DIAL = 1;
/** How fast the factor climbs while abandon rate sits under target, per tick. */
const RAISE_STEP = 0.02;
/** Asymmetric gain: back off far faster than we push forward. */
const LOWER_GAIN = 0.05;
/** Cautious ceiling used while the sample is too small to judge. */
const WARMUP_CEILING = 1.2;

export interface PredictiveObservation {
  /** Answered calls in the window */
  answered: number;
  /** Answered calls that ended without ever reaching an agent */
  abandoned: number;
}

export function defaultAutodialPredictive(): IAutodialPredictiveConfig {
  return { target_abandon_pct: 3, max_over_dial: 2, min_samples: 20 };
}

/**
 * A call counts as abandoned when the subscriber picked up but no agent ever
 * took the leg. Machine detections are excluded: nobody was waiting to talk,
 * so dropping them is the intended outcome rather than a service failure.
 */
export function isAbandonedOutcome(input: {
  answered: boolean;
  agentInterface?: string | null;
  disposition: AutodialDisposition;
}): boolean {
  if (!input.answered) return false;
  if (input.agentInterface) return false;
  return input.disposition !== 'amd_machine' && input.disposition !== 'voicemail';
}

export function observedAbandonPct(obs: PredictiveObservation): number {
  if (obs.answered <= 0) return 0;
  return (obs.abandoned / obs.answered) * 100;
}

/**
 * Closed-loop over-dial multiplier for predictive mode.
 *
 * The controller is deliberately asymmetric: it creeps upward in small steps
 * while abandon rate stays under target and drops proportionally to the overrun
 * the moment it goes over, because an abandoned call is a regulatory and
 * reputational cost while a slightly idle agent is not.
 */
export function computeOverDialFactor(params: {
  config: IAutodialPredictiveConfig;
  observation: PredictiveObservation;
  previous: number;
}): number {
  const { config, observation } = params;
  const ceiling = Math.max(PREDICTIVE_MIN_OVER_DIAL, config.max_over_dial);
  const previous = clamp(params.previous || PREDICTIVE_MIN_OVER_DIAL, PREDICTIVE_MIN_OVER_DIAL, ceiling);

  if (observation.answered < Math.max(1, config.min_samples)) {
    // Not enough evidence yet: ramp only up to the cautious ceiling.
    return clamp(previous + RAISE_STEP, PREDICTIVE_MIN_OVER_DIAL, Math.min(ceiling, WARMUP_CEILING));
  }

  const observed = observedAbandonPct(observation);
  const overrun = observed - Math.max(0, config.target_abandon_pct);
  const next = overrun > 0 ? previous - overrun * LOWER_GAIN : previous + RAISE_STEP;
  return clamp(round2(next), PREDICTIVE_MIN_OVER_DIAL, ceiling);
}

/**
 * Sliding window without per-call storage: once the window is full both
 * counters are halved, so recent calls dominate while history still decays
 * smoothly instead of resetting to zero.
 */
export function pushObservation(
  obs: PredictiveObservation,
  abandoned: boolean,
): PredictiveObservation {
  let answered = obs.answered + 1;
  let dropped = obs.abandoned + (abandoned ? 1 : 0);
  if (answered > PREDICTIVE_WINDOW) {
    answered = Math.round(answered / 2);
    dropped = Math.round(dropped / 2);
  }
  return { answered, abandoned: dropped };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
