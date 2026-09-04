import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AdminLogin from '@/admin/AdminLogin';

describe('AdminLogin', () => {
  it('valida campos requeridos sin enviar credenciales vacías', () => {
    const onSignIn = vi.fn();
    render(<AdminLogin onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Completá usuario y contraseña.');
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('envía el alias y la contraseña sin convertir el campo a texto', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    render(<AdminLogin onSignIn={onSignIn} />);

    const password = screen.getByLabelText('Contraseña');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(password, { target: { value: 'clave-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith('admin', 'clave-de-prueba'));
  });
});
