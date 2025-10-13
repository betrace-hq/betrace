import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MonacoRuleEditor } from '../monaco-rule-editor';

// Mock @monaco-editor/react
const mockEditor = {
  updateOptions: vi.fn(),
  focus: vi.fn(),
  getValue: vi.fn(() => ''),
  setValue: vi.fn(),
};

const mockMonaco = {
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    setLanguageConfiguration: vi.fn(),
    registerCompletionItemProvider: vi.fn(),
  },
  editor: {
    defineTheme: vi.fn(),
  },
};

let capturedOnMount: any = null;

vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange, onMount }) => {
    // Capture onMount callback
    capturedOnMount = onMount;

    // Simulate async mount
    setTimeout(() => {
      if (onMount) {
        onMount(mockEditor, mockMonaco);
      }
    }, 0);

    return (
      <div data-testid="monaco-editor" data-value={value}>
        Monaco Editor Mock
      </div>
    );
  }),
}));

describe('MonacoRuleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnMount = null;
    mockEditor.getValue.mockReturnValue('');
  });

  it('renders editor container', () => {
    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('passes initial value to editor', () => {
    const initialValue = 'trace.has(test)';
    render(<MonacoRuleEditor value={initialValue} onChange={() => {}} />);

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toHaveAttribute('data-value', initialValue);
  });

  it('registers FLUO DSL language on mount', async () => {
    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(mockMonaco.languages.register).toHaveBeenCalled();
      expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalled();
      expect(mockMonaco.languages.setLanguageConfiguration).toHaveBeenCalled();
    });
  });

  it('registers FLUO DSL theme on mount', async () => {
    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('fluo-dsl-dark', expect.any(Object));
    });
  });

  it('registers autocomplete provider on mount', async () => {
    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(mockMonaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith('fluo-dsl', expect.any(Object));
    });
  });

  it('configures editor options on mount', async () => {
    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(mockEditor.updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          minimap: { enabled: false },
          lineNumbers: 'on',
          wordWrap: 'on',
          quickSuggestions: true,
        })
      );
    });
  });

  it('focuses editor on mount', async () => {
    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(mockEditor.focus).toHaveBeenCalled();
    });
  });

  it('calls onChange when value changes', async () => {
    const onChange = vi.fn();
    const Editor = await import('@monaco-editor/react');

    // @ts-ignore - accessing mock implementation
    const EditorMock = Editor.default;

    render(<MonacoRuleEditor value="" onChange={onChange} />);

    // Simulate editor value change by calling onChange from mock
    const mockOnChange = vi.fn();
    EditorMock.mock.calls[0][0].onChange('new value');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('applies custom height', async () => {
    const EditorModule = await import('@monaco-editor/react');
    const Editor = vi.mocked(EditorModule.default);

    render(<MonacoRuleEditor value="" onChange={() => {}} height="500px" />);

    await waitFor(() => {
      expect(Editor).toHaveBeenCalledWith(
        expect.objectContaining({
          height: '500px',
        }),
        expect.anything()
      );
    });
  });

  it('sets readOnly option when disabled', async () => {
    const EditorModule = await import('@monaco-editor/react');
    const Editor = vi.mocked(EditorModule.default);

    render(<MonacoRuleEditor value="" onChange={() => {}} disabled={true} />);

    await waitFor(() => {
      expect(Editor).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { readOnly: true },
        }),
        expect.anything()
      );
    });
  });

  it('applies custom className', () => {
    const { container } = render(<MonacoRuleEditor value="" onChange={() => {}} className="custom-class" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
  });

  it('shows loading state', async () => {
    const EditorModule = await import('@monaco-editor/react');
    const Editor = vi.mocked(EditorModule.default);

    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(Editor).toHaveBeenCalledWith(
        expect.objectContaining({
          loading: expect.anything(),
        }),
        expect.anything()
      );
    });
  });

  it('handles empty value', () => {
    render(<MonacoRuleEditor value="" onChange={() => {}} />);

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('handles multi-line value', () => {
    const multilineValue = `trace.has(http.request)
  and trace.has(database.query)`;

    render(<MonacoRuleEditor value={multilineValue} onChange={() => {}} />);

    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-value', multilineValue);
  });
});
