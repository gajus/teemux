/* eslint-disable react/prop-types */

import { css, cx } from '../styled-system/css';
import { type JsonValue } from '../utils/extractJson';
import { type FC, Fragment, memo, type ReactElement } from 'react';

type HighlighterProps = {
  readonly query?: RegExp;
  readonly subject: string;
};

type InternalJsonViewProps = {
  readonly activePath: null | Path;
  readonly entries: JsonValue;
  readonly expanded: boolean;
  readonly hidePaths: Path[];
  readonly onActivePathChange: (path: null | Path) => void;
  readonly path: Path;
  readonly searchQuery?: RegExp;
};

type JsonViewProps = {
  readonly activePath: null | Path;
  readonly data: JsonValue;
  readonly expanded: boolean;
  readonly hidePaths?: Path[];
  readonly onActivePathChange: (path: null | Path) => void;
  readonly searchQuery?: RegExp;
};

type Path = string;

// Styles
const nodeStyles = css({
  paddingLeft: '8px',
});

const nodeNotExpandedStyles = css({
  display: 'inline',
  paddingLeft: '0',
});

const bracketExpandedStyles = css({
  left: '-8px',
  position: 'relative',
});

const pairNotExpandedStyles = css({
  display: 'inline',
});

const separatorStyles = css({
  display: 'inline',
});

const propertyNameStyles = css({});

const propertyNameActiveStyles = css({
  color: 'json.propActive',
  cursor: 'pointer',
});

const colonStyles = css({
  marginRight: '4px',
});

const stringStyles = css({
  _hover: {
    background: 'json.valueHoverBg',
  },
  color: 'json.string',
});

const numberStyles = css({
  _hover: {
    background: 'json.valueHoverBg',
  },
  color: 'json.number',
});

const booleanStyles = css({
  _hover: {
    background: 'json.valueHoverBg',
  },
  color: 'json.boolean',
});

const nullStyles = css({
  _hover: {
    background: 'json.valueHoverBg',
  },
  color: 'json.null',
});

const markStyles = css({
  background: 'json.markBg',
  color: 'text.white',
});

// Highlight text matching a regex pattern
const highlightText = (
  subject: string,
  query: RegExp,
): Array<{ key: string; match: boolean; text: string }> => {
  const parts: Array<{ key: string; match: boolean; text: string }> = [];

  // Use matchAll to avoid mutating regex state
  const matches = [
    ...subject.matchAll(
      new RegExp(
        query.source,
        query.flags.includes('g') ? query.flags : query.flags + 'g',
      ),
    ),
  ];

  if (matches.length === 0) {
    return [{ key: 'text-0', match: false, text: subject }];
  }

  let lastIndex = 0;
  let keyCounter = 0;

  for (const match of matches) {
    const matchStart = match.index ?? 0;

    if (matchStart > lastIndex) {
      parts.push({
        key: `text-${keyCounter++}`,
        match: false,
        text: subject.slice(lastIndex, matchStart),
      });
    }

    parts.push({
      key: `match-${keyCounter++}`,
      match: true,
      text: match[0],
    });
    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < subject.length) {
    parts.push({
      key: `text-${keyCounter++}`,
      match: false,
      text: subject.slice(lastIndex),
    });
  }

  return parts;
};

// Highlighter component for search term highlighting
const Highlighter: FC<HighlighterProps> = memo(({ query, subject }) => {
  if (!query) {
    return subject as unknown as ReactElement;
  }

  const parts = highlightText(subject, query);

  if (parts.length === 1 && !parts[0].match) {
    return subject as unknown as ReactElement;
  }

  return (
    <>
      {parts.map((part) => {
        if (part.match) {
          return (
            <mark
              className={markStyles}
              key={part.key}
            >
              {part.text}
            </mark>
          );
        }

        return <Fragment key={part.key}>{part.text}</Fragment>;
      })}
    </>
  );
});

Highlighter.displayName = 'Highlighter';

// Render a JSON value recursively
// eslint-disable-next-line func-style -- Needs to be hoisted for mutual recursion with ArrayView/ObjectView
function renderJsonValue(props: InternalJsonViewProps): null | ReactElement {
  const {
    activePath,
    entries,
    expanded,
    hidePaths,
    onActivePathChange,
    path,
    searchQuery,
  } = props;

  switch (typeof entries) {
    case 'boolean':
      return (
        <span
          className={booleanStyles}
          onMouseEnter={() => onActivePathChange(path)}
          onMouseLeave={() => onActivePathChange(null)}
        >
          <Highlighter
            query={searchQuery}
            subject={entries ? 'true' : 'false'}
          />
        </span>
      );

    case 'number':
      return (
        <span
          className={numberStyles}
          onMouseEnter={() => onActivePathChange(path)}
          onMouseLeave={() => onActivePathChange(null)}
        >
          <Highlighter
            query={searchQuery}
            subject={String(entries)}
          />
        </span>
      );

    case 'object':
      if (entries === null) {
        return (
          <span
            className={nullStyles}
            onMouseEnter={() => onActivePathChange(path)}
            onMouseLeave={() => onActivePathChange(null)}
          >
            <Highlighter
              query={searchQuery}
              subject="null"
            />
          </span>
        );
      }

      if (Array.isArray(entries)) {
        if (entries.length === 0) {
          return '[]' as unknown as ReactElement;
        }

        return (
          <div className={cx(nodeStyles, !expanded && nodeNotExpandedStyles)}>
            <span className={expanded ? bracketExpandedStyles : undefined}>
              [
            </span>
            {entries.map((value, index) => {
              const itemPath = `${path}.${index}`;

              return (
                <Fragment key={itemPath}>
                  <div className={cx(!expanded && pairNotExpandedStyles)}>
                    {renderJsonValue({
                      activePath,
                      entries: value,
                      expanded,
                      hidePaths,
                      onActivePathChange,
                      path: itemPath,
                      searchQuery,
                    })}
                  </div>
                  {!expanded && index < entries.length - 1 && (
                    <span className={separatorStyles}> </span>
                  )}
                </Fragment>
              );
            })}
            <span className={expanded ? bracketExpandedStyles : undefined}>
              ]
            </span>
          </div>
        );
      }

      // Object - wrapped in block to satisfy no-case-declarations
      {
        const keys = Object.keys(entries);

        if (keys.length === 0) {
          return '{}' as unknown as ReactElement;
        }

        const visibleKeys = keys.filter(
          (key) => !hidePaths.includes(`${path}.${key}`),
        );

        return (
          <div className={cx(nodeStyles, !expanded && nodeNotExpandedStyles)}>
            <span className={expanded ? bracketExpandedStyles : undefined}>
              {'{'}
            </span>
            {visibleKeys.map((key, index) => {
              const nextPath = `${path}.${key}`;
              const isActive = activePath?.startsWith(nextPath);

              return (
                <Fragment key={nextPath}>
                  <div className={cx(!expanded && pairNotExpandedStyles)}>
                    <span
                      className={cx(
                        propertyNameStyles,
                        isActive && propertyNameActiveStyles,
                      )}
                      onMouseEnter={() => onActivePathChange(nextPath)}
                      onMouseLeave={() => onActivePathChange(null)}
                    >
                      {key}
                    </span>
                    <span className={colonStyles}>:</span>
                    {renderJsonValue({
                      activePath,
                      entries: entries[key],
                      expanded,
                      hidePaths,
                      onActivePathChange,
                      path: nextPath,
                      searchQuery,
                    })}
                  </div>
                  {!expanded && index < visibleKeys.length - 1 && (
                    <span className={separatorStyles}> </span>
                  )}
                </Fragment>
              );
            })}
            <span className={expanded ? bracketExpandedStyles : undefined}>
              {'}'}
            </span>
          </div>
        );
      }

    case 'string':
      return (
        <span
          className={stringStyles}
          onMouseEnter={() => onActivePathChange(path)}
          onMouseLeave={() => onActivePathChange(null)}
        >
          <Highlighter
            query={searchQuery}
            subject={`"${entries}"`}
          />
        </span>
      );

    default:
      return null;
  }
}

// Internal recursive JSON view - memoized wrapper
const InternalJsonView: FC<InternalJsonViewProps> = memo((props) =>
  renderJsonValue(props),
);

InternalJsonView.displayName = 'InternalJsonView';

// Main JsonView component
export const JsonView: FC<JsonViewProps> = memo(
  ({
    activePath,
    data,
    expanded,
    hidePaths = [],
    onActivePathChange,
    searchQuery,
  }) => {
    return (
      <InternalJsonView
        activePath={activePath}
        entries={data}
        expanded={expanded}
        hidePaths={hidePaths}
        onActivePathChange={onActivePathChange}
        path=""
        searchQuery={searchQuery}
      />
    );
  },
);

JsonView.displayName = 'JsonView';
