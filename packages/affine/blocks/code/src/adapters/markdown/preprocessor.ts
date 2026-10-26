import {
  type MarkdownAdapterPreprocessor,
  MarkdownPreprocessorExtension,
} from '@labre/affine-shared/adapters';
import { isValidUrl } from '@labre/affine-shared/utils';

/**
 * A list item's marker (`-`, `*`, `+`, `1.`, `1)`) followed by a space or the
 * end of the line. Its indentation is what nests it, so it is left alone (#519).
 */
const LIST_ITEM = /^(?:[*+-]|\d{1,9}[.)])(?:\s|$)/;

/**
 * Plain text pasted as a slice (BlockSuite #6017, the plain-text adapter):
 * the first leading space of a line becomes `&#x20;`, so the line keeps its
 * indentation instead of losing it or turning into an indented code block.
 * Fenced code, list items and `-` lines are left as written.
 */
const codePreprocessor: MarkdownAdapterPreprocessor = {
  name: 'code',
  levels: ['slice'],
  preprocess: content => {
    let codeFence = '';
    const lines = content
      .split('\n')
      .map(line => {
        if (
          line.trimStart().startsWith('-') ||
          LIST_ITEM.test(line.trimStart())
        ) {
          return line;
        }
        let trimmedLine = line.trimStart();
        if (!codeFence && trimmedLine.startsWith('```')) {
          codeFence = trimmedLine.substring(
            0,
            trimmedLine.lastIndexOf('```') + 3
          );
          if (codeFence.split('').every(c => c === '`')) {
            return line;
          }
          codeFence = '';
        }
        if (!codeFence && trimmedLine.startsWith('~~~')) {
          codeFence = trimmedLine.substring(
            0,
            trimmedLine.lastIndexOf('~~~') + 3
          );
          if (codeFence.split('').every(c => c === '~')) {
            return line;
          }
          codeFence = '';
        }
        if (
          !!codeFence &&
          trimmedLine.startsWith(codeFence) &&
          trimmedLine.lastIndexOf(codeFence) === 0
        ) {
          codeFence = '';
        }
        if (codeFence) {
          return line;
        }

        trimmedLine = trimmedLine.trimEnd();
        if (
          !trimmedLine.startsWith('<') &&
          !trimmedLine.endsWith('>') &&
          !trimmedLine.includes(' ')
        ) {
          // check if it is a url link and wrap it with the angle brackets
          // sometimes the url includes emphasis `_` that will break URL parsing
          //
          // eg. /MuawcBMT1Mzvoar09-_66?mode=page&blockIds=rL2_GXbtLU2SsJVfCSmh_
          // https://www.markdownguide.org/basic-syntax/#urls-and-email-addresses
          const valid = isValidUrl(trimmedLine);
          if (valid) {
            return `<${trimmedLine}>`;
          }
        }

        return line.replace(/^ /, '&#x20;');
      })
      .join('\n');

    return lines;
  },
};

export const CodeMarkdownPreprocessorExtension =
  MarkdownPreprocessorExtension(codePreprocessor);
