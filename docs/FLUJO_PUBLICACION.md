# Flujo de publicación — repositorio original y fork

Orden establecido explícitamente por el usuario el 2026-10-11:

1. Publicar los cambios aprobados en `tellosebastian-git/pixel-perfect-replica`
   (`origin`). Es el repositorio principal.
2. Sincronizar el fork existente `Luciano557/BarberApp` (`production`) con ese
   mismo estado. No crear otro fork ni recrear el repositorio.
3. Verificar en Vercel el despliegue productivo de `barber-app`, que consume
   `main` del fork, y el dominio `www.vittro.com.ar`.

GitHub confirmó por su API oficial que BarberApp tiene `fork=true`, con parent
y source `tellosebastian-git/pixel-perfect-replica`, rama por defecto `main`.

## Verificación y comandos

Revisar `git status`, el diff, pruebas proporcionales al cambio, remotos y ramas.
No agregar archivos temporales, credenciales ni cambios ajenos a la publicación.
Actualizar referencias y comprobar que ambos remotos permiten avance normal:

```powershell
git fetch origin main
git fetch production main
git merge-base --is-ancestor origin/main HEAD
git merge-base --is-ancestor production/main HEAD
```

Si alguna comprobación de ancestro falla, detener la publicación y revisar la
divergencia. No hacer force push, reset ni un pull/merge ciego para ocultarla.

Con el estado aprobado y sin divergencias, ejecutar por separado:

```powershell
git push origin HEAD:main
git ls-remote origin refs/heads/main
```

Confirmar que el SHA del original coincide con el commit aprobado antes de
sincronizar el fork:

```powershell
git push production HEAD:main
git ls-remote production refs/heads/main
```

Comparar ambos SHA y verificar Vercel Ready / Production / Current. Si las
reglas de GitHub requieren PR, cumplirlas y confirmar la integración en el
original antes de actualizar el fork; no eludir protecciones.

Migraciones, switches, Edge Functions y acciones comerciales requieren su
propia autoridad y orden de rollout. Un push no autoriza repetir migraciones
ya aplicadas ni modificar barberías, Auth, contratos o precios.

## Corrección del desfase del 2026-10-11

Antes de sincronizar, el original estaba en `2bda5a73` y el fork en `27ec0991`.
Los cinco commits de diferencia incluyen la recuperación autorizada del panel,
su activación, la corrección de vencimientos y la evidencia. El original es
ancestro del fork: se conserva todo el historial mediante avance normal.
No se vuelve al merge defectuoso, se reaplica una migración ni se cambia el trial.

Esta corrección incorpora también la regla duradera en AGENTS.md. El orden de
publicaciones anterior queda registrado como hecho histórico, no como norma.
