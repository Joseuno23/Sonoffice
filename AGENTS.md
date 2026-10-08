# Instrucciones para agentes — Sonoffice

Antes de implementar cualquier solicitud en este repositorio, lee este archivo y sigue sus instrucciones.

## Inicio obligatorio

1. Lee `docs/ai-context.md` antes de modificar código.
2. Usa el proyecto Engram `sonoffice` como memoria persistente canónica.
3. Si el contexto local de Engram no existe, está desactualizado o proviene de otra máquina, lee `docs/engram.md` como snapshot portable de memoria.
4. Revisa `git status` antes de editar para no sobrescribir trabajo del usuario.

## Reglas del proyecto

- No modifiques el legacy `Erp/` salvo que el usuario pida explícitamente un cambio legacy.
- En módulos migrados, verifica el comportamiento legacy antes de cambiar reglas de negocio.
- Para migraciones o cambios funcionales de módulos, aplica el skill de proyecto `sonoffice-legacy-migration`.
- Todo menú, botón o acción debe tener validación de permisos en backend y datos de seed/acción cuando aplique.
- Ocultar elementos en la interfaz no es suficiente: los endpoints deben validar permisos.
- Mantén los commits como unidades de trabajo revisables y usa mensajes Conventional Commit.
- Nunca agregues atribución de IA ni líneas `Co-Authored-By`.
- Usa lenguaje español neutro, sin acento como argentino.

## Antes de finalizar trabajo relevante

1. Ejecuta la verificación correspondiente, normalmente `npm run typecheck` para cambios de aplicación.
2. Actualiza `docs/ai-context.md` cuando cambien comportamiento, flujo de trabajo, permisos, seeds o contexto de handoff.
3. Actualiza `docs/engram.md` si la nueva memoria o el nuevo contexto deben viajar a otra máquina.
4. Guarda descubrimientos, decisiones, correcciones de bugs y convenciones importantes en Engram bajo el proyecto `sonoffice`.
5. Mantener actualizado el `docs/modules-status.md` para saber en que estado esta un  modulo.
