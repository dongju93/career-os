import { X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = '입력 후 Enter',
  className,
  id,
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
      className={cn(
        'flex flex-wrap gap-1.5 min-h-[2.75rem] w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 transition-colors',
        className,
      )}
    >
      {value.map((tag) => (
        <Badge key={tag} className="gap-1 pr-1" variant="secondary">
          {tag}
          <button
            className="hover:text-destructive transition-colors"
            onClick={() => removeTag(tag)}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
