import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminProtectedRoute } from '@/admin/AdminProtectedRoute';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
}));

vi.mock('@/contexts/AdminAuthContext', () => ({
  useAdminAuth: () => authState,
}));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin/barberias']}>
      <Routes>
        <Route path="/admin/login" element={<p>Pantalla de acceso</p>} />
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin/barberias" element={<p>Contenido protegido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminProtectedRoute', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
  });

  it('redirige una sesión no autorizada al login administrativo', () => {
    renderGuard();
    expect(screen.getByText('Pantalla de acceso')).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('renderiza el contenido para una sesión administrativa válida', () => {
    authState.isAuthenticated = true;
    renderGuard();
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  it('no decide acceso mientras la sesión se está verificando', () => {
    authState.isLoading = true;
    renderGuard();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando acceso administrativo');
  });
});
