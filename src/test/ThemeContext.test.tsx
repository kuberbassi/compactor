import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

afterEach(() => vi.restoreAllMocks());

it('can render and toggle the theme when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  function Toggle() { const { theme, toggleTheme } = useTheme(); return <button onClick={toggleTheme}>{theme}</button>; }
  render(<ThemeProvider><Toggle /></ThemeProvider>);
  const button = screen.getByRole('button');
  const before = button.textContent;
  fireEvent.click(button);
  expect(button.textContent).not.toBe(before);
});
