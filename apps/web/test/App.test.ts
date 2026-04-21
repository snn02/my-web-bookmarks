import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App.vue';

describe('App', () => {
  it('shows backend availability when health check succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' })
      })
    );

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Backend: available'));

    expect(fetch).toHaveBeenCalledWith('/api/v1/health');
  });

  it('shows backend unavailable state when health check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Backend: unavailable'));
  });
});
