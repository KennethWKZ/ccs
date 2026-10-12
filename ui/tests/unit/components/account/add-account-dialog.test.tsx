import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { AddAccountDialog } from '@/components/account/add-account-dialog';
import { render, screen, userEvent, waitFor } from '@tests/setup/test-utils';
import { toast } from 'sonner';

const authMocks = vi.hoisted(() => ({
  startAuth: vi.fn(),
  cancelAuth: vi.fn(),
  submitCallback: vi.fn(),
}));

const kiroImportMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const authFlowState = vi.hoisted(() => ({
  provider: null as string | null,
  isAuthenticating: false,
}));

const presetMocks = vi.hoisted(() => ({
  applyDefaultPreset: vi.fn(),
}));

vi.mock('@/lib/preset-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/preset-utils')>()),
  applyDefaultPreset: presetMocks.applyDefaultPreset,
}));

vi.mock('@/hooks/use-cliproxy-auth-flow', () => ({
  useCliproxyAuthFlow: () => ({
    provider: authFlowState.provider,
    isAuthenticating: authFlowState.isAuthenticating,
    error: null,
    authUrl: null,
    oauthState: null,
    isSubmittingCallback: false,
    isDeviceCodeFlow: false,
    startAuth: authMocks.startAuth,
    cancelAuth: authMocks.cancelAuth,
    submitCallback: authMocks.submitCallback,
  }),
}));

vi.mock('@/hooks/use-cliproxy', () => ({
  useKiroImport: () => ({
    isPending: false,
    mutate: kiroImportMocks.mutate,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

function createJsonResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AddAccountDialog power user mode', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    fetchMock.mockReset();
    authFlowState.provider = null;
    authFlowState.isAuthenticating = false;
    presetMocks.applyDefaultPreset.mockResolvedValue({
      success: true,
      presetName: 'Claude Sonnet 5.5',
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => {},
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: () => {},
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips the Gemini typed acknowledgement when power user mode is enabled', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ antigravityAckBypass: true }));

    render(<AddAccountDialog open onClose={vi.fn()} provider="gemini" displayName="Gemini" />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/settings/auth/antigravity-risk')
    );

    const authenticateButton = screen.getByRole('button', { name: 'Authenticate' });
    await waitFor(() => expect(authenticateButton).toBeEnabled());

    expect(screen.getByText('Power user mode enabled')).toBeInTheDocument();
    expect(screen.queryByText(/Type exact phrase to continue/i)).not.toBeInTheDocument();

    await userEvent.click(authenticateButton);

    expect(authMocks.startAuth).toHaveBeenCalledWith(
      'gemini',
      expect.objectContaining({
        riskAcknowledgement: undefined,
      })
    );
  });

  it('keeps the Gemini typed acknowledgement when power user mode is disabled', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ antigravityAckBypass: false }));

    render(<AddAccountDialog open onClose={vi.fn()} provider="gemini" displayName="Gemini" />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/settings/auth/antigravity-risk')
    );

    const authenticateButton = screen.getByRole('button', { name: 'Authenticate' });
    await waitFor(() => expect(authenticateButton).toBeDisabled());

    expect(screen.getByText(/Type exact phrase to continue/i)).toBeInTheDocument();
    expect(screen.queryByText('Power user mode enabled')).not.toBeInTheDocument();
    expect(authMocks.startAuth).not.toHaveBeenCalled();
  });

  it('surfaces a power user mode fetch failure and fails closed for Gemini', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    render(<AddAccountDialog open onClose={vi.fn()} provider="gemini" displayName="Gemini" />);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to load power user mode settings. Check Settings > Proxy and try again.'
      )
    );

    expect(
      screen.getByText(
        'Failed to load power user mode settings. Check Settings > Proxy and try again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Type exact phrase to continue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authenticate' })).toBeDisabled();
  });

  it('skips the AGY responsibility checklist when power user mode is enabled', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ antigravityAckBypass: true }));

    render(<AddAccountDialog open onClose={vi.fn()} provider="agy" displayName="AGY" />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/settings/auth/antigravity-risk')
    );

    const authenticateButton = screen.getByRole('button', { name: 'Authenticate' });
    await waitFor(() => expect(authenticateButton).toBeEnabled());

    expect(screen.getByText('Power user mode enabled')).toBeInTheDocument();
    expect(screen.queryByText(/Step 1: I reviewed issue #509/i)).not.toBeInTheDocument();

    await userEvent.click(authenticateButton);

    expect(authMocks.startAuth).toHaveBeenCalledWith(
      'agy',
      expect.objectContaining({
        riskAcknowledgement: undefined,
      })
    );
  });

  it('keeps the AGY responsibility checklist when power user mode is disabled', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ antigravityAckBypass: false }));

    render(<AddAccountDialog open onClose={vi.fn()} provider="agy" displayName="AGY" />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/settings/auth/antigravity-risk')
    );

    const authenticateButton = screen.getByRole('button', { name: 'Authenticate' });
    await waitFor(() => expect(authenticateButton).toBeDisabled());

    expect(screen.getByText(/Step 1: I reviewed issue #509/i)).toBeInTheDocument();
    expect(screen.queryByText('Power user mode enabled')).not.toBeInTheDocument();
    expect(authMocks.startAuth).not.toHaveBeenCalled();
  });

  it('submits GitLab PAT mode with base URL and token through the shared auth hook', async () => {
    render(<AddAccountDialog open onClose={vi.fn()} provider="gitlab" displayName="GitLab Duo" />);

    await userEvent.click(screen.getByRole('combobox', { name: 'GitLab auth method' }));
    await userEvent.click(screen.getByRole('option', { name: 'Personal Access Token' }));

    await userEvent.type(screen.getByLabelText('GitLab URL'), 'https://gitlab.example.com');
    await userEvent.type(screen.getByLabelText('Personal Access Token'), 'glpat-test-token');

    await userEvent.click(screen.getByRole('button', { name: 'Authenticate' }));

    expect(authMocks.startAuth).toHaveBeenCalledWith(
      'gitlab',
      expect.objectContaining({
        gitlabAuthMode: 'pat',
        gitlabBaseUrl: 'https://gitlab.example.com',
        gitlabPersonalAccessToken: 'glpat-test-token',
        startEndpoint: 'start',
      })
    );
  });

  async function completeClaudeOAuth(isFirstAccount: boolean) {
    const onClose = vi.fn();
    const dialog = () => (
      <AddAccountDialog
        open
        onClose={onClose}
        provider="claude"
        displayName="Claude"
        isFirstAccount={isFirstAccount}
      />
    );
    const { rerender } = render(dialog());

    await userEvent.click(screen.getByRole('button', { name: 'Authenticate' }));
    authFlowState.provider = 'claude';
    authFlowState.isAuthenticating = true;
    rerender(dialog());
    authFlowState.provider = null;
    authFlowState.isAuthenticating = false;
    rerender(dialog());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  }

  it('does not apply the default preset when adding another account', async () => {
    await completeClaudeOAuth(false);

    expect(presetMocks.applyDefaultPreset).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('applies the default preset when adding the first account', async () => {
    await completeClaudeOAuth(true);

    expect(presetMocks.applyDefaultPreset).toHaveBeenCalledWith('claude', undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith('Applied "Claude Sonnet 5.5" preset');
  });
});
