import * as stylex from '@stylexjs/stylex';
import { X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import type { AppStyles } from '@/lib/styles';
import { withClassName } from '@/lib/styles';
import { surfaces } from '@/styles/surfaces';
import { Badge } from './badge';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  xstyle?: AppStyles;
  id?: string;
  error?: boolean;
  // Forwarded to the inner text input so a wrapping FormField can link its
  // error message (aria-describedby) and mark the control invalid.
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = '입력 후 Enter',
  className,
  xstyle,
  id,
  error,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      {...withClassName(
        [
          styles.container,
          surfaces.inputClean,
          error && styles.container2,
          xstyle,
        ],
        className,
      )}
    >
      {value.map((tag) => (
        <Badge key={tag} xstyle={styles.badge} variant="glass">
          {tag}
          <button
            aria-label={`${tag} 제거`}
            {...stylex.props(styles.button)}
            onClick={() => removeTag(tag)}
            type="button"
          >
            <X {...stylex.props(styles.icon)} />
          </button>
        </Badge>
      ))}
      <input
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid ?? (error || undefined)}
        {...stylex.props(styles.input)}
        id={id}
        placeholder={value.length === 0 ? placeholder : ''}
        value={inputValue}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue);
        }}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        type="text"
      />
    </div>
  );
}

const styles = stylex.create({
  container: {
    display: 'flex',
    minHeight: '2.5rem',
    width: '100%',
    flexWrap: 'wrap',
    gap: '0.375rem',
    borderRadius: '.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
    outlineWidth: {
      default: null,
      ':focus-within': '2px',
    },
    outlineStyle: {
      default: null,
      ':focus-within': 'solid',
    },
    outlineColor: {
      default: null,
      ':focus-within': 'hsl(var(--ring))',
    },
    outlineOffset: {
      default: null,
      ':focus-within': '1px',
    },
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  container2: {
    borderColor:
      'color-mix(in oklab, oklch(70.4% .191 22.216) 60%, transparent)',
    outlineColor: {
      default: null,
      ':focus-within':
        'color-mix(in oklab, oklch(70.4% .191 22.216) 20%, transparent)',
    },
  },
  badge: {
    gap: '0.25rem',
    paddingRight: '0.25rem',
  },
  button: {
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    color: {
      default: null,
      ':hover': 'oklch(80.8% .114 19.571)',
    },
  },
  icon: {
    height: '0.75rem',
    width: '0.75rem',
  },
  input: {
    flex: '1',
    minWidth: '8rem',
    backgroundColor: 'transparent',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    outlineStyle: 'none',
    '::placeholder': {
      color: 'hsl(var(--muted-foreground))',
    },
  },
});
