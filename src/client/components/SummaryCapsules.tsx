/* eslint-disable react/prop-types */

import { css, cx } from '../styled-system/css';
import { type JsonValue } from '../utils/extractJson';
import { type FC, memo } from 'react';

type SummaryCapsulesProps = {
  readonly json: JsonValue;
  readonly summaryPaths: string[];
};

const containerStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
});

const capsuleStyles = css({
  background: 'bg.capsule',
  border: '1px solid',
  borderColor: 'border.capsule',
  borderRadius: 'md',
  display: 'inline-block',
  fontSize: 'xs',
  padding: '0 5px',
});

const capsuleClass = 'summary-capsule';

const keyStyles = css({
  color: 'text.muted',
});

const valueStyles = css({
  color: 'text.link',
});

const valueClass = 'summary-capsule-value';

const getValueAtPath = (object: JsonValue, path: string): unknown => {
  const segments = path.split('.');
  let current: unknown = object;

  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current;
};

const formatValue = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    const serialized = JSON.stringify(value);

    return serialized.length > 50
      ? serialized.slice(0, 47) + '...'
      : serialized;
  }

  const text = String(value);

  return text.length > 50 ? text.slice(0, 47) + '...' : text;
};

export const SummaryCapsules: FC<SummaryCapsulesProps> = memo(
  ({ json, summaryPaths }) => {
    if (!summaryPaths.length || !json || typeof json !== 'object') {
      return null;
    }

    const capsules: Array<{ key: string; path: string; value: string }> = [];

    for (const path of summaryPaths) {
      const value = getValueAtPath(json, path);

      if (value !== undefined && value !== null) {
        const segments = path.split('.');
        const key = segments[segments.length - 1];
        capsules.push({ key, path, value: formatValue(value) });
      }
    }

    if (capsules.length === 0) {
      return null;
    }

    return (
      <div className={containerStyles}>
        {capsules.map((capsule) => (
          <span
            className={cx(capsuleStyles, capsuleClass)}
            key={capsule.path}
          >
            <span className={keyStyles}>{capsule.key}:</span>{' '}
            <span className={cx(valueStyles, valueClass)}>{capsule.value}</span>
          </span>
        ))}
      </div>
    );
  },
);

SummaryCapsules.displayName = 'SummaryCapsules';
