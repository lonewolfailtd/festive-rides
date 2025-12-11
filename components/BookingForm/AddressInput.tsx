'use client';

import { useState, useRef, useEffect } from 'react';

interface AddressInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

export function AddressInput({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = 'Start typing your address...',
  required = false,
}: AddressInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="form-field">
      <label htmlFor={id} className="festive-label">
        {label} {required && <span className="text-[var(--color-burgundy)]">*</span>}
      </label>

      <div className="address-input-wrapper">
        {/* Icon indicator */}
        <div
          className={`absolute left-4 top-4 transition-all duration-200 ${
            isFocused ? 'text-[var(--color-sage)]' : 'text-[var(--color-taupe)]'
          }`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        <textarea
          ref={inputRef}
          id={id}
          className="festive-textarea pl-12 resize-none overflow-hidden"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
          rows={1}
        />

        {/* Helper text */}
        {!error && value.length === 0 && !isFocused && (
          <p className="text-sm text-[var(--color-taupe)] mt-2 ml-1">
            Include street number, street name, suburb, and postcode
          </p>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="error-message" role="alert">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
