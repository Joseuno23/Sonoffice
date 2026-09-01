# Manual de administración — VM Sonoffice

Este manual explica cómo administrar la instalación de Sonoffice ERP v3.0 en la máquina virtual Ubuntu de la red local. Está pensado para operación diaria: saber dónde está la aplicación, cómo revisar estado, cómo detener/arrancar servicios y cómo desplegar cambios que se trabajan primero en local y se suben a GitHub.

## Resumen rápido

| Elemento | Valor |
|---|---|
| Servidor VM | `srv-erp-sonoffice` |
| IP LAN | `10.16.0.93` |
| Usuario Linux | `sonoffice` |
| Sistema operativo | Ubuntu 26.04 LTS |
| App en servidor | `/home/sonoffice/apps/sonoffice` |
| Frontend publicado | `/var/www/sonoffice` |
| API | NestJS con PM2, proceso `sonoffice-api` |
| Puerto API interno | `3001` |
| Acceso web actual | `http://10.16.0.93/` |
| Base de datos legacy | MariaDB `bd_medios` en `10.16.0.94:3306` |
| Usuario BD | `adminop` |

> Regla clave: `/Erp` es el sistema legacy y se usa como referencia funcional. La nueva implementación vive en `apps/web` y `apps/api`.

## Arquitectura de despliegue

```txt
Navegador LAN
  -> http://10.16.0.93/
  -> Nginx :80
      -> Frontend estático: /var/www/sonoffice
      -> Proxy /api/* hacia http://127.0.0.1:3001/api/*
          -> API NestJS administrada por PM2
              -> MariaDB legacy 10.16.0.94:3306 / bd_medios
```

## Ubicaciones importantes

| Ruta | Uso |
|---|---|
| `/home/sonoffice/apps/sonoffice` | Repositorio clonado desde GitHub. Acá se hace `git pull`, `npm install`, `npm run build`. |
| `/home/sonoffice/apps/sonoffice/.env` | Variables de entorno de la API: puerto, BD, credenciales y correo. Permisos `600`. |
| `/home/sonoffice/apps/sonoffice/apps/api/dist` | Build compilado de la API NestJS. |
| `/home/sonoffice/apps/sonoffice/apps/web/dist` | Build compilado del frontend React. |
| `/var/www/sonoffice` | Carpeta que Nginx sirve al navegador. Se sincroniza desde `apps/web/dist`. |
| `/etc/nginx/sites-available/sonoffice` | Configuración principal de Nginx para la app. |
| `/home/sonoffice/.pm2` | Estado y logs de PM2 para procesos Node. |

## Comandos de estado

Conectarse por SSH a la VM:

```bash
ssh sonoffice@10.16.0.93
```

Ver estado de la API:

```bash
pm2 status
```

Ver logs recientes de la API:

```bash
pm2 logs sonoffice-api --lines 100 --nostream
```

Validar que la API responde y conecta a la base de datos:

```bash
curl -i http://127.0.0.1:3001/api/health/db
curl -i http://10.16.0.93/api/health/db
```

Resultado esperado:

```json
{"success":true,"data":{"database":"connected"},"message":null}
```

Ver estado de Nginx:

```bash
systemctl status nginx --no-pager
```

Validar configuración de Nginx:

```bash
sudo nginx -t
```

## Cómo detener y arrancar la API

Detener la API:

```bash
pm2 stop sonoffice-api
```

Arrancar la API:

```bash
pm2 start sonoffice-api
```

Reiniciar la API después de cambios:

```bash
pm2 restart sonoffice-api
```

Guardar el estado de PM2 para que sobreviva reinicios:

```bash
pm2 save
```

> Importante: PM2 ya está configurado con systemd. Si la VM se reinicia, debe restaurar el proceso `sonoffice-api` automáticamente.

## Cómo detener y arrancar el frontend

El frontend no corre como proceso Node en producción. Es estático y lo sirve Nginx desde `/var/www/sonoffice`.

Para “detener el frontend”, se detiene Nginx:

```bash
sudo systemctl stop nginx
```

Para volver a publicarlo:

```bash
sudo systemctl start nginx
```

Para recargar Nginx después de cambiar configuración:

```bash
sudo systemctl reload nginx
```

Para reiniciar Nginx completo:

```bash
sudo systemctl restart nginx
```

## Flujo correcto para desplegar ajustes desde local

Este es el flujo estándar. Primero se trabaja y valida en la máquina local, luego se sube a GitHub, y finalmente se despliega en la VM.

### 1. En la máquina local de desarrollo

Entrar al repo local:

```bash
cd /Users/josenarvaez/Projects/sonoffice
```

Revisar estado:

```bash
git status --short --branch
```

Ejecutar validaciones mínimas:

```bash
npm run typecheck
npm run build
```

Crear commit:

```bash
git add <archivos-cambiados>
git commit -m "feat(scope): descripcion corta"
```

Subir a GitHub:

```bash
git push origin main
```

> No subas cambios si `npm run build` falla. Si falla, corregí primero. La VM debe recibir código ya validado.

### 2. En la VM de producción/local LAN

Entrar al repo clonado:

```bash
cd /home/sonoffice/apps/sonoffice
```

Traer últimos cambios:

```bash
git pull --ff-only origin main
```

Instalar dependencias si cambiaron `package.json` o `package-lock.json`:

```bash
npm install
```

Compilar API y frontend:

```bash
npm run build
```

Publicar frontend compilado en Nginx:

```bash
sudo rsync -a --delete /home/sonoffice/apps/sonoffice/apps/web/dist/ /var/www/sonoffice/
sudo chown -R www-data:www-data /var/www/sonoffice
```

Reiniciar API:

```bash
pm2 restart sonoffice-api
pm2 save
```

Validar despliegue:

```bash
curl -i http://127.0.0.1:3001/api/health/db
curl -i http://10.16.0.93/api/health/db
curl -I http://10.16.0.93/
```

Abrir en navegador:

```txt
http://10.16.0.93/
```

## Comando compacto de despliegue en VM

Cuando el cambio ya está en GitHub y solo querés actualizar la VM:

```bash
cd /home/sonoffice/apps/sonoffice \
  && git pull --ff-only origin main \
  && npm install \
  && npm run build \
  && sudo rsync -a --delete apps/web/dist/ /var/www/sonoffice/ \
  && sudo chown -R www-data:www-data /var/www/sonoffice \
  && pm2 restart sonoffice-api \
  && pm2 save \
  && curl -i http://127.0.0.1:3001/api/health/db
```

Si algún paso falla, NO sigas a mano sin entender el error. Copiá la salida y corregí la causa.

## Variables de entorno

El archivo `.env` vive en:

```txt
/home/sonoffice/apps/sonoffice/.env
```

Valores principales actuales:

```env
PORT=3001
DB_HOST=10.16.0.94
DB_PORT=3306
DB_NAME=bd_medios
DB_USER=adminop
BREVO_SENDER_EMAIL=sistemaop@sonovista.co
BREVO_SENDER_NAME=Sonoffice
```

No imprimir ni compartir `DB_PASSWORD` ni `BREVO_API_KEY`.

Para revisar sin exponer secretos:

```bash
grep -E "^(PORT|DB_HOST|DB_PORT|DB_NAME|DB_USER|BREVO_SENDER)" /home/sonoffice/apps/sonoffice/.env
```

## Nginx

Archivo de configuración:

```txt
/etc/nginx/sites-available/sonoffice
```

Validar y recargar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

El server block actual debe servir:

- `/` desde `/var/www/sonoffice`
- `/api/` hacia `http://127.0.0.1:3001/api/`

Cuando se cree DNS local, agregar el dominio en `server_name`, por ejemplo:

```nginx
server_name sonoffice.lan 10.16.0.93 srv-erp-sonoffice;
```

## DNS local pendiente

Hoy el acceso es por IP:

```txt
http://10.16.0.93/
```

Para usar nombre en toda la red, crear en el DNS interno `10.16.0.14` un registro A:

```txt
sonoffice.lan -> 10.16.0.93
```

Después validar:

```bash
nslookup sonoffice.lan 10.16.0.14
curl -I http://sonoffice.lan/
```

## Troubleshooting rápido

| Problema | Validar | Acción típica |
|---|---|---|
| No abre la web | `systemctl status nginx --no-pager` | `sudo systemctl restart nginx` |
| Web abre pero API falla | `pm2 status` | `pm2 restart sonoffice-api` |
| API no conecta a BD | `curl http://127.0.0.1:3001/api/health/db` | Revisar `.env`, red y acceso a `10.16.0.94:3306` |
| Cambios frontend no aparecen | Revisar `/var/www/sonoffice` | Rehacer `npm run build` + `rsync` |
| Pull falla por cambios locales en VM | `git status --short` | No pisar a ciegas; revisar qué archivo cambió |
| Nginx no recarga | `sudo nginx -t` | Corregir sintaxis antes de reload |

## Checklist después de cada despliegue

- [ ] `git pull --ff-only origin main` terminó sin errores.
- [ ] `npm install` terminó sin errores.
- [ ] `npm run build` terminó sin errores.
- [ ] Frontend sincronizado a `/var/www/sonoffice`.
- [ ] `pm2 restart sonoffice-api` ejecutado.
- [ ] `curl http://127.0.0.1:3001/api/health/db` devuelve `database: connected`.
- [ ] `http://10.16.0.93/` abre en navegador.
- [ ] Login y menú lateral probados con usuario real.
